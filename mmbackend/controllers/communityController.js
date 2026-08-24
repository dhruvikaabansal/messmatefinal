/**
 * communityController.js — group tables.
 *
 * A table is an open invitation to eat together for one slot. Anyone in the
 * same college can create or join one; the old requirement that your
 * preference groupSize be >= 3 before you could even look at tables is gone —
 * it locked new users out of half the product on their first visit.
 */

const mongoose = require("mongoose");
const Community = require("../models/Community");
const Message = require("../models/Message");
const Preference = require("../models/Preference");
const UserSlotState = require("../models/UserSlotState");
const Like = require("../models/Like");
const User = require("../models/User");

const { buildSlotId, isSlotActive, resolveSlotFromPref, MEAL_TYPES, isValidDateStr } = require("../utils/slotUtils");
const { getOrCreateState, setState, buildTableDeck } = require("../services/feedService");

const isId = (v) => mongoose.Types.ObjectId.isValid(v);

const resolveSlot = async (userId) => {
  const pref = await Preference.findOne({ user: userId });
  if (!pref) return { error: "Set your meal preferences first." };
  const resolved = resolveSlotFromPref(pref);
  if (resolved.healed) {
    pref.mealDate = resolved.mealDate;
    pref.mealTime = resolved.mealTime;
    await pref.save();
  }
  return { slotId: resolved.slotId, pref, error: null };
};

/** Pending 1-on-1 likes are cleared when someone commits to a table. */
const clearPendingLikes = (userId, slotId) =>
  Like.updateMany(
    { slotId, status: "pending", $or: [{ fromUser: userId }, { toUser: userId }] },
    { $set: { status: "skipped" } }
  );

// ─── BROWSE ─────────────────────────────────────────────────────────────────

const browseCommunities = async (req, res) => {
  try {
    let slotId;
    if (req.query.mealTime && req.query.mealDate) {
      if (!isValidDateStr(req.query.mealDate) || !MEAL_TYPES.includes(req.query.mealTime)) {
        return res.status(400).json({ message: "Invalid slot." });
      }
      slotId = buildSlotId(req.query.mealDate, req.query.mealTime);
    } else {
      const r = await resolveSlot(req.user._id);
      if (r.error) return res.json({ communities: [], message: r.error });
      slotId = r.slotId;
    }

    const viewer = {
      _id: req.user._id,
      interests: req.user.interests,
      college: req.user.college,
    };

    // Tables the user is already in, shown first and never filtered out.
    const mine = await Community.find({ slotId, members: req.user._id })
      .populate("members", "name profilePic birthday")
      .populate("createdBy", "name profilePic")
      .lean();

    const others = await buildTableDeck({ viewer, slotId });

    return res.json({
      slotId,
      myTables: mine.map((c) => ({
        ...c,
        kind: "table",
        isMember: true,
        isCreator: c.createdBy?._id?.toString() === req.user._id.toString(),
        seatsLeft: Math.max(0, c.maxMembers - (c.members || []).length),
      })),
      communities: others,
    });
  } catch (err) {
    console.error("[communityController] browseCommunities:", err);
    return res.status(500).json({ message: "Couldn't load tables." });
  }
};

// ─── CREATE ─────────────────────────────────────────────────────────────────

