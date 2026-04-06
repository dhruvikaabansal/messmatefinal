const mongoose = require("mongoose");

/**
 * UserSlotState — The single source of truth for every user's state in every slot.
 *
 * One document exists per (userId, slotId) pair.
 * State is the ONLY thing that controls what a user can do.
 *
 * States:
 *   idle         — can see profiles, like, create/join community
 *   liked        — same as idle, but has pending likes in/out
 *   matched      — locked into 1-on-1 match (chat only)
 *   in_community — part of a group meal (no further likes/matches)
 */
const userSlotStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    slotId: {
      type: String,
      required: true,
      // Format: "YYYY-MM-DD_mealType" e.g. "2026-04-07_lunch"
    },
    state: {
      type: String,
      enum: ["idle", "liked", "matched", "in_community"],
      default: "idle",
    },
    // Populated when state === "matched"
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    // Populated when state === "in_community"
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ─── INDEXES ─────────────────────────────────────────────────────────────────
// Prevents duplicate state rows per user per slot (enforces single state rule)
userSlotStateSchema.index({ userId: 1, slotId: 1 }, { unique: true });

// Fast querying all states for a given slot (used by cleanup + discovery)
userSlotStateSchema.index({ slotId: 1 });

// Fast querying by matchId or communityId (used by unmatch / dissolve)
userSlotStateSchema.index({ matchId: 1 });
userSlotStateSchema.index({ communityId: 1 });

module.exports = mongoose.model("UserSlotState", userSlotStateSchema);
