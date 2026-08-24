const mongoose = require("mongoose");

/**
 * Community — an open group table for one slot. Ephemeral: removed when the
 * slot expires.
 */
const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Table name is required"],
      trim: true,
      maxlength: 60,
    },
    slotId: { type: String, required: true, index: true },
    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
      required: true,
    },
    mealDate: { type: String, required: true },
    college: { type: String, required: true, trim: true, lowercase: true },

    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    description: { type: String, maxlength: 200, default: "" },
    interests: { type: [String], default: [] },

    /** Where the table is meeting — the thing people actually need to know. */
    venue: { type: String, maxlength: 80, default: "" },

    maxMembers: { type: Number, default: 4, min: 2, max: 8 },

    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
  },
  { timestamps: true }
);

communitySchema.index({ slotId: 1, college: 1 });
communitySchema.index({ members: 1 });

module.exports = mongoose.model("Community", communitySchema);
