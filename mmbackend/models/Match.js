const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mealTime: String,
    mealDate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "unmatched"],
      default: "active",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

const Match = mongoose.model("Match", matchSchema);

module.exports = Match;