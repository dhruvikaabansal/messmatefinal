/**
 * matchController.js — 1-on-1 matching.
 *
 * Rules that hold everywhere:
 *   • Every action is scoped to a slot and refuses to run on a closed slot.
 *   • UserSlotState is the single source of truth for "can I do this".
 *   • Every mutation of someone else's data verifies ownership first.
 */

const mongoose = require("mongoose");
const Like = require("../models/Like");
const Match = require("../models/Match");
const User = require("../models/User");
const Message = require("../models/Message");
const Preference = require("../models/Preference");
const UserSlotState = require("../models/UserSlotState");

const { isSlotActive, resolveSlotFromPref } = require("../utils/slotUtils");
const { getOrCreateState, setState } = require("../services/feedService");
const { calculateAge } = require("../utils/ageUtils");

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

/**
 * Resolve the caller's active slot, self-healing a stale preference.
 */
const resolveSlot = async (userId) => {
  const pref = await Preference.findOne({ user: userId });
  if (!pref) return { error: "Set your meal preferences first.", code: 400 };

  const resolved = resolveSlotFromPref(pref);
  if (resolved.healed) {
    pref.mealDate = resolved.mealDate;
    pref.mealTime = resolved.mealTime;
    await pref.save();
  }
  return { slotId: resolved.slotId, pref, error: null };
};

// ─── LIKE ───────────────────────────────────────────────────────────────────

/**
 * POST /api/match/like { targetUserId }
 *
 * Mutual like → both users are claimed into a match atomically. The claim is
 * conditional on each side still being idle/liked, so two people liking each
 * other at the same instant can never produce two matches or a half-match.
 */
