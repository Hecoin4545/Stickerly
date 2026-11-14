const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const User = require('../models/User');
const Round = require('../models/Round');

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

// GET /api/rooms/my - get all rooms current user is member of
router.get('/my', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate('members', 'username avatar')
      .populate({
        path: 'currentRoundId',
        populate: { path: 'targetUserId', select: 'username avatar' },
      })
      .sort({ updatedAt: -1 });

    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rooms/create
router.post('/create', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Room name required' });

    let code;
    let exists = true;
    while (exists) {
      code = generateCode();
      exists = await Room.findOne({ code });
    }

    const room = await Room.create({
      name: name.trim(),
      code,
      adminId: req.user._id,
      members: [req.user._id],
    });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { roomIds: room._id } });

    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rooms/join
router.post('/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Room code required' });

    const room = await Room.findOne({ code: code.toUpperCase() });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isMember = room.members.some((m) => m.toString() === req.user._id.toString());
    if (isMember) return res.status(409).json({ message: 'Already a member of this room' });

    room.members.push(req.user._id);
    await room.save();

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { roomIds: room._id } });

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/rooms/:roomId
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate(
      'members',
      'username avatar totalPoints streak podiums'
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/rooms/:roomId/leaderboard
router.get('/:roomId/leaderboard', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate(
      'members',
      'username avatar totalPoints podiums streak timesTargeted'
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const sorted = [...room.members].sort((a, b) => b.totalPoints - a.totalPoints);
    const leaderboard = sorted.map((member, index) => ({
      rank: index + 1,
      _id: member._id,
      username: member.username,
      avatar: member.avatar,
      totalPoints: member.totalPoints,
      podiums: member.podiums,
      streak: member.streak,
      timesTargeted: member.timesTargeted,
    }));

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
