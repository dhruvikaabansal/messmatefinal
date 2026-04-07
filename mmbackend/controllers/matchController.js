/**
 * matchController.js — Slot-State-First architecture.
 *
 * ARCHITECTURE RULE:
 *   Every function must:
 *   1. Validate the slot is active (not expired)
 *   2. Fetch UserSlotState for the current user
 *   3. Decide action based on STATE — never based on counting documents
 *   4. Update UserSlotState after any action
 *
 * State is the single source of truth.
 * Actions never override state.
 */

const Preference = require("../models/Preference");
const Match = require("../models/Match");
const User = require("../models/User");
const Like = require("../models/Like");
const Community = require("../models/Community");
const UserSlotState = require("../models/UserSlotState");
const cosineSimilarity = require("../utils/cosineSimilarity");
const { buildSlotId, isSlotActive, slotIdFromPref } = require("../utils/slotUtils");

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

/**
 * Get-or-create a UserSlotState document (upsert pattern).
 * Uses MongoDB's findOneAndUpdate with upsert to avoid race conditions.
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
 * Resolve the slotId from either a preference doc or a provided pref object.
 * Returns { slotId, pref, error } — caller handles error.
 */
const resolveSlot = async (userId) => {
  const pref = await Preference.findOne({ user: userId });
  if (!pref) return { slotId: null, pref: null, error: "Set your preferences first." };
  const slotId = slotIdFromPref(pref);
  return { slotId, pref, error: null };
};

// ─── GET CANDIDATES ───────────────────────────────────────────────────────────

/**
 * GET /api/match/candidates
 * Returns sorted list of users available to swipe on in the current slot.
 */