const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (!isId(targetUserId)) {
      return res.status(400).json({ message: "A valid targetUserId is required." });
    }
    if (targetUserId === fromUserId.toString()) {
      return res.status(400).json({ message: "You cannot like yourself." });
    }

    const { slotId, pref, error, code } = await resolveSlot(fromUserId);
    if (error) return res.status(code || 400).json({ message: error });

    if (!isSlotActive(slotId)) {
      return res.status(409).json({
        slotStatus: "closed",
        message: "This meal slot has closed. Pick the next one to keep going.",
      });
    }

    const target = await User.findById(targetUserId).select("name college");
    if (!target) return res.status(404).json({ message: "That profile no longer exists." });
    if (target.college !== req.user.college) {
      return res.status(403).json({ message: "You can only match within your own campus." });
    }

    const [myState, targetState] = await Promise.all([
      getOrCreateState(fromUserId, slotId),
      getOrCreateState(targetUserId, slotId),
    ]);

    if (myState.state === "matched") {
      return res.status(409).json({ message: "You already have a match for this slot.", state: "matched" });
    }
    if (myState.state === "in_community") {
      return res.status(409).json({ message: "You're seated at a group table for this slot.", state: "in_community" });
    }
    if (targetState.state === "matched" || targetState.state === "in_community") {
      // Not an error the user caused — record the skip so they aren't shown again.
      await Like.updateOne(
        { fromUser: fromUserId, toUser: targetUserId, slotId },
        { $setOnInsert: { fromUser: fromUserId, toUser: targetUserId, slotId, status: "skipped" } },
        { upsert: true }
      );
      return res.status(409).json({
        message: `${target.name} just got taken for this slot. Here's the next one.`,
        taken: true,
      });
    }

    // Record the like (idempotent).
    const existing = await Like.findOne({ fromUser: fromUserId, toUser: targetUserId, slotId });
    if (existing && existing.status === "skipped") {
      return res.status(409).json({ message: "You already passed on this person for this slot." });
    }
    if (!existing) {
      await Like.create({ fromUser: fromUserId, toUser: targetUserId, slotId, status: "pending" });
    }

    // Move idle -> liked, but ONLY if we are still idle. The state we read a
    // few lines ago can be stale: if the other person liked us back in the
    // meantime, their request may already have claimed us as "matched", and an
    // unconditional write here would silently undo their match.
    if (myState.state === "idle") {
      await UserSlotState.updateOne(
        { userId: fromUserId, slotId, state: "idle" },
        { $set: { state: "liked" } }
      );
    }

    // Do they already like us back?
    const reciprocal = await Like.findOne({
      fromUser: targetUserId,
      toUser: fromUserId,
      slotId,
      status: "pending",
    });

    if (!reciprocal) {
      // The other side may have matched us during this request. Report the
      // truth rather than "waiting for them to like back".
      const fresh = await UserSlotState.findOne({ userId: fromUserId, slotId });
      if (fresh?.state === "matched" && fresh.matchId) {
        return res.status(200).json({
          isMatch: true,
          matchId: fresh.matchId,
          message: "It's a match!",
          partner: { _id: target._id, name: target.name },
        });
      }

      // Self-heal: if a live match exists for us in this slot but our state row
      // does not say so, the row lost a write somewhere. Trust the Match — it
      // is the durable record — and put the state back.
      const liveMatch = await Match.findOne({ users: fromUserId, slotId, status: "active" });
      if (liveMatch) {
        await UserSlotState.updateOne(
          { userId: fromUserId, slotId },
          { $set: { state: "matched", matchId: liveMatch._id, communityId: null } }
        );
        return res.status(200).json({
          isMatch: true,
          matchId: liveMatch._id,
          message: "It's a match!",
        });
      }
      return res.status(201).json({
        isMatch: false,
        message: `Liked! We'll tell you the moment ${target.name} likes back.`,
      });
    }

    // ── Atomic two-sided claim ────────────────────────────────────────────
    const newMatch = await Match.create({
      users: [fromUserId, targetUserId],
      slotId,
      mealTime: pref.mealTime,
      mealDate: pref.mealDate,
      status: "active",
    });

    const claimable = { state: { $in: ["idle", "liked"] } };

    const claimA = await UserSlotState.findOneAndUpdate(
      { userId: fromUserId, slotId, ...claimable },
      { $set: { state: "matched", matchId: newMatch._id, communityId: null } },
      { returnDocument: "after" }
    );
    if (!claimA) {
      await Match.findByIdAndDelete(newMatch._id);
      const now = await UserSlotState.findOne({ userId: fromUserId, slotId });
      if (now?.state === "matched") {
        return res.status(200).json({ isMatch: true, matchId: now.matchId, message: "It's a match!" });
      }
      return res.status(409).json({ message: "Something changed on your side — refreshing." });
    }

    const claimB = await UserSlotState.findOneAndUpdate(
      { userId: targetUserId, slotId, ...claimable },
      { $set: { state: "matched", matchId: newMatch._id, communityId: null } },
      { returnDocument: "after" }
    );
    if (!claimB) {
      // Roll back: the other side got taken in the milliseconds between calls.
      await Match.findByIdAndDelete(newMatch._id);
      await UserSlotState.updateOne(
        { userId: fromUserId, slotId, matchId: newMatch._id },
        { $set: { state: "liked", matchId: null } }
      );
      return res.status(409).json({
        message: `${target.name} just matched with someone else. Keep going!`,
        taken: true,
      });
    }

    await Like.updateMany(
      {
        slotId,
        $or: [
          { fromUser: fromUserId, toUser: targetUserId },
          { fromUser: targetUserId, toUser: fromUserId },
        ],
      },
      { $set: { status: "matched" } }
    );

    // Clear every other pending like either side had — they're off the market.
    await Like.updateMany(
      {
        slotId,
        status: "pending",
        $or: [
          { fromUser: { $in: [fromUserId, targetUserId] } },
          { toUser: { $in: [fromUserId, targetUserId] } },
        ],
      },
      { $set: { status: "skipped" } }
    );

    await Message.create({
      threadType: "match",
      threadId: newMatch._id,
      sender: fromUserId,
      kind: "system",
      text: `You matched for ${pref.mealTime}. Say hi and decide where to meet!`,
    });

    return res.status(201).json({
      isMatch: true,
      matchId: newMatch._id,
      message: "It's a match!",
      partner: { _id: target._id, name: target.name },
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "You already responded to this person." });
    }
    console.error("[matchController] likeUser:", err);
    return res.status(500).json({ message: "Couldn't send that like. Try again." });
  }
};

