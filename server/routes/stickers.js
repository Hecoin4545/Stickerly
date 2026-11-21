const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Sticker = require('../models/Sticker');
const Round = require('../models/Round');
const Room = require('../models/Room');
const User = require('../models/User');
const { verifyFaceMatch, verifyGesture } = require('../services/geminiService');

const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'your_api_key';

// POST /api/stickers/upload
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const { roomId, challengeIndex, skipVerification } = req.body;
    if (!roomId) return res.status(400).json({ message: 'roomId required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (!room.currentRoundId) return res.status(400).json({ message: 'No active round' });

    const io = req.app.get('io');
    const round = await Round.findById(room.currentRoundId);
    if (!round || round.status !== 'uploads_open') {
      return res.status(400).json({ message: 'Uploads are not currently open' });
    }

    const isMember = room.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    if (!req.file) return res.status(400).json({ message: 'Image file required' });

    // Handle Cloudinary vs Local Storage URL
    let imageUrl = req.file.path;
    let publicId = req.file.filename || '';
    if (!imageUrl.startsWith('http')) {
      const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${serverBase}/uploads/${req.file.filename}`;
    }

    // ── AI VERIFICATION (challenges mode only) ────────────────────────────────
    const uploaderUser = await User.findById(req.user._id);
    let faceVerified = null;
    let gestureVerified = null;
    let verificationReason = '';
    let verificationConfidence = 0;
    const cIdx = challengeIndex !== undefined ? parseInt(challengeIndex) : null;

    if (round.mode === 'challenges') {
      // 1. Face verification for challenges
      if (uploaderUser?.avatar && uploaderUser.avatar.trim()) {
        const faceResult = await verifyFaceMatch(uploaderUser.avatar, imageUrl);
        faceVerified = faceResult.passed;
        verificationReason = faceResult.reason;
        verificationConfidence = faceResult.confidence;

        if (!faceVerified && faceResult.confidence > 60) {
          return res.status(400).json({
            message: 'Photo verification failed: The person in the photo does not match your profile photo. Make sure you are in the photo!',
            verificationResult: faceResult,
          });
        }
      }

      // 2. Gesture verification for challenges
      if (cIdx !== null && round.challenges?.length > 0) {
        const challengeCard = round.challenges.find((c) => c.index === cIdx);
        if (challengeCard?.poseDescription) {
          const gestureResult = await verifyGesture(imageUrl, challengeCard.poseDescription);
          gestureVerified = gestureResult.passed;
          if (!gestureResult.passed && gestureResult.confidence > 65) {
            return res.status(400).json({
              message: `Pose verification failed: ${gestureResult.reason}. Please try the pose again!`,
              verificationResult: gestureResult,
            });
          }
          verificationReason = gestureResult.reason;
          verificationConfidence = Math.min(verificationConfidence || 100, gestureResult.confidence);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // For challenges mode: check if already submitted for this challenge
    if (round.mode === 'challenges' && cIdx !== null) {
      const existing = await Sticker.findOne({
        roundId: round._id,
        creatorId: req.user._id,
        challengeIndex: cIdx,
      });

      if (existing) {
        // Update existing submission
        existing.imageUrl = imageUrl;
        existing.publicId = publicId;
        existing.faceVerified = faceVerified;
        existing.gestureVerified = gestureVerified;
        existing.verificationReason = verificationReason;
        existing.verificationConfidence = verificationConfidence;
        if (req.body.title) existing.title = req.body.title;
        await existing.save();

        if (io) {
          const allStickers = await Sticker.find({ roundId: round._id });
          io.to(roomId).emit('submission-update', { submittedCount: allStickers.length });
        }

        return res.status(200).json({ ...existing.toObject(), roundStatus: round.status });
      }
    }
    // Stickerly mode: allow multiple uploads per user per round

    const stickerData = {
      roundId: round._id,
      roomId,
      creatorId: req.user._id,
      imageUrl,
      publicId,
      title: req.body.title || 'Fun Sticker',
      faceVerified,
      gestureVerified,
      verificationReason,
      verificationConfidence,
      isEarlyBird: false,
    };

    if (cIdx !== null) {
      stickerData.challengeIndex = cIdx;
    }

    const sticker = await Sticker.create(stickerData);
    await Round.findByIdAndUpdate(round._id, { $inc: { submissionCount: 1 } });

    // Award points for completing a challenge
    if (round.mode === 'challenges' && cIdx !== null) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { totalPoints: 10 } });
    }

    const allStickers = await Sticker.find({ roundId: round._id });
    if (io) {
      io.to(roomId).emit('submission-update', { submittedCount: allStickers.length });
    }

    const stickerObj = sticker.toObject();
    res.status(201).json({ ...stickerObj, roundStatus: round.status });
  } catch (err) {
    console.error('[Stickers] Upload error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/stickers/:roundId
router.get('/:roundId', auth, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found' });

    if (round.status === 'uploads_open') {
      // During upload phase: only show own stickers
      const myStickers = await Sticker.find({
        roundId: round._id,
        creatorId: req.user._id,
      });
      return res.json(myStickers);
    }

    if (round.status === 'voting_open') {
      const stickers = await Sticker.find({ roundId: round._id }).select('-creatorId');
      return res.json(stickers);
    }

    // completed — include creator info
    const stickers = await Sticker.find({ roundId: round._id }).populate(
      'creatorId',
      'username avatar'
    );
    return res.json(stickers);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/stickers/:stickerId
router.delete('/:stickerId', auth, async (req, res) => {
  try {
    const sticker = await Sticker.findById(req.params.stickerId);
    if (!sticker) return res.status(404).json({ message: 'Sticker not found' });

    if (sticker.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const round = await Round.findById(sticker.roundId);
    if (!round || round.status !== 'uploads_open') {
      return res.status(400).json({ message: 'Can only delete during uploads phase' });
    }

    if (hasCloudinary && sticker.publicId) {
      const cloudinary = require('cloudinary').v2;
      await cloudinary.uploader.destroy(sticker.publicId).catch(() => {});
    } else if (sticker.publicId) {
      const localFile = path.join(__dirname, '..', 'uploads', sticker.publicId);
      if (fs.existsSync(localFile)) {
        fs.unlinkSync(localFile);
      }
    }

    await sticker.deleteOne();
    await Round.findByIdAndUpdate(sticker.roundId, { $inc: { submissionCount: -1 } });

    res.json({ message: 'Sticker deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