const createCommunity = async (req, res) => {
  try {
    const { name, description, interests, maxMembers, venue } = req.body;
    const userId = req.user._id;

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ message: "Give your table a name." });
    }

    // The table always belongs to the slot the user is currently browsing —
    // no separate date/meal pickers to get out of sync.
    let mealDate = req.body.mealDate;
    let mealTime = req.body.mealTime;
    if (!isValidDateStr(mealDate) || !MEAL_TYPES.includes(mealTime)) {
      const r = await resolveSlot(userId);
      if (r.error) return res.status(400).json({ message: r.error });
      mealDate = r.pref.mealDate;
      mealTime = r.pref.mealTime;
    }

    const slotId = buildSlotId(mealDate, mealTime);
    if (!isSlotActive(slotId)) {
      return res.status(409).json({
        slotStatus: "closed",
        message: `The ${mealTime} slot on ${mealDate} has closed. Pick a later one.`,
      });
    }

    const myState = await getOrCreateState(userId, slotId);
    if (myState.state === "matched") {
      return res.status(409).json({
        message: "You have a 1-on-1 match for this slot. Finish or unmatch first.",
      });
    }
    if (myState.state === "in_community") {
      return res.status(409).json({
        message: "You're already at a table for this slot.",
        communityId: myState.communityId,
      });
    }

    const cap = Math.min(8, Math.max(2, Number(maxMembers) || 4));

    const community = await Community.create({
      name: String(name).trim().slice(0, 60),
      slotId,
      mealTime,
      mealDate,
      college: req.user.college,
      description: String(description || "").slice(0, 200),
      venue: String(venue || "").slice(0, 80),
      interests: Array.isArray(interests) ? interests.slice(0, 8) : [],
      maxMembers: cap,
      createdBy: userId,
      members: [userId],
    });

    const claimed = await UserSlotState.findOneAndUpdate(
      { userId, slotId, state: { $in: ["idle", "liked"] } },
      { $set: { state: "in_community", communityId: community._id, matchId: null } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      await Community.findByIdAndDelete(community._id);
      return res.status(409).json({ message: "Your status changed — refresh and try again." });
    }

    await clearPendingLikes(userId, slotId);
    await Message.create({
      threadType: "community",
      threadId: community._id,
      sender: userId,
      kind: "system",
      text: `${req.user.name} opened this table for ${mealTime}.`,
    });

    return res.status(201).json({ message: "Table created.", community });
  } catch (err) {
    console.error("[communityController] createCommunity:", err);
    return res.status(500).json({ message: "Couldn't create that table." });
  }
};

// ─── JOIN ───────────────────────────────────────────────────────────────────

const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;
    if (!isId(communityId)) return res.status(400).json({ message: "A valid table id is required." });

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "That table no longer exists." });

    if (community.college !== req.user.college) {
      return res.status(403).json({ message: "That table is at another campus." });
    }
    if (!isSlotActive(community.slotId)) {
      return res.status(409).json({ slotStatus: "closed", message: "That table's slot has closed." });
    }

    const myState = await getOrCreateState(userId, community.slotId);
    if (myState.state === "matched") {
      return res.status(409).json({ message: "You have a 1-on-1 match for this slot." });
    }
    if (myState.state === "in_community") {
      return res.status(409).json({
        message: "You're already at a table for this slot.",
        communityId: myState.communityId,
      });
    }

    // Claim the seat atomically — capacity is checked inside the same write, so
    // two people racing for the last seat can't both get it.
    //
    // The guard is `members.<cap-1>` not existing, which is true exactly when
    // the array is shorter than the cap. An `$expr` with `$size` would read
    // more naturally but is unsupported on some MongoDB-compatible backends
    // and cannot use an index; this form works everywhere.
    const lastSeatIndex = `members.${community.maxMembers - 1}`;
    const seated = await Community.findOneAndUpdate(
      {
        _id: communityId,
        members: { $ne: userId },
        [lastSeatIndex]: { $exists: false },
      },
      { $push: { members: userId } },
      { returnDocument: "after" }
    );
    if (!seated) {
      return res.status(409).json({ message: "That table just filled up." });
    }

    // Confirm the seat actually stuck. On MongoDB the update above is atomic and
    // this is a formality, but it costs one cheap read and makes the invariant
    // hold even on backends with weaker single-document guarantees: if our push
    // was lost, or two writers both landed and pushed us past the cap, we back
    // out rather than telling someone they have a seat that isn't there.
    const confirmed = await Community.findById(communityId).select("members maxMembers").lean();
    const seatIndex = (confirmed?.members || []).findIndex(
      (m) => m.toString() === userId.toString()
    );
    if (seatIndex === -1 || seatIndex >= confirmed.maxMembers) {
      if (seatIndex >= 0) {
        await Community.updateOne({ _id: communityId }, { $pull: { members: userId } });
      }
      return res.status(409).json({ message: "That table just filled up." });
    }

    const claimed = await UserSlotState.findOneAndUpdate(
      { userId, slotId: community.slotId, state: { $in: ["idle", "liked"] } },
      { $set: { state: "in_community", communityId: community._id, matchId: null } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      await Community.updateOne({ _id: communityId }, { $pull: { members: userId } });
      return res.status(409).json({ message: "Your status changed — refresh and try again." });
    }

    await clearPendingLikes(userId, community.slotId);
    await Message.create({
      threadType: "community",
      threadId: community._id,
      sender: userId,
      kind: "system",
      text: `${req.user.name} joined the table.`,
    });

    return res.json({ message: `You're in — see you at ${community.name}!`, community: seated });
  } catch (err) {
    console.error("[communityController] joinCommunity:", err);
    return res.status(500).json({ message: "Couldn't join that table." });
  }
};

