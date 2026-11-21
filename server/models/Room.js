const mongoose = require('mongoose');

const memberPointsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  points: { type: Number, default: 0 },
  podiums: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
}, { _id: false });

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, length: 6 },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Per-room points tracking
    memberPoints: [memberPointsSchema],
    // 'stickerly' | 'challenges' | 'findclick'
    mode: { type: String, enum: ['stickerly', 'challenges', 'findclick'], default: 'stickerly' },
    currentRoundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', default: null },
    // Active Find & Click event id (if mode=findclick)
    currentFindClickEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'FindClickEvent', default: null },
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