const getCandidates = async (req, res) => {
  try {
    const currentUser = req.user;

    // 1. Resolve slot
    const { slotId, pref, error } = await resolveSlot(currentUser._id);
    if (error) return res.json({ candidates: [], message: error });

    // 2. Validate slot is active
    if (!isSlotActive(slotId)) {
      return res.json({
        candidates: [],
        slotStatus: "closed",
        message: `This meal slot has ended. Update your preferences to a future slot.`,
      });
    }

    // 3. Check current user's state for this slot
    const myState = await getOrCreateState(currentUser._id, slotId);

    if (myState.state === "matched") {
      // Return match details so UI can show the locked screen
      const match = await Match.findById(myState.matchId).populate(
        "users",
        "name birthday profilePic college"
      );
      const partner = match?.users.find(
        (u) => u._id.toString() !== currentUser._id.toString()
      );
      return res.json({
        candidates: [],
        isLocked: true,
        slotStatus: "active",
        activeMatch: match
          ? { _id: match._id, user: partner, mealTime: match.mealTime, mealDate: match.mealDate }
          : null,
        message: `You're matched for ${pref.mealTime}! 🔒`,
      });
    }

    if (myState.state === "in_community") {
      const community = await Community.findById(myState.communityId);
      return res.json({
        candidates: [],
        isLocked: true,
        slotStatus: "active",
        activeCommunity: community
          ? { _id: community._id, name: community.name, mealTime: community.mealTime, mealDate: community.mealDate }
          : null,
        message: `You're in a group meal for ${pref.mealTime}! 👥`,
      });
    }

    // 4. Fetch candidate states: only idle/liked in same slot
    const candidateStates = await UserSlotState.find({
      slotId,
      state: { $in: ["idle", "liked"] },
      userId: { $ne: currentUser._id },
    });

    const candidateIds = candidateStates.map((s) => s.userId);

    // 🔥 NEW: Filter out users who are NOT in Solo Mode (groupSize < 3)
    let eligibleSoloIds = [];
    if (candidateIds.length > 0) {
      const candidatePrefs = await Preference.find({
        user: { $in: candidateIds },
        groupSize: { $lt: 3 },
      });
      eligibleSoloIds = candidatePrefs.map((p) => p.user);
    }

    // 5. Remove already-interacted users
    const prevInteractions = await Like.find({
      fromUser: currentUser._id,
      slotId,
    });
    const interactedSet = new Set(prevInteractions.map((l) => l.toUser.toString()));

    // 6. Filter by college + gender preference
    const genderFilter =
      pref.preferredGender && pref.preferredGender !== "any"
        ? { gender: pref.preferredGender }
        : {};

    const users = await User.find({
      _id: { $in: eligibleSoloIds, $nin: [...interactedSet] },
      college: currentUser.college,
      ...genderFilter,
    }).select("name birthday gender college bio interests profilePic prompts");

    // 7. Rank by interest + age similarity
    const ranked = users
      .map((u) => {
        const interestScore = cosineSimilarity(
          currentUser.interests || [],
          u.interests || []
        );
        const ageDiff = Math.abs((currentUser.age || 20) - (u.age || 20));
        const ageScore = Math.max(0, 1 - ageDiff / 10);
        const sharedInterests = (currentUser.interests || []).filter((i) =>
          (u.interests || []).includes(i)
        );
        return {
          ...u.toObject(),
          matchScore: interestScore * 0.7 + ageScore * 0.3,
          sharedInterests,
        };
      })
      .filter((u) => u.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ candidates: ranked, slotStatus: "active" });
  } catch (error) {
    console.error("[matchController] getCandidates:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── LIKE USER ────────────────────────────────────────────────────────────────

/**
 * POST /api/match/like  { targetUserId }
 * Like another user in the current slot.
 * On mutual like → both states become "matched".
 */
const likeUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    // 1. Resolve slot
    const { slotId, pref, error } = await resolveSlot(fromUserId);
    if (error) return res.status(400).json({ message: error });

    // 2. Validate slot is active
    if (!isSlotActive(slotId)) {
      return res.status(400).json({
        slotStatus: "closed",
        message: "This meal slot has already ended. You cannot like in a closed slot.",
      });
    }

    // 3. Check sender's state — must be idle or liked
    const myState = await getOrCreateState(fromUserId, slotId);

    if (myState.state === "matched") {
      return res.status(400).json({ message: "You already have a match for this slot! 🔒" });
    }
    if (myState.state === "in_community") {
      return res.status(400).json({ message: "You're in a group meal. You cannot send likes. 👥" });
    }

    // 4. Check target's state — must be idle or liked
    const targetState = await getOrCreateState(targetUserId, slotId);

    if (targetState.state === "matched") {
      return res.status(400).json({ message: "This user is already matched for this slot." });
    }
    if (targetState.state === "in_community") {
      return res.status(400).json({ message: "This user is in a group meal for this slot." });
    }

    // 5. Record the like (idempotent — ignore duplicates)
    const existingLike = await Like.findOne({
      fromUser: fromUserId,
      toUser: targetUserId,
      slotId,
    });
    if (existingLike && existingLike.status !== "pending") {
      return res.status(400).json({ message: "Already interacted with this user in this slot." });
    }
    if (!existingLike) {
      await Like.create({ fromUser: fromUserId, toUser: targetUserId, slotId, status: "pending" });
    }

    // 6. Update sender's state to "liked" (if still idle)
    if (myState.state === "idle") {
      await setState(fromUserId, slotId, "liked");
    }

    // 7. Check for mutual like → trigger match
    const reciprocalLike = await Like.findOne({
      fromUser: targetUserId,
      toUser: fromUserId,
      slotId,
      status: "pending",
    });

    if (reciprocalLike) {
      // 🎉 MUTUAL MATCH — create match and update both states
      const newMatch = await Match.create({
        users: [fromUserId, targetUserId],
        slotId,
        mealTime: pref.mealTime,
        mealDate: pref.mealDate,
        status: "active",
      });

      // Mark both likes as matched
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

      // 🔥 Update BOTH users' state → matched
      await setState(fromUserId, slotId, "matched", { matchId: newMatch._id });
      await setState(targetUserId, slotId, "matched", { matchId: newMatch._id });

      return res.status(201).json({
        message: "🎉 It's a match!",
        isMatch: true,
        matchId: newMatch._id,
      });
    }

    return res.status(201).json({ message: "Liked! Waiting for them to like back.", isMatch: false });
  } catch (error) {
    console.error("[matchController] likeUser:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── SKIP USER ────────────────────────────────────────────────────────────────

/**
 * POST /api/match/skip  { targetUserId }
 * Skip a user in the current slot (they won't appear again).
 */
const skipUser = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const fromUserId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ message: "targetUserId is required" });
    }

    const { slotId, error } = await resolveSlot(fromUserId);
    if (error) return res.status(400).json({ message: error });

    if (!isSlotActive(slotId)) {
      return res.status(400).json({ slotStatus: "closed", message: "This slot has ended." });
    }

    // Idempotent skip — use findOneAndUpdate to avoid duplicate key errors
    await Like.findOneAndUpdate(
      { fromUser: fromUserId, toUser: targetUserId, slotId },
      { $setOnInsert: { fromUser: fromUserId, toUser: targetUserId, slotId, status: "skipped" } },
      { upsert: true }
    );

    return res.status(201).json({ message: "Skipped." });
  } catch (error) {
    console.error("[matchController] skipUser:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── GET LIKES RECEIVED ───────────────────────────────────────────────────────

/**
 * GET /api/match/likes-received
 * Returns pending incoming likes for the user's current slot.
 */
const getLikesReceived = async (req, res) => {
  try {
    const currentUser = req.user;

    const { slotId, error } = await resolveSlot(currentUser._id);
    if (error) return res.json({ likes: [], message: error });

    const myState = await getOrCreateState(currentUser._id, slotId);

    if (myState.state === "matched") {
      return res.json({ likes: [], isLocked: true, message: "You already have a match for this slot! 🔒" });
    }

    const likes = await Like.find({
      toUser: currentUser._id,
      slotId,
      status: "pending",
    }).populate("fromUser", "name birthday college bio interests profilePic");

    const usersWhoLiked = likes
      .map((l) => {
        if (!l.fromUser) return null;
        // Access age virtual explicitly to ensure it pops up in the plain object
        const age = l.fromUser.age; 
        return {
          _id: l.fromUser._id,
          name: l.fromUser.name,
          age: age,
          birthday: l.fromUser.birthday,
          college: l.fromUser.college,
          bio: l.fromUser.bio,
          interests: l.fromUser.interests,
          profilePic: l.fromUser.profilePic,
          likeId: l._id,
        };
      })
      .filter(Boolean);

    return res.json({ likes: usersWhoLiked });
  } catch (error) {
    console.error("[matchController] getLikesReceived:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── IGNORE LIKE ──────────────────────────────────────────────────────────────

/**
 * POST /api/match/ignore  { likeId }
 * Dismiss an incoming like without matching.
 */
const ignoreLike = async (req, res) => {
  try {
    const { likeId } = req.body;
    await Like.findByIdAndUpdate(likeId, { status: "skipped" });
    return res.json({ message: "Like ignored." });
  } catch (error) {
    console.error("[matchController] ignoreLike:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/match/list
 * Returns all active/completed 1-1 matches for the user.
 */
const getMatches = async (req, res) => {
  try {
    const currentUser = req.user;

    const matches = await Match.find({
      users: currentUser._id,
    }).populate("users", "name birthday college bio interests profilePic prompts");

    const soloMatches = matches
      .map((match) => {
        const partner = match.users.find(
          (u) => u._id.toString() !== currentUser._id.toString()
        );
        if (!partner) return null;
        return {
          _id: match._id,
          type: "solo",
          slotId: match.slotId,
          mealTime: match.mealTime,
          mealDate: match.mealDate,
          status: match.status,
          createdAt: match.createdAt,
          user: partner,
        };
      })
      .filter(Boolean);

    // Sort by date
    const sorted = soloMatches.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json({ matches: sorted });
  } catch (error) {
    console.error("[matchController] getMatches:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── UNMATCH ──────────────────────────────────────────────────────────────────

/**
 * POST /api/match/unmatch  { matchId }
 * Dissolve a match and reset both users' states to idle for that slot.
 */
const unmatchUser = async (req, res) => {
  try {
    const { matchId } = req.body;
    const currentUser = req.user;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found." });

    // Delete the match
    await Match.findByIdAndDelete(matchId);

    // Delete associated likes so they can rematch later
    const [u1, u2] = match.users;
    await Like.deleteMany({
      slotId: match.slotId,
      $or: [
        { fromUser: u1, toUser: u2 },
        { fromUser: u2, toUser: u1 },
      ],
    });

    // 🔥 Reset BOTH users' states → idle
    await UserSlotState.updateMany(
      { matchId, slotId: match.slotId },
      { $set: { state: "idle", matchId: null } }
    );

    return res.json({ message: "Unmatched successfully." });
  } catch (error) {
    console.error("[matchController] unmatchUser:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─── COMPLETE MATCH ───────────────────────────────────────────────────────────

/**
 * POST /api/match/complete  { matchId }
 * Mark a meal as completed and reset both users' states.
 */
const completeMatch = async (req, res) => {
  try {
    const { matchId } = req.body;

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: "Match not found." });

    // Mark match as completed
    match.status = "completed";
    await match.save();

    // 🔥 Reset BOTH users' states → idle
    await UserSlotState.updateMany(
      { matchId, slotId: match.slotId },
      { $set: { state: "idle", matchId: null } }
    );

    return res.json({ message: "🎉 Hope you had a great meal! Match history saved." });
  } catch (error) {
    console.error("[matchController] completeMatch:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCandidates,
  likeUser,
  skipUser,
  getMatches,
  getLikesReceived,
  ignoreLike,
  unmatchUser,
  completeMatch,
};