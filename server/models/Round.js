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

const roundSchema = new mongoose.Schema(
  {
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roundNumber: { type: Number, required: true },
    theme: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    huntStart: { type: Date },
    huntDeadline: { type: Date },
    votingStart: { type: Date },
    votingEnd: { type: Date },
    status: {
      type: String,
      enum: ['hunt', 'voting', 'completed'],
      default: 'hunt',
    },
    submissionCount: { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

roundSchema.statics.THEMES = THEMES;

module.exports = mongoose.model('Round', roundSchema);
