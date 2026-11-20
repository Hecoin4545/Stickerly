const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    voterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ballot: [
      {
        stickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sticker', required: true },
        rank: { type: Number, enum: [1, 2, 3], required: true },
      },
    ],
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

voteSchema.index({ roundId: 1, voterId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