// ─── SKIP ───────────────────────────────────────────────────────────────────

const skipUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!isId(targetUserId)) {
      return res.status(400).json({ message: "A valid targetUserId is required." });
    }

    const { slotId, error, code } = await resolveSlot(req.user._id);
    if (error) return res.status(code || 400).json({ message: error });

    if (!isSlotActive(slotId)) {
      return res.status(409).json({ slotStatus: "closed", message: "This slot has closed." });
    }

    await Like.findOneAndUpdate(
      { fromUser: req.user._id, toUser: targetUserId, slotId },
      {
        $setOnInsert: {
          fromUser: req.user._id,
          toUser: targetUserId,
          slotId,
          status: "skipped",
        },
      },
      { upsert: true }
    );

    return res.status(200).json({ message: "Skipped." });
  } catch (err) {
    if (err?.code === 11000) return res.status(200).json({ message: "Skipped." });
    console.error("[matchController] skipUser:", err);
    return res.status(500).json({ message: "Couldn't skip. Try again." });
  }
};

// ─── UNDO LAST SKIP ─────────────────────────────────────────────────────────

/**
 * POST /api/match/undo
 * Everyone mis-taps. Removes the most recent skip in this slot so the profile
 * returns to the deck. Only skips can be undone — a like is a commitment.
 */
const undoLastSkip = async (req, res) => {
  try {
    const { slotId, error, code } = await resolveSlot(req.user._id);
    if (error) return res.status(code || 400).json({ message: error });

    const last = await Like.findOneAndDelete(
      { fromUser: req.user._id, slotId, status: "skipped" },
      { sort: { createdAt: -1 } }
    );
    if (!last) return res.status(404).json({ message: "Nothing to undo." });

    return res.json({ message: "Brought them back.", restoredUserId: last.toUser });
  } catch (err) {
    console.error("[matchController] undoLastSkip:", err);
    return res.status(500).json({ message: "Couldn't undo." });
  }
};

// ─── LIKES RECEIVED ─────────────────────────────────────────────────────────

const getLikesReceived = async (req, res) => {
  try {
    const { slotId, pref, error, code } = await resolveSlot(req.user._id);
    if (error) return res.status(code || 400).json({ likes: [], message: error });

    const state = await getOrCreateState(req.user._id, slotId);

    if (state.state === "matched" || state.state === "in_community") {
      return res.json({
        likes: [],
        isLocked: true,
        lockType: state.state === "matched" ? "match" : "community",
        mealTime: pref.mealTime,
        mealDate: pref.mealDate,
        message:
          state.state === "matched"
            ? "You already have a match for this slot."
            : "You're seated at a group table for this slot.",
      });
    }

    const likes = await Like.find({ toUser: req.user._id, slotId, status: "pending" })
      .populate("fromUser", User.CARD_FIELDS)
      .lean();

    return res.json({
      likes: likes
        .filter((l) => l.fromUser)
        .map((l) => ({
          likeId: l._id,
          ...l.fromUser,
          age: calculateAge(l.fromUser.birthday),
        })),
      mealTime: pref.mealTime,
      mealDate: pref.mealDate,
    });
  } catch (err) {
    console.error("[matchController] getLikesReceived:", err);
    return res.status(500).json({ message: "Couldn't load your likes." });
  }
};

// ─── IGNORE A LIKE ──────────────────────────────────────────────────────────

