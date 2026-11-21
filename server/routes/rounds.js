const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const Round = require('../models/Round');
const Sticker = require('../models/Sticker');
const Vote = require('../models/Vote');
const User = require('../models/User');
const { completeRound, syncRoundStatus } = require('../services/roundService');

// ─── Challenge generation helpers ───────────────────────────────────────────

const TOPIC_QUESTIONS = [
  (t) => `Go to someone and ask what their craziest or funniest experience with "${t}" has been.`,
  (t) => `Find someone and discuss: what's one secret tip, hack, or unpopular opinion they have about "${t}"?`,
  (t) => `Ask someone: if they had to write a headline or book title about "${t}", what would it be?`,
  (t) => `Find someone and ask: what was their first ever memory or introduction to "${t}"?`,
  (t) => `Ask someone to confess the most embarrassing or hilarious mistake they've made related to "${t}".`,
  (t) => `Go to someone and debate: what is the most overrated vs underrated thing about "${t}"?`,
  (t) => `Ask someone: if "${t}" disappeared tomorrow, how would their life change?`,
  (t) => `Find someone and ask who in their life cares the most (or least!) about "${t}" and why.`,
  (t) => `Go to someone and ask: if they could change one rule or thing about "${t}", what would it be?`,
  (t) => `Ask someone to describe their ultimate dream scenario involving "${t}".`,
  (t) => `Find someone and ask: what question about "${t}" have they always wanted answered?`,
  (t) => `Go to someone and ask them to rate their passion for "${t}" from 1 to 10 and justify it!`,
];

const TWO_PEOPLE_POSES = [
  { poseDescription: 'The "Secret Agents": Stand back-to-back with serious poker faces and finger guns ready.', poseEmoji: '🕵️‍♂️🕵️‍♀️' },
  { poseDescription: 'The "Spider-Man Meme": Point at each other with dramatic shocked expressions.', poseEmoji: '👈👉' },
  { poseDescription: 'The "Statue & Tourist": One person freezes like a museum statue, the other takes an awkward selfie with them.', poseEmoji: '🗿🤳' },
  { poseDescription: 'The "Superhero Duo Landing": One person takes a low knee landing, the other stands tall with fists clenched.', poseEmoji: '🦸‍♂️🦸‍♀️' },
  { poseDescription: 'The "Awkward Prom Pose": Stand together stiffly with forced nervous smiles and awkward thumbs-up.', poseEmoji: '🕺💃' },
  { poseDescription: 'The "Juicy Gossip Gasp": One person whispers dramatically into the other\'s ear while they gasp in shock.', poseEmoji: '🤫😱' },
  { poseDescription: 'The "Mid-Air High Five Freeze": Pose frozen in time right at the contact point of an epic high-five.', poseEmoji: '✋💥' },
  { poseDescription: 'The "Rock-Paper-Scissors Sudden Death": Throw down rock-paper-scissors with intense anime staredown faces.', poseEmoji: '✊✌️' },
  { poseDescription: 'The "Titanic Bow": One person stands behind holding the other\'s arms spread wide toward the horizon.', poseEmoji: '🚢🌊' },
  { poseDescription: 'The "Mirror Mimic": Copy each other\'s weirdest and most goofy face perfectly.', poseEmoji: '🪞🤪' },
  { poseDescription: 'The "Dramatic Soap Opera Showdown": One person holds back tears while the other points accusingly.', poseEmoji: '🎭😤' },
  { poseDescription: 'The "Invisible Heavy Trophy": Both struggle to hold an invisible 200-pound golden trophy together.', poseEmoji: '🏆💪' },
];

