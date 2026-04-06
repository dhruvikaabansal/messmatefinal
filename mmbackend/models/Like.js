const mongoose = require("mongoose");

/**
 * Like — Records a directional like between two users within a specific slot.
 *
 * Likes are SLOT-SCOPED. A like in one slot does NOT affect another slot.
 * slotId format: "YYYY-MM-DD_mealType"
 */
const likeSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // 🔥 NEW: Slot-scoped likes
    slotId: {
      type: String,
      required: true,
      // e.g. "2026-04-07_lunch"
    },
    status: {
      type: String,
      enum: ["pending", "matched", "skipped"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Prevent a user from liking the same person twice in the same slot
// sparse: true means null/missing slotId entries are excluded from the unique check (backward compat)
likeSchema.index({ fromUser: 1, toUser: 1, slotId: 1 }, { unique: true, sparse: true });

// Fast lookup for reciprocal likes (mutual match detection)
likeSchema.index({ toUser: 1, slotId: 1 }, { sparse: true });

// Fast cleanup of expired slot likes
likeSchema.index({ slotId: 1 }, { sparse: true });

module.exports = mongoose.model("Like", likeSchema);
