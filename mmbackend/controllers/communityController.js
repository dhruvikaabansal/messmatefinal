/**
 * communityController.js — Slot-State-First architecture.
 *
 * ARCHITECTURE RULE:
 *   Every function must:
 *   1. Validate the slot is active (not expired)
 *   2. Fetch UserSlotState for the current user
 *   3. Decide action based on STATE — never by cross-querying collections
 *   4. Update UserSlotState after any action
 *
 * State is the single source of truth.
 */

const Community = require("../models/Community");
const UserSlotState = require("../models/UserSlotState");
const Like = require("../models/Like");
const Preference = require("../models/Preference");
const cosineSimilarity = require("../utils/cosineSimilarity");
const { buildSlotId, isSlotActive, slotIdFromPref } = require("../utils/slotUtils");

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

/**
 * Get-or-create a UserSlotState document (upsert pattern, race-condition safe).
 */
const getOrCreateState = async (userId, slotId) => {
  return UserSlotState.findOneAndUpdate(
    { userId, slotId },
    { $setOnInsert: { userId, slotId, state: "idle" } },
    { upsert: true, new: true }
  );
};

/**
 * Set a user's state for a given slot.
 */
const setState = async (userId, slotId, state, extra = {}) => {
  return UserSlotState.findOneAndUpdate(
    { userId, slotId },
    { $set: { state, matchId: null, communityId: null, ...extra } },
    { upsert: true, new: true }
  );
};

/**
 * Resolve the slotId from the user's current preference.
 */
const resolveSlot = async (userId) => {
  const pref = await Preference.findOne({ user: userId });
  if (!pref) return { slotId: null, pref: null, error: "Set your meal preferences first." };
  const slotId = slotIdFromPref(pref);
  return { slotId, pref, error: null };
};

// ─── BROWSE COMMUNITIES ────────────────────────────────────────────────────────

/**
 * GET /api/community
 * Returns communities for the user's current slot + college.
 * Ranked by interest similarity.
 * Also includes communities the user is already a member of.
 */
