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

    let round = await Round.findById(roundId);
    if (!round || round.status !== 'voting_open') {
      return res.status(400).json({ message: 'Round is not in voting phase' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isMember = room.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    const isSoloRoom = room.members.length === 1;
    const votableCount = isSoloRoom
      ? await Sticker.countDocuments({ roundId })
      : await Sticker.countDocuments({ roundId, creatorId: { $ne: req.user._id } });

    const maxAllowed = Math.min(3, Math.max(1, votableCount));

    if (!Array.isArray(ballot) || ballot.length === 0) {
      return res.status(400).json({
        message: 'Ballot must have at least 1 entry',
      });
    }

    // Allow partial ballots: user can rank 1, 2, or up to maxAllowed stickers
    // but cannot rank more than maxAllowed
    const filteredBallot = ballot.filter((b) => b.stickerId).slice(0, maxAllowed);
    if (filteredBallot.length === 0) {
      return res.status(400).json({ message: 'Please rank at least one sticker' });
    }

    // Re-assign consecutive ranks based on what was submitted
    const rerankedBallot = filteredBallot.map((b, i) => ({ ...b, rank: i + 1 }));

    if (!rerankedBallot.some((b) => b.rank === 1)) {
      return res.status(400).json({ message: 'Ballot must include a 1st place selection' });
    }

    const stickerIds = rerankedBallot.map((b) => b.stickerId);
    const uniqueIds = new Set(stickerIds.map((id) => id.toString()));
    if (uniqueIds.size !== rerankedBallot.length) {
      return res.status(400).json({ message: 'Cannot assign multiple ranks to the same sticker' });
    }

    const validRoundStickers = await Sticker.countDocuments({
      _id: { $in: stickerIds },
      roundId,
    });
    if (validRoundStickers !== rerankedBallot.length) {
      return res.status(400).json({ message: 'One or more stickers do not belong to this round' });
    }

    if (!isSoloRoom) {
      const ownedStickers = await Sticker.find({
        _id: { $in: stickerIds },
        creatorId: req.user._id,
      });
      if (ownedStickers.length > 0) {
        return res.status(400).json({ message: 'Cannot vote for your own sticker' });
      }
    }

    const vote = await Vote.findOneAndUpdate(
      { roundId, voterId: req.user._id },
      { roundId, roomId, voterId: req.user._id, ballot: rerankedBallot, submittedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ...vote.toObject(), roundStatus: round.status });
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
