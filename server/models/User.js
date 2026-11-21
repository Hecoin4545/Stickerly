const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Profile photo — MANDATORY. Stored as URL.
    avatar: { type: String, required: true, default: '' },
    totalPoints: { type: Number, default: 0 },
    podiums: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    badges: [{ type: String }],
    timesTargeted: { type: Number, default: 0 },
    roomIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
