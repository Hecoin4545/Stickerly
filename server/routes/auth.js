const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Middleware to handle avatar multipart upload if present
const uploadAvatar = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Avatar upload failed' });
      }
      next();
    });
  } else {
    next();
  }
};

const resolveAvatarUrl = (req) => {
  if (req.file) {
    let avatarUrl = req.file.path;
    if (!avatarUrl.startsWith('http')) {
      const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      avatarUrl = `${serverBase}/uploads/${req.file.filename}`;
    }
    return avatarUrl;
  }
  if (req.body && typeof req.body.avatar === 'string' && req.body.avatar.trim()) {
    return req.body.avatar.trim();
  }
  return null;
};

// POST /api/auth/register
router.post(
  '/register',
  uploadAvatar,
  [
    body('username').notEmpty().trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, email, password } = req.body;

      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(409).json({ message: 'Username or email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const avatar = resolveAvatarUrl(req) || '';
      const user = await User.create({ username, email, passwordHash, avatar });

      const token = generateToken(user._id);
      const userObj = user.toObject();
      delete userObj.passwordHash;

      res.status(201).json({ token, user: userObj });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  uploadAvatar,
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

      const newAvatar = resolveAvatarUrl(req);
      if (newAvatar) {
        user.avatar = newAvatar;
        await user.save();
      }

      const token = generateToken(user._id);
      const userObj = user.toObject();
      delete userObj.passwordHash;

      res.json({ token, user: userObj });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// PUT /api/auth/profile
router.put('/profile', auth, uploadAvatar, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newAvatar = resolveAvatarUrl(req);
    if (newAvatar) {
      user.avatar = newAvatar;
    }
    if (req.body.username && req.body.username.trim()) {
      user.username = req.body.username.trim();
    }
    await user.save();

    const userObj = user.toObject();
    delete userObj.passwordHash;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
