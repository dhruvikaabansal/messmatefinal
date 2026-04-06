const mongoose = require("mongoose");

const preferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    mealTime: {
      type: String,
      enum: ["breakfast", "lunch", "snacks", "dinner"],
      required: true,
    },

    preferredGender: {
      type: String,
      enum: ["male", "female", "any"],
      default: "any",
    },

    groupSize: {
      type: Number,
      min: 2,
      max: 4,
      required: true,
    },
    mealDate: {
      type: String,
      required: true,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Preference = mongoose.model("Preference", preferenceSchema);

module.exports = Preference;