/**
 * Find & Click Challenge Routes
 *
 * Flow:
 * 1. Admin uploads a video/image → AI extracts items → stored as event "setup"
 * 2. Admin starts the event → first challenge goes "active" with a timer
 * 3. Players receive their clue, photograph the item, submit photo
 * 4. AI verifies face match + item match → pass/fail + points
 * 5. After timer expires (or admin advances), next challenge starts
 * 6. Repeats until all challenges done → event "completed"
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Room = require('../models/Room');
const User = require('../models/User');
const FindClickEvent = require('../models/FindClickEvent');
const { extractItemsFromImage, verifyFaceMatch, verifyItemMatch } = require('../services/geminiService');

const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'your_api_key';

// ── Helper: broadcast event state to room ────────────────────────────────────
function broadcastEvent(io, roomId, event) {
  if (io) {
    io.to(roomId.toString()).emit('findclick-update', { event: sanitizeEvent(event) });
  }
}

// Remove internal fields before sending to client
function sanitizeEvent(event) {
  const obj = event.toObject ? event.toObject() : { ...event };
  // Don't expose actualItem to players (only clue)
  if (obj.items) {
    obj.items = obj.items.map((item) => ({
      ...item,
      actualItem: undefined, // hide from client
    }));
  }
  return obj;
}

// ── POST /api/findclick/setup ─────────────────────────────────────────────────
// Admin uploads a video/image; AI extracts items to build the challenge pool
router.post('/setup', auth, upload.single('media'), async (req, res) => {
  try {
    const { roomId, pointsPerChallenge, challengeDurationSeconds } = req.body;
    if (!roomId) return res.status(400).json({ message: 'roomId required' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can set up Find & Click' });

    if (!req.file) return res.status(400).json({ message: 'Media file (image/video) is required' });

    // Build URL for the uploaded media
    let sourceUrl = req.file.path;
    let publicId = req.file.filename || '';
    if (!sourceUrl.startsWith('http')) {
      const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      sourceUrl = `${serverBase}/uploads/${req.file.filename}`;
    }

    // ── AI: Extract items from the uploaded media ────────────────────────
    console.log('[FindClick] Extracting items from media with AI...');
    const extractedClues = await extractItemsFromImage(sourceUrl);

    if (!extractedClues || extractedClues.length === 0) {
      return res.status(400).json({
        message: 'AI could not identify items from the uploaded media. Please try a different image.',
      });
    }
    // ────────────────────────────────────────────────────────────────────

    const durationSeconds = parseInt(challengeDurationSeconds) || 60;
    const pts = parseInt(pointsPerChallenge) || 10;

    const items = extractedClues.map((clue, i) => ({
      index: i + 1,
      clue: typeof clue === 'string' ? clue : clue.clue || `Item ${i + 1}`,
      actualItem: typeof clue === 'object' ? clue.actual || '' : '',
      durationSeconds,
      status: 'pending',
      startedAt: null,
      endsAt: null,
    }));

    // If there's already an active/setup event for this room, complete/replace it
    const existingEvent = await FindClickEvent.findOne({ roomId, status: { $in: ['setup', 'active'] } });
    if (existingEvent) {
      existingEvent.status = 'completed';
      existingEvent.completedAt = new Date();
      await existingEvent.save();
    }

    const event = await FindClickEvent.create({
      roomId,
      adminId: req.user._id,
      sourceImageUrl: sourceUrl,
      sourcePublicId: publicId,
      items,
      pointsPerChallenge: pts,
      status: 'setup',
    });

    // Store event ref on the room
    await Room.findByIdAndUpdate(roomId, { currentFindClickEventId: event._id });

    res.status(201).json({
      message: `Find & Click event created with ${items.length} challenges!`,
      event: sanitizeEvent(event),
      itemCount: items.length,
    });
  } catch (err) {
    console.error('[FindClick] Setup error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/findclick/:eventId/start ───────────────────────────────────────
// Admin starts the event: activates challenge #1 with timer
router.post('/:eventId/start', auth, async (req, res) => {
  try {
    const event = await FindClickEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const room = await Room.findById(event.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can start the event' });

    if (event.status !== 'setup') {
      return res.status(400).json({ message: 'Event is not in setup state' });
    }
    if (!event.items || event.items.length === 0) {
      return res.status(400).json({ message: 'No items in this event' });
    }

    const now = new Date();
    event.status = 'active';
    event.startedAt = now;
    event.currentChallengeIndex = 1;

    // Activate first challenge
    const firstItem = event.items.find((i) => i.index === 1);
    if (firstItem) {
      firstItem.status = 'active';
      firstItem.startedAt = now;
      firstItem.endsAt = new Date(now.getTime() + firstItem.durationSeconds * 1000);
    }

    await event.save();

    const io = req.app.get('io');
    broadcastEvent(io, event.roomId, event);
    if (io) {
      io.to(event.roomId.toString()).emit('findclick-challenge-start', {
        challengeIndex: 1,
        clue: firstItem?.clue,
        endsAt: firstItem?.endsAt,
        durationSeconds: firstItem?.durationSeconds,
      });
    }

    res.json({ message: 'Find & Click event started!', event: sanitizeEvent(event) });
  } catch (err) {
    console.error('[FindClick] Start error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/findclick/:eventId/next ────────────────────────────────────────
// Admin (or auto-timer) advances to the next challenge
router.post('/:eventId/next', auth, async (req, res) => {
  try {
    const event = await FindClickEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    const room = await Room.findById(event.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const isAdmin = room.adminId.toString() === req.user._id.toString();
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can advance challenges' });

    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Event is not active' });
    }

    // Complete current challenge
    const currentItem = event.items.find((i) => i.index === event.currentChallengeIndex);
    if (currentItem && currentItem.status === 'active') {
      currentItem.status = 'completed';
    }

    const nextIndex = event.currentChallengeIndex + 1;
    const nextItem = event.items.find((i) => i.index === nextIndex);

    if (!nextItem) {
      // All challenges done → complete event
      event.status = 'completed';
      event.completedAt = new Date();
      event.currentChallengeIndex = 0;
      await event.save();

      const io = req.app.get('io');
      broadcastEvent(io, event.roomId, event);
      if (io) {
        io.to(event.roomId.toString()).emit('findclick-event-complete', {
          eventId: event._id,
        });
      }

      return res.json({ message: 'All challenges complete! Event finished.', event: sanitizeEvent(event) });
    }

    // Activate next challenge
    const now = new Date();
    event.currentChallengeIndex = nextIndex;
    nextItem.status = 'active';
    nextItem.startedAt = now;
    nextItem.endsAt = new Date(now.getTime() + nextItem.durationSeconds * 1000);

    await event.save();

    const io = req.app.get('io');
    broadcastEvent(io, event.roomId, event);
    if (io) {
      io.to(event.roomId.toString()).emit('findclick-challenge-start', {
        challengeIndex: nextIndex,
        clue: nextItem.clue,
        endsAt: nextItem.endsAt,
        durationSeconds: nextItem.durationSeconds,
      });
    }

    res.json({ message: `Challenge ${nextIndex} started!`, event: sanitizeEvent(event) });
  } catch (err) {
    console.error('[FindClick] Next error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/findclick/:eventId/submit ──────────────────────────────────────
// Player submits a photo for the current challenge
router.post('/:eventId/submit', auth, upload.single('photo'), async (req, res) => {
  try {
    const event = await FindClickEvent.findById(req.params.eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.status !== 'active') {
      return res.status(400).json({ message: 'Event is not active' });
    }

    const room = await Room.findById(event.roomId);
    const isMember = room?.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not a member of this room' });

    const challengeIndex = event.currentChallengeIndex;
    const currentItem = event.items.find((i) => i.index === challengeIndex);

    if (!currentItem || currentItem.status !== 'active') {
      return res.status(400).json({ message: 'No active challenge right now' });
    }

    // Check deadline
    if (currentItem.endsAt && new Date() > new Date(currentItem.endsAt)) {
      return res.status(400).json({ message: 'Time is up for this challenge!' });
    }

    // Check if already submitted for this challenge
    const alreadySubmitted = event.submissions.some(
      (s) => s.userId.toString() === req.user._id.toString() && s.challengeIndex === challengeIndex
    );
    if (alreadySubmitted) {
      return res.status(409).json({ message: 'Already submitted for this challenge' });
    }

    if (!req.file) return res.status(400).json({ message: 'Photo is required' });

    // Build URL
    let photoUrl = req.file.path;
    let publicId = req.file.filename || '';
    if (!photoUrl.startsWith('http')) {
      const serverBase = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
      photoUrl = `${serverBase}/uploads/${req.file.filename}`;
    }

    // ── AI VERIFICATION ──────────────────────────────────────────────────
    const uploaderUser = await User.findById(req.user._id);
    let faceVerified = true;
    let itemVerified = false;
    let verificationReason = '';
    let confidence = 0;

    // 1. Face verification
    if (uploaderUser?.avatar && uploaderUser.avatar.trim()) {
      const faceResult = await verifyFaceMatch(uploaderUser.avatar, photoUrl);
      faceVerified = faceResult.passed;
      if (!faceVerified && faceResult.confidence > 60) {
        return res.status(400).json({
          message: 'Photo verification failed: You must be in the photo!',
          verificationResult: faceResult,
        });
      }
    }

    // 2. Item match verification
    const itemResult = await verifyItemMatch(photoUrl, currentItem.clue, currentItem.actualItem);
    itemVerified = itemResult.passed;
    verificationReason = itemResult.reason;
    confidence = itemResult.confidence;
    // ────────────────────────────────────────────────────────────────────

    const pointsAwarded = itemVerified ? event.pointsPerChallenge : 0;

    // Add submission to event
    event.submissions.push({
      userId: req.user._id,
      challengeIndex,
      imageUrl: photoUrl,
      publicId,
      verificationResult: {
        passed: itemVerified,
        confidence,
        reason: verificationReason,
      },
      faceVerified,
      submittedAt: new Date(),
      pointsAwarded,
    });

    await event.save();

    // Award points if verified
    if (itemVerified) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { totalPoints: pointsAwarded } });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(event.roomId.toString()).emit('findclick-submission', {
        userId: req.user._id,
        username: uploaderUser?.username,
        challengeIndex,
        passed: itemVerified,
        confidence,
      });
    }

    res.status(201).json({
      passed: itemVerified,
      reason: verificationReason,
      confidence,
      pointsAwarded,
      message: itemVerified
        ? `🎉 Correct! +${pointsAwarded} points!`
        : `❌ Not quite right. ${verificationReason}`,
    });
  } catch (err) {
    console.error('[FindClick] Submit error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/findclick/room/:roomId/current ───────────────────────────────────
// Get the current Find & Click event for a room
router.get('/room/:roomId/current', auth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (!room.currentFindClickEventId) {
      return res.status(404).json({ message: 'No active Find & Click event' });
    }

    const event = await FindClickEvent.findById(room.currentFindClickEventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // For the current user, include their own submissions
    const mySubmissions = event.submissions.filter(
      (s) => s.userId.toString() === req.user._id.toString()
    );

    const isAdmin = room.adminId.toString() === req.user._id.toString();

    res.json({
      event: sanitizeEvent(event),
      mySubmissions,
      isAdmin,
    });
  } catch (err) {
    console.error('[FindClick] Get current error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/findclick/:eventId/leaderboard ───────────────────────────────────
// Get leaderboard for a Find & Click event
router.get('/:eventId/leaderboard', auth, async (req, res) => {
  try {
    const event = await FindClickEvent.findById(req.params.eventId).populate(
      'submissions.userId',
      'username avatar'
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Aggregate points per user
    const userPoints = {};
    for (const sub of event.submissions) {
      const uid = sub.userId?._id?.toString() || sub.userId?.toString();
      if (!uid) continue;
      if (!userPoints[uid]) {
        userPoints[uid] = {
          userId: uid,
          username: sub.userId?.username || 'Unknown',
          avatar: sub.userId?.avatar || '',
          totalPoints: 0,
          completedCount: 0,
        };
      }
      if (sub.verificationResult?.passed) {
        userPoints[uid].totalPoints += sub.pointsAwarded || 0;
        userPoints[uid].completedCount += 1;
      }
    }

    const leaderboard = Object.values(userPoints).sort((a, b) => b.totalPoints - a.totalPoints);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
