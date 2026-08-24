/**
 * chatController.js — messaging for both 1-on-1 matches and group tables.
 *
 * One thread abstraction covers both: (threadType, threadId). Access is
 * re-verified on every call from the underlying Match/Community membership, so
 * a thread id alone is never enough to read someone's conversation.
 *
 * Delivery is short-poll (GET with ?after=<iso>), which needs no websocket
 * infrastructure, survives serverless hosting, and is more than fast enough for
 * "where are you sitting?".
 */

const mongoose = require("mongoose");
const Message = require("../models/Message");
const Match = require("../models/Match");
const Community = require("../models/Community");
const User = require("../models/User");

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

/**
 * Confirm the caller belongs to the thread and return its participants.
 */
const authorizeThread = async (userId, threadType, threadId) => {
  if (!["match", "community"].includes(threadType) || !isId(threadId)) return null;

  if (threadType === "match") {
    const match = await Match.findOne({ _id: threadId, users: userId }).lean();
    if (!match) return null;
    if (match.status === "expired" || match.status === "cancelled") return null;
    return { doc: match, participants: match.users, model: Match, title: "match" };
  }

  const community = await Community.findOne({ _id: threadId, members: userId }).lean();
  if (!community) return null;
  return { doc: community, participants: community.members, model: Community, title: community.name };
};

// ─── GET MESSAGES ───────────────────────────────────────────────────────────

/**
 * GET /api/chat/:threadType/:threadId?after=<ISO timestamp>
 * Without `after` returns the last 100 messages; with it, only what's new —
 * so the polling loop stays cheap.
 */
const getMessages = async (req, res) => {
  try {
    const { threadType, threadId } = req.params;
    const thread = await authorizeThread(req.user._id, threadType, threadId);
    if (!thread) return res.status(403).json({ message: "You're not in this conversation." });

    const query = { threadType, threadId };
    if (req.query.after) {
      const after = new Date(req.query.after);
      if (!Number.isNaN(after.getTime())) query.createdAt = { $gt: after };
    }

    const messages = await Message.find(query)
      .populate("sender", "name profilePic")
      .sort({ createdAt: 1 })
      .limit(req.query.after ? 200 : 100)
      .lean();

    // Mark everything visible as read for this user.
    await Message.updateMany(
      { threadType, threadId, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    return res.json({
      threadType,
      threadId,
      title: thread.title,
      messages: messages.map((m) => ({
        _id: m._id,
        text: m.text,
        kind: m.kind,
        createdAt: m.createdAt,
        mine: m.sender?._id?.toString() === req.user._id.toString(),
        sender: m.sender ? { _id: m.sender._id, name: m.sender.name, profilePic: m.sender.profilePic } : null,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[chatController] getMessages:", err);
    return res.status(500).json({ message: "Couldn't load messages." });
  }
};

// ─── SEND MESSAGE ───────────────────────────────────────────────────────────

const sendMessage = async (req, res) => {
  try {
    const { threadType, threadId } = req.params;
    const text = String(req.body?.text || "").trim();

    if (!text) return res.status(400).json({ message: "Type something first." });
    if (text.length > 1000) return res.status(400).json({ message: "That message is too long." });

    const thread = await authorizeThread(req.user._id, threadType, threadId);
    if (!thread) return res.status(403).json({ message: "You're not in this conversation." });

    const message = await Message.create({
      threadType,
      threadId,
      sender: req.user._id,
      text,
      readBy: [req.user._id],
    });

    // Denormalised preview so the list screens need no extra query.
    await thread.model.findByIdAndUpdate(threadId, {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: text.slice(0, 80),
      },
    });

    return res.status(201).json({
      message: {
        _id: message._id,
        text: message.text,
        kind: message.kind,
        createdAt: message.createdAt,
        mine: true,
        sender: { _id: req.user._id, name: req.user.name, profilePic: req.user.profilePic },
      },
    });
  } catch (err) {
    console.error("[chatController] sendMessage:", err);
    return res.status(500).json({ message: "Couldn't send that message." });
  }
};

// ─── UNREAD SUMMARY ─────────────────────────────────────────────────────────

/**
 * GET /api/chat/unread — powers the badge on the nav bar.
 */
const getUnreadSummary = async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user._id);

    const [matches, communities] = await Promise.all([
      Match.find({ users: me, status: "active" }).select("_id").lean(),
      Community.find({ members: me }).select("_id").lean(),
    ]);

    const ids = [...matches, ...communities].map((d) => d._id);
    if (ids.length === 0) return res.json({ total: 0, threads: [] });

    const rows = await Message.aggregate([
      {
        $match: {
          threadId: { $in: ids },
          sender: { $ne: me },
          readBy: { $ne: me },
        },
      },
      { $group: { _id: { threadId: "$threadId", threadType: "$threadType" }, n: { $sum: 1 } } },
    ]);

    return res.json({
      total: rows.reduce((s, r) => s + r.n, 0),
      threads: rows.map((r) => ({
        threadId: r._id.threadId,
        threadType: r._id.threadType,
        unread: r.n,
      })),
    });
  } catch (err) {
    console.error("[chatController] getUnreadSummary:", err);
    return res.status(500).json({ message: "Couldn't load unread counts." });
  }
};

module.exports = { getMessages, sendMessage, getUnreadSummary, authorizeThread };
