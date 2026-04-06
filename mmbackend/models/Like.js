const mongoose = require("mongoose");

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
    status: {
      type: String,
      enum: ["pending", "matched", "skipped"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Like", likeSchema);