const ignoreLike = async (req, res) => {
  try {
    const { likeId } = req.body;
    if (!isId(likeId)) return res.status(400).json({ message: "A valid likeId is required." });

    // Ownership check — the old build let any logged-in user dismiss any like.
    const like = await Like.findOne({ _id: likeId, toUser: req.user._id });
    if (!like) return res.status(404).json({ message: "That like isn't yours to dismiss." });

    like.status = "skipped";
    await like.save();
    return res.json({ message: "Dismissed." });
  } catch (err) {
    console.error("[matchController] ignoreLike:", err);
    return res.status(500).json({ message: "Couldn't dismiss that like." });
  }
};

// ─── MATCH LIST ─────────────────────────────────────────────────────────────

const getMatches = async (req, res) => {
  try {
    const me = req.user._id;
    const matches = await Match.find({ users: me })
      .populate("users", User.CARD_FIELDS)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const ids = matches.map((m) => m._id);
    const unreadRows = await Message.aggregate([
      {
        $match: {
          threadType: "match",
          threadId: { $in: ids },
          sender: { $ne: new mongoose.Types.ObjectId(me) },
          readBy: { $ne: new mongoose.Types.ObjectId(me) },
        },
      },
      { $group: { _id: "$threadId", n: { $sum: 1 } } },
    ]);
    const unread = new Map(unreadRows.map((r) => [r._id.toString(), r.n]));

    const list = matches
      .map((m) => {
        const partner = m.users.find((u) => u._id.toString() !== me.toString());
        if (!partner) return null;
        return {
          _id: m._id,
          type: "solo",
          slotId: m.slotId,
          mealTime: m.mealTime,
          mealDate: m.mealDate,
          status: m.status,
          createdAt: m.createdAt,
          lastMessageAt: m.lastMessageAt,
          lastMessagePreview: m.lastMessagePreview,
          unread: unread.get(m._id.toString()) || 0,
          user: { ...partner, age: calculateAge(partner.birthday) },
        };
      })
      .filter(Boolean);

    const { pref } = await resolveSlot(me);
    return res.json({
      matches: list,
      mealTime: pref?.mealTime || null,
      mealDate: pref?.mealDate || null,
    });
  } catch (err) {
    console.error("[matchController] getMatches:", err);
    return res.status(500).json({ message: "Couldn't load your matches." });
  }
};

// ─── UNMATCH ────────────────────────────────────────────────────────────────

const unmatchUser = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!isId(matchId)) return res.status(400).json({ message: "A valid matchId is required." });

    // Ownership check — previously any authenticated user could dissolve any match.
    const match = await Match.findOne({ _id: matchId, users: req.user._id });
    if (!match) return res.status(404).json({ message: "Match not found." });

    const [u1, u2] = match.users;

    await Match.findByIdAndDelete(matchId);
    await Message.deleteMany({ threadType: "match", threadId: matchId });
    await Like.deleteMany({
      slotId: match.slotId,
      $or: [
        { fromUser: u1, toUser: u2 },
        { fromUser: u2, toUser: u1 },
      ],
    });
    await UserSlotState.updateMany(
      { matchId: match._id },
      { $set: { state: "idle", matchId: null } }
    );

    return res.json({ message: "Unmatched. You're back in the deck." });
  } catch (err) {
    console.error("[matchController] unmatchUser:", err);
    return res.status(500).json({ message: "Couldn't unmatch." });
  }
};

// ─── COMPLETE ───────────────────────────────────────────────────────────────

const completeMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!isId(matchId)) return res.status(400).json({ message: "A valid matchId is required." });

    const match = await Match.findOne({ _id: matchId, users: req.user._id });
    if (!match) return res.status(404).json({ message: "Match not found." });

    match.status = "completed";
    await match.save();

    await UserSlotState.updateMany(
      { matchId: match._id },
      { $set: { state: "idle", matchId: null } }
    );

    return res.json({ message: "Hope the meal was good. Saved to your history." });
  } catch (err) {
    console.error("[matchController] completeMatch:", err);
    return res.status(500).json({ message: "Couldn't close out that match." });
  }
};

module.exports = {
  likeUser,
  skipUser,
  undoLastSkip,
  getMatches,
  getLikesReceived,
  ignoreLike,
  unmatchUser,
  completeMatch,
};
