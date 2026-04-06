const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
    },
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

module.exports = mongoose.model("Community", communitySchema);
