const mongoose = require("mongoose");

/**
 * Match — A confirmed 1-on-1 meal match between two users.
 *
 * Matches are SLOT-SCOPED and TEMPORARY.
 * They are automatically dissolved when the slot expires (via cleanup job).
 * slotId format: "YYYY-MM-DD_mealType"
 */
const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // 🔥 NEW: Canonical slot identifier
    slotId: {
      type: String,
      // Not required — backward compat with old match documents
    },
    // Retained for backward compatibility and human-readable queries
    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
    },
    mealDate: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "completed", "expired"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Fast lookup by slotId (used by cleanup + exclusivity checks)
matchSchema.index({ slotId: 1 });

// Fast lookup by user (used by getCandidates to check if user is matched)
matchSchema.index({ users: 1, status: 1 });

module.exports = mongoose.model("Match", matchSchema);