const browseCommunities = async (req, res) => {
  try {
    const currentUser = req.user;

    // Allow explicit override via query params (for UI flexibility)
    let slotId;
    if (req.query.mealTime && req.query.mealDate) {
      slotId = buildSlotId(req.query.mealDate, req.query.mealTime);
    } else {
      const { slotId: resolved, error } = await resolveSlot(currentUser._id);
      if (error) return res.json({ communities: [] });
      slotId = resolved;
    }

    // Fetch communities for this slot + college (or ones the user is already in)
    const communities = await Community.find({
      $or: [
        { slotId, college: currentUser.college },
        { slotId, members: currentUser._id }, // always show communities user is in, even different college
      ],
    })
      .populate("members", "name profilePic age")
      .populate("createdBy", "name profilePic");

    // Annotate with membership flags and sort by interest score
    const enhanced = communities.map((c) => {
      const isCreator = c.createdBy._id.toString() === currentUser._id.toString();
      const isMember = c.members.some(
        (m) => m._id.toString() === currentUser._id.toString()
      );
      const matchScore = cosineSimilarity(
        currentUser.interests || [],
        c.interests || []
      );
      return { ...c.toObject(), isCreator, isMember, matchScore };
    });

    // Show all matching communities (ranked by interest similarity)
    const filtered = enhanced
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ communities: filtered });
  } catch (error) {
    console.error("[communityController] browseCommunities:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── CREATE COMMUNITY ──────────────────────────────────────────────────────────

/**
 * POST /api/community/create
 * Body: { name, mealTime, mealDate, description, interests, maxMembers }
 *
 * State rules:
 *   - Allowed:  idle, liked
 *   - Blocked:  matched, in_community
 */
const createCommunity = async (req, res) => {
  try {
    const { name, mealTime, mealDate, description, interests, maxMembers } = req.body;
    const userId = req.user._id;

    if (!name || !mealTime || !mealDate) {
      return res.status(400).json({ message: "name, mealTime, and mealDate are required." });
    }

    // 1. Build slotId
    const slotId = buildSlotId(mealDate, mealTime);

    // 2. Validate slot is active
    if (!isSlotActive(slotId)) {
      return res.status(400).json({
        slotStatus: "closed",
        message: `The ${mealTime} slot on ${mealDate} has already ended. Choose a future slot.`,
      });
    }

    // 3. Check state — only idle/liked can create
    const myState = await getOrCreateState(userId, slotId);

    if (myState.state === "matched") {
      return res.status(400).json({
        message: "You have a 1-on-1 match for this slot! Complete or unmatch before creating a group. 🔒",
      });
    }
    if (myState.state === "in_community") {
      return res.status(400).json({
        message: "You're already in a group for this slot! Leave it before creating a new one.",
      });
    }

    // 4. Create the community
    const newCommunity = await Community.create({
      name,
      slotId,
      mealTime,
      mealDate,
      college: req.user.college.toLowerCase(),
      description: description || "",
      interests: interests || [],
      maxMembers: maxMembers || 4,
      createdBy: userId,
      members: [userId],
    });

    // 5. 🔥 Update creator's state → in_community
    await setState(userId, slotId, "in_community", { communityId: newCommunity._id });

    return res.status(201).json({
      message: "Community created!",
      community: newCommunity,
    });
  } catch (error) {
    console.error("[communityController] createCommunity:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── JOIN COMMUNITY ────────────────────────────────────────────────────────────

/**
 * POST /api/community/join
 * Body: { communityId }
 *
 * State rules:
 *   - Allowed:  idle, liked
 *   - Blocked:  matched, in_community
 */
const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    if (!communityId) {
      return res.status(400).json({ message: "communityId is required." });
    }

    // 1. Find community
    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found." });
    }

    const { slotId } = community;

    // 2. Validate slot is still active
    if (!isSlotActive(slotId)) {
      return res.status(400).json({
        slotStatus: "closed",
        message: `This community's slot (${community.mealTime} on ${community.mealDate}) has already ended.`,
      });
    }

    // 3. Check state — only idle/liked can join
    const myState = await getOrCreateState(userId, slotId);

    if (myState.state === "matched") {
      return res.status(400).json({
        message: "You have a 1-on-1 match for this slot! You cannot join a group. 🔒",
      });
    }
    if (myState.state === "in_community") {
      return res.status(400).json({
        message: "You're already in a group for this slot! Leave it before joining another.",
      });
    }

    // 4. Check capacity
    if (community.members.length >= community.maxMembers) {
      return res.status(400).json({ message: "This group is already full! 🍱" });
    }

    // 5. Check not already a member (edge case guard)
    if (community.members.some((m) => m.toString() === userId.toString())) {
      return res.status(400).json({ message: "You are already in this community." });
    }

    // 6. Add member
    community.members.push(userId);
    await community.save();

    // 7. 🔥 Update user's state → in_community
    await setState(userId, slotId, "in_community", { communityId: community._id });

    return res.json({ message: "Joined successfully!", community });
  } catch (error) {
    console.error("[communityController] joinCommunity:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── LEAVE COMMUNITY ───────────────────────────────────────────────────────────

/**
 * POST /api/community/leave
 * Body: { communityId }
 * Note: Creators must dissolve instead.
 */
const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (community.createdBy.toString() === userId.toString()) {
      return res.status(400).json({
        message: "As the creator, you must dissolve the community instead of leaving it.",
      });
    }

    // Remove member
    community.members = community.members.filter(
      (m) => m.toString() !== userId.toString()
    );
    await community.save();

    // 🔥 Reset state → idle (check if they have any pending likes to set to "liked")
    const hasLike = await Like.findOne({ fromUser: userId, slotId: community.slotId, status: "pending" });
    const newState = hasLike ? "liked" : "idle";
    await setState(userId, community.slotId, newState);

    return res.json({ message: "Left successfully." });
  } catch (error) {
    console.error("[communityController] leaveCommunity:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── DISSOLVE COMMUNITY ────────────────────────────────────────────────────────

/**
 * DELETE /api/community/dissolve
 * Body: { communityId }
 * Only the creator can dissolve. Resets ALL members' states.
 */
const dissolveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    const community = await Community.findById(communityId);
    if (!community) return res.status(404).json({ message: "Community not found." });

    if (community.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the creator can dissolve this community." });
    }

    const memberIds = community.members;
    const { slotId } = community;

    // Delete the community
    await Community.findByIdAndDelete(communityId);

    // 🔥 Reset ALL members' states → idle
    await UserSlotState.updateMany(
      { communityId, slotId },
      { $set: { state: "idle", communityId: null } }
    );

    return res.json({ message: "Community dissolved. All members have been freed." });
  } catch (error) {
    console.error("[communityController] dissolveCommunity:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  browseCommunities,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  dissolveCommunity,
};
