const mongoose = require('mongoose');

const THEMES = [
  'Caught Yawning or Mid-Stretch',
  'Sleeping or Napping Anywhere',
  'Eating Messily',
  'Deep in Phone Scroll Mode',
  'Mid-Laugh Chaos',
  'Confused / Blank Stare',
  'Dramatic Reaction Face',
  'Hair Everywhere',
  'Cozy Mode (blanket/slippers)',
  'Background Photobomb',
  'Caught Working Too Hard',
  'Victory Pose Gone Wrong',
  'Suspicious Side-Eye',
  'Monday Morning Survival Mode',
  'Caught Red-Handed Snacking',
];

const challengeCardSchema = new mongoose.Schema({
  index: { type: Number, required: true },
  conversationTopic: { type: String, required: true },
  poseDescription: { type: String, required: true },
  poseEmoji: { type: String, default: '📸' },
}, { _id: false });

const roundSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    mode: { type: String, enum: ['stickerly', 'challenges'], default: 'stickerly' },
    roundNumber: { type: Number, required: true },
    // Stickerly mode fields
    theme: { type: String, default: '' },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Challenges mode fields
    adminTopic: { type: String, default: '' },
    challenges: [challengeCardSchema],
    // Phase control (admin-driven)
    huntStart: { type: Date },
    huntDeadline: { type: Date },
    votingStart: { type: Date },
    votingEnd: { type: Date },
    status: {
      type: String,
      enum: ['waiting', 'uploads_open', 'voting_open', 'completed'],
      default: 'uploads_open',
    },
    submissionCount: { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

roundSchema.statics.THEMES = THEMES;

module.exports = mongoose.model('Round', roundSchema);
