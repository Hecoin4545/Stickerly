const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema(
  {
    roundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
    title: { type: String, default: '' },

    // For challenges mode: which challenge card this photo completes (null = stickerly mode)
    challengeIndex: { type: Number, default: null },

    // AI Verification results
    faceVerified: { type: Boolean, default: null },        // null = not checked, true/false = result
    gestureVerified: { type: Boolean, default: null },
    verificationReason: { type: String, default: '' },
    verificationConfidence: { type: Number, default: 0 },

    uploadedAt: { type: Date, default: Date.now },
    firstPlaceVotes: { type: Number, default: 0 },
    secondPlaceVotes: { type: Number, default: 0 },
    thirdPlaceVotes: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    finalRank: { type: Number, default: null },
    isEarlyBird: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sticker', stickerSchema);
