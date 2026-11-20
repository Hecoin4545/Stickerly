const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, length: 6 },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mode: { type: String, enum: ['stickerly', 'challenges'], default: 'stickerly' },
    currentRoundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', default: null },
    recentTargets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    fairnessLock: { type: Boolean, default: true },
    season: { type: Number, default: 1 },
    week: { type: Number, default: 1 },
    totalRounds: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);