// ─── LEAVE ──────────────────────────────────────────────────────────────────

const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;
    if (!isId(communityId)) return res.status(400).json({ message: "A valid table id is required." });

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "That table no longer exists." });
    if (!community.members.some((m) => m.toString() === userId.toString())) {
      return res.status(403).json({ message: "You're not at this table." });
    }

    const isCreator = community.createdBy.toString() === userId.toString();

    // Creator leaving no longer forces a dissolve — the table survives and the
    // longest-standing member takes it over. Losing your lunch plans because
    // one person changed theirs was the worst moment in the old flow.
    if (isCreator && community.members.length > 1) {
      const successor = community.members.find((m) => m.toString() !== userId.toString());
      community.createdBy = successor;
    }

    community.members = community.members.filter((m) => m.toString() !== userId.toString());

    if (community.members.length === 0) {
      await Community.findByIdAndDelete(communityId);
      await Message.deleteMany({ threadType: "community", threadId: communityId });
    } else {
      await community.save();
      await Message.create({
        threadType: "community",
        threadId: community._id,
        sender: userId,
        kind: "system",
        text: `${req.user.name} left the table.`,
      });
    }

    const hasPendingLike = await Like.findOne({
      fromUser: userId,
      slotId: community.slotId,
      status: "pending",
    });
    await setState(userId, community.slotId, hasPendingLike ? "liked" : "idle");

    return res.json({ message: "You left the table." });
  } catch (err) {
    console.error("[communityController] leaveCommunity:", err);
    return res.status(500).json({ message: "Couldn't leave that table." });
  }
};

// ─── DISSOLVE ───────────────────────────────────────────────────────────────

const dissolveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    if (!isId(communityId)) return res.status(400).json({ message: "A valid table id is required." });

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "That table no longer exists." });
    if (community.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can close this table." });
    }

    await Community.findByIdAndDelete(communityId);
    await Message.deleteMany({ threadType: "community", threadId: communityId });
    await UserSlotState.updateMany(
      { communityId: community._id },
      { $set: { state: "idle", communityId: null } }
    );

    return res.json({ message: "Table closed. Everyone's free to match again." });
  } catch (err) {
    console.error("[communityController] dissolveCommunity:", err);
    return res.status(500).json({ message: "Couldn't close that table." });
  }
};

// ─── DETAIL ─────────────────────────────────────────────────────────────────

const getCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isId(id)) return res.status(400).json({ message: "Invalid table id." });

    const community = await Community.findById(id)
      .populate("members", "name profilePic birthday bio interests college")
      .populate("createdBy", "name profilePic")
      .lean();
    if (!community) return res.status(404).json({ message: "That table no longer exists." });

    const isMember = (community.members || []).some(
      (m) => m._id.toString() === req.user._id.toString()
    );

    return res.json({
      community: {
        ...community,
        isMember,
        isCreator: community.createdBy?._id?.toString() === req.user._id.toString(),
        seatsLeft: Math.max(0, community.maxMembers - (community.members || []).length),
        isOpen: isSlotActive(community.slotId),
      },
    });
  } catch (err) {
    console.error("[communityController] getCommunity:", err);
    return res.status(500).json({ message: "Couldn't load that table." });
  }
};

module.exports = {
  browseCommunities,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  dissolveCommunity,
  getCommunity,
};
