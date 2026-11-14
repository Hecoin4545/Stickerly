const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const Round = require('../models/Round');
const Sticker = require('../models/Sticker');
const Vote = require('../models/Vote');
const User = require('../models/User');

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const setTime = (date, h, m, s) => {
  const d = new Date(date);
  d.setHours(h, m, s, 0);
  return d;
};

// GET /api/rounds/:roomId/current
router.get('/:roomId/current', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!room.currentRoundId) return res.status(404).json({ message: 'No active round' });

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

// POST /api/rounds/:roomId/start - manual / initial round start
router.post('/:roomId/start', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate('members');
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (room.members.length < 1) {
      return res.status(400).json({ message: 'Need at least 1 member to start a round' });
    }

    // Pick target (excluding recentTargets if fairnessLock is on and members > 1)
    let eligible = room.members;
    if (room.fairnessLock && room.recentTargets.length > 0 && room.members.length > 1) {
      const recentIds = room.recentTargets.map((id) => id.toString());
      const filtered = room.members.filter((m) => !recentIds.includes(m._id.toString()));
      if (filtered.length > 0) eligible = filtered;
    }
    const target = randomFrom(eligible);

    // Pick theme
    const usedRounds = await Round.find({ roomId: room._id }).select('theme');
    const usedThemes = usedRounds.map((r) => r.theme);
    const availableThemes = Round.THEMES.filter((t) => !usedThemes.includes(t));
    const themePool = availableThemes.length > 0 ? availableThemes : Round.THEMES;
    const theme = randomFrom(themePool);

    const now = new Date();
    const huntStart = now;
    const huntDeadline = setTime(now, 22, 0, 0);
    // If past 22:00 today, set huntDeadline 22 hours from now
    if (huntDeadline <= now) {
      huntDeadline.setDate(huntDeadline.getDate() + 1);
    }
    const votingStart = new Date(huntDeadline);
    const votingEnd = new Date(huntDeadline);
    votingEnd.setHours(23, 59, 59, 999);

    const roundNumber = (room.totalRounds || 0) + 1;

    const round = await Round.create({
      roomId: room._id,
      roundNumber,
      theme,
      targetUserId: target._id,
      huntStart,
      huntDeadline,
      votingStart,
      votingEnd,
      status: 'hunt',
      participantCount: room.members.length,
    });

    let recentTargets = [...room.recentTargets.map((id) => id.toString())];
    recentTargets.push(target._id.toString());
    if (recentTargets.length > 3) recentTargets = recentTargets.slice(-3);

    await Room.findByIdAndUpdate(room._id, {
      currentRoundId: round._id,
      recentTargets,
      $inc: { totalRounds: 1 },
    });

    await User.findByIdAndUpdate(target._id, { $inc: { timesTargeted: 1 } });

    const populated = await Round.findById(round._id).populate('targetUserId', 'username avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rounds/:roomId/advance - demo / test helper to advance phase
router.post('/:roomId/advance', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room || !room.currentRoundId) {
      return res.status(404).json({ message: 'No active round found' });
    }

    const round = await Round.findById(room.currentRoundId);
    if (!round) return res.status(404).json({ message: 'Round not found' });

    if (round.status === 'hunt') {
      round.status = 'voting';
      await round.save();
      return res.json({ message: 'Advanced to voting phase', round });
    }

    if (round.status === 'voting') {
      // Tally votes
      const votes = await Vote.find({ roundId: round._id });
      const pointsMap = {};

      for (const vote of votes) {
        for (const entry of vote.ballot) {
          const sid = entry.stickerId.toString();
          if (!pointsMap[sid]) pointsMap[sid] = { first: 0, second: 0, third: 0, total: 0 };
          if (entry.rank === 1) {
            pointsMap[sid].first += 1;
            pointsMap[sid].total += 5;
          } else if (entry.rank === 2) {
            pointsMap[sid].second += 1;
            pointsMap[sid].total += 3;
          } else if (entry.rank === 3) {
            pointsMap[sid].third += 1;
            pointsMap[sid].total += 1;
          }
        }
      }

      const stickers = await Sticker.find({ roundId: round._id });
      const sortedStickers = stickers
        .map((s) => {
          const pts = pointsMap[s._id.toString()] || { first: 0, second: 0, third: 0, total: 0 };
          return { sticker: s, ...pts };
        })
        .sort((a, b) => b.total - a.total);

      for (let i = 0; i < sortedStickers.length; i++) {
        const { sticker, first, second, third, total } = sortedStickers[i];
        const finalRank = i + 1;
        const totalAwarded = total + 2 + (sticker.isEarlyBird ? 1 : 0);

        await Sticker.findByIdAndUpdate(sticker._id, {
          firstPlaceVotes: first,
          secondPlaceVotes: second,
          thirdPlaceVotes: third,
          totalPoints: total,
          finalRank,
        });

        await User.findByIdAndUpdate(sticker.creatorId, {
          $inc: { totalPoints: totalAwarded, ...(finalRank <= 3 ? { podiums: 1 } : {}) },
        });
      }

      round.status = 'completed';
      await round.save();

      return res.json({ message: 'Round completed and tallied', round });
    }

    res.json({ message: 'Round is already completed', round });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
