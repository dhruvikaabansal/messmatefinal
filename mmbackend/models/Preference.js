const mongoose = require("mongoose");

/**
 * Preference — what the user wants for their CURRENT slot.
 *
 * Exactly one document per user (enforced by a unique index; the old build had
 * no such guard and duplicates were a real source of "my settings keep
 * reverting" bugs).
 *
 * `openTo` replaces the old groupSize hard-switch. Previously groupSize >= 3
 * completely disabled 1-on-1 matching — and new accounts were created with
 * groupSize 3, so a fresh user's Discover page was locked before they ever saw
 * it. Now the feed always shows both, and this is only a ranking/filter hint.
 */
const preferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
      required: true,
      default: "lunch",
    },

    mealDate: {
      type: String, // "YYYY-MM-DD" in IST
      required: true,
    },

    preferredGender: {
      type: String,
      enum: ["male", "female", "non-binary", "any"],
      default: "any",
    },

    openTo: {
      type: String,
      enum: ["both", "solo", "group"],
      default: "both",
    },

    /** Preferred table size when joining/creating a group. */
    groupSize: {
      type: Number,
      min: 2,
      max: 6,
      default: 4,
    },

    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Preference", preferenceSchema);
