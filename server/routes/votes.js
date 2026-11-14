const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Vote = require('../models/Vote');
const Round = require('../models/Round');
const Room = require('../models/Room');
const Sticker = require('../models/Sticker');

// POST /api/votes/submit
router.post('/submit', auth, async (req, res) => {
  try {
    const { roundId, roomId, ballot } = req.body;

    const round = await Round.findById(roundId);
    if (!round || round.status !== 'voting') {
      return res.status(400).json({ message: 'Round is not in voting phase' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isMember = room.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    if (!Array.isArray(ballot) || ballot.length !== 3) {
      return res.status(400).json({ message: 'Ballot must have exactly 3 entries' });
    }

    const ranks = ballot.map((b) => b.rank).sort();
    if (JSON.stringify(ranks) !== JSON.stringify([1, 2, 3])) {
      return res.status(400).json({ message: 'Ballot must contain unique ranks 1, 2, and 3' });
    }

    const stickerIds = ballot.map((b) => b.stickerId);
    const ownedStickers = await Sticker.find({
      _id: { $in: stickerIds },
      creatorId: req.user._id,
    });
    if (ownedStickers.length > 0) {
      return res.status(400).json({ message: 'Cannot vote for your own sticker' });
    }

    const vote = await Vote.findOneAndUpdate(
      { roundId, voterId: req.user._id },
      { roundId, roomId, voterId: req.user._id, ballot, submittedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(vote);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/votes/:roundId/my-ballot
router.get('/:roundId/my-ballot', auth, async (req, res) => {
  try {
    const vote = await Vote.findOne({ roundId: req.params.roundId, voterId: req.user._id });
    if (!vote) return res.status(404).json({ message: 'No ballot found' });
    res.json(vote);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
