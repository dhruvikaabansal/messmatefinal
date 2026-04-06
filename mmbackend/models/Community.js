const mongoose = require("mongoose");

/**
 * Community — A group meal table created by a user.
 *
 * Communities are SLOT-SCOPED and TEMPORARY.
 * They expire when the slot ends (via cleanup job).
 * slotId format: "YYYY-MM-DD_mealType"
 */
const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
    },
    // 🔥 NEW: Canonical slot identifier (replaces separate mealTime + mealDate queries)
    slotId: {
      type: String,
      // Not required — backward compat with existing communities
    },
    // Retained for human-readable display
    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
      required: true,
    },
    college: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    mealDate: {
      type: String,
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
      maxlength: 200,
    },
    interests: {
      type: [String],
      default: [],
    },
    maxMembers: {
      type: Number,
      default: 4,
      min: 2,
      max: 10,
    },
  },
  { timestamps: true }
);

// Fast discovery by slot + college (most common query)
communitySchema.index({ slotId: 1, college: 1 });

// Fast cleanup of expired communities
communitySchema.index({ slotId: 1 });

module.exports = mongoose.model("Community", communitySchema);
