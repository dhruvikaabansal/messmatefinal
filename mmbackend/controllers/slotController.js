const Preference = require("../models/Preference");
const UserSlotState = require("../models/UserSlotState");
const Like = require("../models/Like");
const Match = require("../models/Match");
const Community = require("../models/Community");
const User = require("../models/User");
const cosineSimilarity = require("../utils/cosineSimilarity");
const { buildSlotId, isSlotActive, slotIdFromPref } = require("../utils/slotUtils");

/**
 * GET /api/slot/status
 * Optional query params: ?date=YYYY-MM-DD&mealType=lunch
 * If not provided, uses the user's current Preference document.
 *
 * This is the primary "frontend contract" endpoint.
 * The frontend calls this ONCE and renders entirely from the response.
 *
 * Response shape:
 * {
 *   slotId:        string,
 *   slotStatus:    "active" | "closed",
 *   state:         "idle" | "liked" | "matched" | "in_community",
 *   availableUsers: User[],     // only if state is idle/liked
 *   likesReceived:  User[],     // only if state is idle/liked
 *   matchData:      Match|null, // only if state is matched
 *   communityData:  Community|null // only if state is in_community
 * }
 */
const getSlotStatus = async (req, res) => {
  try {
    const currentUser = req.user;

    // ── 1. Determine the slotId ─────────────────────────────────────────────
    let slotId;
    if (req.query.date && req.query.mealType) {
      slotId = buildSlotId(req.query.date, req.query.mealType);
    } else {
      const pref = await Preference.findOne({ user: currentUser._id });
      if (!pref) {
        return res.status(400).json({ message: "Set your meal preferences first." });
      }
      // Guard: if stored mealDate is in the past, fall back to IST today
      const { todayStr } = require("../utils/slotUtils");
      const safeDate = (pref.mealDate && pref.mealDate >= todayStr())
        ? pref.mealDate
        : todayStr();
      slotId = buildSlotId(safeDate, pref.mealTime);
    }

    // ── 2. Check if slot is still active ────────────────────────────────────
    const slotStatus = isSlotActive(slotId) ? "active" : "closed";

    // ── 3. Get or create the user's state for this slot ──────────────────────
    // Use findOneAndUpdate with upsert to avoid E11000 race conditions
    const slotState = await UserSlotState.findOneAndUpdate(
      { userId: currentUser._id, slotId },
      { $setOnInsert: { userId: currentUser._id, slotId, state: "idle" } },
      { upsert: true, new: true }
    );

    const state = slotState.state;

    // ── 4. Build response payload based on state ─────────────────────────────
    let availableUsers = [];
    let likesReceived = [];
    let matchData = null;
    let communityData = null;

    if (state === "matched") {
      // Return match + partner details
      if (slotState.matchId) {
        const match = await Match.findById(slotState.matchId).populate(
          "users",
          "name birthday college bio interests profilePic prompts"
        );
        if (match) {
          const partner = match.users.find(
            (u) => u._id.toString() !== currentUser._id.toString()
          );
          matchData = {
            _id: match._id,
            slotId: match.slotId,
            mealTime: match.mealTime,
            mealDate: match.mealDate,
            status: match.status,
            user: partner || null,
          };
        }
      }
    } else if (state === "in_community") {
      // Return community details
      if (slotState.communityId) {
        communityData = await Community.findById(slotState.communityId)
          .populate("members", "name age profilePic college")
          .populate("createdBy", "name profilePic");
      }
    } else {
      // idle or liked — show discovery data
      if (slotStatus === "active") {
        // Get preference for this slot (for filtering by gender, etc.)
        const pref = await Preference.findOne({ user: currentUser._id });
        const gSize = pref?.groupSize || 2;

        // 🔥 RULE: Only Solo Mode users (groupSize < 3) can see 1-on-1 matches
        if (gSize < 3) {
          // Find all UserSlotStates for this slot that are idle or liked
          const availableStates = await UserSlotState.find({
            slotId,
            state: { $in: ["idle", "liked"] },
            userId: { $ne: currentUser._id },
          });

          let eligibleUserIds = availableStates.map((s) => s.userId);

          // 🔥 NEW: Only show users who ARE ALSO in Solo Mode (groupSize < 3)
          if (eligibleUserIds.length > 0) {
            const preferences = await Preference.find({
              user: { $in: eligibleUserIds },
              groupSize: { $lt: 3 },
            });
            eligibleUserIds = preferences.map((p) => p.user);
          }

          // Get like/skip history to avoid showing already-interacted users
          const interacted = await Like.find({
            fromUser: currentUser._id,
            slotId,
          });
          const interactedIds = new Set(interacted.map((l) => l.toUser.toString()));

          // Build the user filter
          const genderFilter =
            pref?.preferredGender && pref.preferredGender !== "any"
              ? { gender: pref.preferredGender }
              : {};

          const eligibleUsers = await User.find({
            _id: { $in: eligibleUserIds, $nin: [...interactedIds] },
            college: currentUser.college,
            ...genderFilter,
          }).select("name birthday gender college bio interests profilePic prompts");

          // Rank by interest similarity
          availableUsers = eligibleUsers
            .map((u) => {
              const score = cosineSimilarity(
                currentUser.interests || [],
                u.interests || []
              );
              const ageDiff = Math.abs((currentUser.age || 20) - (u.age || 20));
              const ageScore = Math.max(0, 1 - ageDiff / 10);
              return {
                ...u.toObject(),
                matchScore: score * 0.7 + ageScore * 0.3,
              };
            })
            .filter((u) => u.matchScore > 0)
            .sort((a, b) => b.matchScore - a.matchScore);
        }

        // Incoming pending likes
        const rawLikes = await Like.find({
          toUser: currentUser._id,
          slotId,
          status: "pending",
        }).populate("fromUser", "name birthday college bio interests profilePic");

        likesReceived = rawLikes.map((l) => ({
          likeId: l._id,
          ...l.fromUser.toObject(),
        }));
      }
    }

    // ── 5. Send unified response ─────────────────────────────────────────────
    // Fetch groupSize one last time to ensure it's in the response
    const currentPref = await Preference.findOne({ user: currentUser._id });
  
    // ── 5. Send unified response ─────────────────────────────────────────────
    const [mDate, mType] = slotId.split("_");
  
    return res.json({
      slotId,
      mealDate: mDate,
      mealTime: mType,
      slotStatus,
      state,
      userId: currentUser._id,
      groupSize: currentPref?.groupSize || 2, 
      availableUsers,
      likesReceived,
      matchData,
      communityData,
    });
  } catch (error) {
    console.error("[slotController] getSlotStatus error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSlotStatus };
