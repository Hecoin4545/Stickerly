const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Sticker = require('../models/Sticker');
const Round = require('../models/Round');
const Room = require('../models/Room');

const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'your_api_key';

// POST /api/stickers/upload
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) return res.status(400).json({ message: 'roomId required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (!room.currentRoundId) return res.status(400).json({ message: 'No active round' });

    const round = await Round.findById(room.currentRoundId);
    if (!round || round.status !== 'hunt') {
      return res.status(400).json({ message: 'Round is not in hunt phase' });
    }

    const isMember = room.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    if (room.members.length > 1 && round.targetUserId.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'Target cannot upload stickers' });
    }

    const existing = await Sticker.findOne({ roundId: round._id, creatorId: req.user._id });
    if (existing) return res.status(409).json({ message: 'Already uploaded a sticker this round' });

    if (!req.file) return res.status(400).json({ message: 'Image file required' });

    // Handle Cloudinary vs Local Storage URL
    let imageUrl = req.file.path;
    let publicId = req.file.filename || '';
    if (!imageUrl.startsWith('http')) {
      const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${serverBase}/uploads/${req.file.filename}`;
    }

    const sticker = await Sticker.create({
      roundId: round._id,
      roomId,
      creatorId: req.user._id,
      imageUrl,
      publicId,
      title: req.body.title || '',
      isEarlyBird: false,
    });

    await Round.findByIdAndUpdate(round._id, { $inc: { submissionCount: 1 } });

    // Check if everyone has submitted a sticker except the target user ("the one whose name is written")
    const targetIdStr = round.targetUserId.toString();
    const eligibleMembers = [
      ...new Set(
        room.members
          .map((m) => m.toString())
          .filter((id) => (room.members.length > 1 ? id !== targetIdStr : true))
      ),
    ];

    const allStickers = await Sticker.find({ roundId: round._id });
    const uploaderIds = new Set(allStickers.map((s) => s.creatorId.toString()));

    const allUploaded =
      eligibleMembers.length > 0 &&
      eligibleMembers.every((m) => uploaderIds.has(m));

    let roundStatus = round.status;
    if (allUploaded) {
      round.status = 'voting';
      round.votingStart = new Date();
      await round.save();
      roundStatus = 'voting';

      const io = req.app.get('io');
      if (io) {
        io.to(roomId).emit('phase-change', { phase: 'voting' });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('submission-update', { submittedCount: allStickers.length });
    }

    const stickerObj = sticker.toObject();
    delete stickerObj.creatorId;
    res.status(201).json({ ...stickerObj, roundStatus });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/stickers/:roundId
router.get('/:roundId', auth, async (req, res) => {
  try {
    const round = await Round.findById(req.params.roundId);
    if (!round) return res.status(404).json({ message: 'Round not found' });

    if (round.status === 'hunt') {
      const mySticker = await Sticker.findOne({
        roundId: round._id,
        creatorId: req.user._id,
      });
      return res.json(mySticker ? [mySticker] : []);
    }

    if (round.status === 'voting') {
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
    if (!round || round.status !== 'hunt') {
      return res.status(400).json({ message: 'Can only delete during hunt phase' });
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
