const mongoose = require("mongoose");

/**
 * Message — chat inside a thread.
 *
 * A thread is either a 1-on-1 Match or a group Community table, addressed by
 * (threadType, threadId). Keeping both in one collection means one polling
 * endpoint, one unread counter and one UI component serve both surfaces.
 *
 * Messages are slot-scoped in practice: when a slot expires the cleanup job
 * removes its threads, so chat never becomes a long-term data liability.
 */
const messageSchema = new mongoose.Schema(
  {
    threadType: {
      type: String,
      enum: ["match", "community"],
      required: true,
    },
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // "system" messages narrate state changes ("Aarav joined the table")
    kind: {
      type: String,
      enum: ["text", "system"],
      default: "text",
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Primary read pattern: newest messages in a thread, and polling by createdAt.
messageSchema.index({ threadType: 1, threadId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
