const mongoose = require('mongoose');

/**
 * FindClickEvent — a "Find & Click" challenge event within a room.
 * Admin uploads a source video/image → AI extracts items → players photograph items within time limits.
 */

const findClickChallengeSchema = new mongoose.Schema({
  index: { type: Number, required: true },            // 1-based challenge number
  clue: { type: String, required: true },             // The sentence/clue shown to players
  actualItem: { type: String, default: '' },          // The actual item (admin context, not shown)
  durationSeconds: { type: Number, default: 60 },     // Time limit set by admin
  startedAt: { type: Date, default: null },           // When this challenge became active
  endsAt: { type: Date, default: null },              // Computed deadline
  status: {
    type: String,
    enum: ['pending', 'active', 'completed'],
    default: 'pending',
  },
}, { _id: false });

const findClickSubmissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challengeIndex: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  publicId: { type: String, default: '' },
  verificationResult: {
    passed: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    reason: { type: String, default: '' },
  },
  faceVerified: { type: Boolean, default: false },
  submittedAt: { type: Date, default: Date.now },
  pointsAwarded: { type: Number, default: 0 },
}, { _id: true, timestamps: false });

const findClickEventSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Source media uploaded by admin
  sourceVideoUrl: { type: String, default: '' },
  sourceImageUrl: { type: String, default: '' },
  sourcePublicId: { type: String, default: '' },

  // The pool of challenge items extracted by AI from the source video/image
  items: [findClickChallengeSchema],

  // Submissions from all players
  submissions: [findClickSubmissionSchema],

  // Which challenge is currently active (1-based index, 0 = not started)
  currentChallengeIndex: { type: Number, default: 0 },

  // Event lifecycle
  status: {
    type: String,
    enum: ['setup', 'active', 'completed'],
    default: 'setup',
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },

  // Per-challenge points
  pointsPerChallenge: { type: Number, default: 10 },
}, { timestamps: true });

module.exports = mongoose.model('FindClickEvent', findClickEventSchema);
