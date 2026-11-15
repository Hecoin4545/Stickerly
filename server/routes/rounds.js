const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const Round = require('../models/Round');
const {
  syncRoundStatus,
  completeRound,
  createRoundForRoom,
} = require('../services/roundService');

// GET /api/rounds/:roomId/current
router.get('/:roomId/current', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!room.currentRoundId) return res.status(404).json({ message: 'No active round' });

    const io = req.app.get('io');
    await syncRoundStatus(room.currentRoundId, io);

    const round = await Round.findById(room.currentRoundId).populate(
      'targetUserId',
      'username avatar'
    );
    if (!round) return res.status(404).json({ message: 'Round not found' });

    res.json(round);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/rounds/:roomId/history
router.get('/:roomId/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [rounds, total] = await Promise.all([
      Round.find({ roomId: req.params.roomId, status: 'completed' })
        .populate('targetUserId', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Round.countDocuments({ roomId: req.params.roomId, status: 'completed' }),
    ]);

    res.json({ rounds, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rounds/:roomId/start - manual / round start
router.post('/:roomId/start', auth, async (req, res) => {
  try {
    const round = await createRoundForRoom(req.params.roomId);
    const populated = await Round.findById(round._id).populate('targetUserId', 'username avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.roomId).emit('phase-change', { phase: 'hunt' });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Server error' });
  }
});

// POST /api/rounds/:roomId/advance - test helper to advance phase
router.post('/:roomId/advance', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room || !room.currentRoundId) {
      return res.status(404).json({ message: 'No active round found' });
    }

    const round = await Round.findById(room.currentRoundId);
    if (!round) return res.status(404).json({ message: 'Round not found' });

    const io = req.app.get('io');

    if (round.status === 'hunt') {
      round.status = 'voting';
      round.votingStart = new Date();
      await round.save();
      if (io) io.to(room._id.toString()).emit('phase-change', { phase: 'voting' });
      return res.json({ message: 'Advanced to voting phase', round });
    }

    if (round.status === 'voting') {
      const completed = await completeRound(round._id, io);
      return res.json({ message: 'Round completed and tallied', round: completed });
    }

    res.json({ message: 'Round is already completed', round });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