function generateChallenges(adminTopic) {
  const cleanTopic = (adminTopic || 'life & fun').trim();
  const shuffledConvos = [...TOPIC_QUESTIONS].sort(() => Math.random() - 0.5);
  const shuffledPoses = [...TWO_PEOPLE_POSES].sort(() => Math.random() - 0.5);

  return Array.from({ length: 10 }, (_, i) => ({
    index: i + 1,
    conversationTopic: shuffledConvos[i % shuffledConvos.length](cleanTopic),
    poseDescription: shuffledPoses[i % shuffledPoses.length].poseDescription,
    poseEmoji: shuffledPoses[i % shuffledPoses.length].poseEmoji,
  }));
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// GET /api/rounds/:roomId/current
router.get('/:roomId/current', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!room.currentRoundId) return res.status(404).json({ message: 'No active round' });

    const round = await Round.findById(room.currentRoundId).populate('targetUserId', 'username avatar');
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

// POST /api/rounds/:roomId/start-event
// Admin starts the event — creates a new round and opens uploads
router.post('/:roomId/start-event', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate('members');
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can start the event' });

    if (!room.members || room.members.length < 1) {
      return res.status(400).json({ message: 'Need at least 1 member to start an event' });
    }

    // Complete existing active round if any
    if (room.currentRoundId) {
      const existing = await Round.findById(room.currentRoundId);
      if (existing && existing.status !== 'completed') {
        existing.status = 'completed';
        await existing.save();
      }
    }

    const roundNumber = (room.totalRounds || 0) + 1;
    const mode = room.mode || 'stickerly';

    let roundData = {
      roomId: room._id,
      mode,
      roundNumber,
      status: 'uploads_open',
      participantCount: room.members.length,
      huntStart: new Date(),
    };

    if (mode === 'challenges') {
      const { topic } = req.body;
      if (!topic || !topic.trim()) {
        return res.status(400).json({ message: 'Please provide a topic for the challenges' });
      }

      // ── RANDOMLY SELECT TARGET from group members ─────────────────────
      const eligibleMembers = room.members;
      const randomTarget = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
      roundData.targetUserId = randomTarget._id;
      await User.findByIdAndUpdate(randomTarget._id, { $inc: { timesTargeted: 1 } });
      // ───────────────────────────────────────────────────────────────────

      roundData.adminTopic = topic.trim();
      roundData.challenges = generateChallenges(topic.trim());
      roundData.theme = `Challenges: ${topic.trim()}`;
    } else {
      // Stickerly mode: pick a fun theme
      const usedRounds = await Round.find({ roomId: room._id }).select('theme');
      const usedThemes = usedRounds.map((r) => r.theme);
      const availableThemes = Round.THEMES.filter((t) => !usedThemes.includes(t));
      const themePool = availableThemes.length > 0 ? availableThemes : Round.THEMES;
      roundData.theme = themePool[Math.floor(Math.random() * themePool.length)];
    }

    const round = await Round.create(roundData);

    await Room.findByIdAndUpdate(room._id, {
      currentRoundId: round._id,
      $inc: { totalRounds: 1 },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.roomId).emit('phase-change', { phase: 'uploads_open', round });
    }

    const populated = await Round.findById(round._id).populate('targetUserId', 'username avatar');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rounds/:roomId/close-uploads
// Admin closes upload phase → opens voting
router.post('/:roomId/close-uploads', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can close uploads' });

    if (!room.currentRoundId) return res.status(404).json({ message: 'No active round' });

    const round = await Round.findById(room.currentRoundId);
    if (!round || round.status !== 'uploads_open') {
      return res.status(400).json({ message: 'Uploads are not currently open' });
    }

    // Check there's at least one sticker
    const stickerCount = await Sticker.countDocuments({ roundId: round._id });
    if (stickerCount === 0) {
      return res.status(400).json({ message: 'At least one sticker must be uploaded before closing' });
    }

    round.status = 'voting_open';
    round.votingStart = new Date();
    await round.save();

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.roomId).emit('phase-change', { phase: 'voting_open' });
    }

    res.json({ message: 'Voting is now open!', round });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rounds/:roomId/close-voting
// Admin closes voting → shows leaderboard (completes round)
router.post('/:roomId/close-voting', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can close voting' });

    if (!room.currentRoundId) return res.status(404).json({ message: 'No active round' });

    const round = await Round.findById(room.currentRoundId);
    if (!round || round.status !== 'voting_open') {
      return res.status(400).json({ message: 'Voting is not currently open' });
    }

    const io = req.app.get('io');
    const completed = await completeRound(round._id, io);

    res.json({ message: 'Voting closed! Check the leaderboard.', round: completed });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
