const mongoose = require("mongoose");

/**
 * Match — a confirmed 1-on-1 meal between two users, scoped to one slot.
 * Dissolved automatically when the slot expires (see utils/cleanup.js).
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
    slotId: { type: String, index: true },
    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
    },
    mealDate: { type: String },
    status: {
      type: String,
      enum: ["active", "completed", "expired", "cancelled"],
      default: "active",
    },
    /** Sorting + unread badges in the Matches list without a second query. */
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
  },
  { timestamps: true }
);

matchSchema.index({ users: 1, status: 1 });
matchSchema.index({ slotId: 1, status: 1 });

module.exports = mongoose.model("Match", matchSchema);
