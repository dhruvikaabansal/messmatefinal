/**
 * feedService.js — the one place that decides what a user sees for a slot.
 *
 * Previously this logic existed twice (matchController.getCandidates and
 * slotController.getSlotStatus) with subtly different rules, so the swipe deck
 * and the "what's my state" endpoint could disagree. Everything now funnels
 * through here.
 */

const User = require("../models/User");
const Like = require("../models/Like");
const Match = require("../models/Match");
const Message = require("../models/Message");
const Community = require("../models/Community");
const Preference = require("../models/Preference");
const UserSlotState = require("../models/UserSlotState");

const {
  buildIdf,
  scoreCandidate,
  scoreTable,
  genderCompatible,
} = require("../utils/matching");
const { calculateAge } = require("../utils/ageUtils");
const {
  parseSlotId,
  isSlotActive,
  minutesUntilSlotCloses,
  MEAL_LABELS,
} = require("../utils/slotUtils");

/**
 * Mongoose `.lean()` skips virtuals, so age is attached explicitly. Lean is
 * worth keeping here: the deck can touch a few hundred documents per request.
 */
const withAge = (u) => (u ? { ...u, age: calculateAge(u.birthday) } : u);

/** Below this many strict-filter results we widen the net rather than show an empty deck. */
const MIN_DECK_SIZE = 6;

// ─── STATE HELPERS ──────────────────────────────────────────────────────────

const getOrCreateState = (userId, slotId) =>
  UserSlotState.findOneAndUpdate(
    { userId, slotId },
    { $setOnInsert: { userId, slotId, state: "idle" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

const setState = (userId, slotId, state, extra = {}) =>
  UserSlotState.findOneAndUpdate(
    { userId, slotId },
    { $set: { state, matchId: null, communityId: null, ...extra } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

// ─── FEED BUILDER ───────────────────────────────────────────────────────────

/**
 * Build the ranked people deck for a viewer in a slot.
 * Returns { people, expanded } where `expanded` means we had to relax the
 * gender filter to fill the deck (the UI says so instead of silently lying).
 */
const buildPeopleDeck = async ({ viewer, viewerPref, slotId }) => {
  const { date: mealDate, mealType: mealTime } = parseSlotId(slotId);

  // 1. Everyone who signed up for this exact slot.
  const slotPrefs = await Preference.find({
    mealDate,
    mealTime,
    isAvailable: true,
    user: { $ne: viewer._id },
  }).lean();

  if (slotPrefs.length === 0) return { people: [], expanded: false };

  const prefByUser = new Map(slotPrefs.map((p) => [p.user.toString(), p]));
  const candidateIds = slotPrefs.map((p) => p.user);

  // 2. Drop anyone already locked into a match or a table for this slot.
  const busyStates = await UserSlotState.find({
    slotId,
    userId: { $in: candidateIds },
    state: { $in: ["matched", "in_community"] },
  })
    .select("userId")
    .lean();
  const busy = new Set(busyStates.map((s) => s.userId.toString()));

  // 3. Drop anyone this viewer already liked or skipped in this slot.
  const interactions = await Like.find({ fromUser: viewer._id, slotId })
    .select("toUser")
    .lean();
  const interacted = new Set(interactions.map((l) => l.toUser.toString()));

  const openIds = candidateIds.filter((id) => {
    const key = id.toString();
    return !busy.has(key) && !interacted.has(key);
  });
  if (openIds.length === 0) return { people: [], expanded: false };

  // 4. Load the actual profiles (same college, still available).
  const users = await User.find({
    _id: { $in: openIds },
    college: viewer.college,
    isAvailable: true,
  })
    .select(User.CARD_FIELDS)
    .lean()
    .then((list) => list.map(withAge));

  if (users.length === 0) return { people: [], expanded: false };

  // 5. Signals that need one query each, not one per candidate.
  const [likesToMe, likeCounts] = await Promise.all([
    Like.find({ toUser: viewer._id, slotId, status: "pending" })
      .select("fromUser")
      .lean(),
    Like.aggregate([
      { $match: { slotId, status: "pending" } },
      { $group: { _id: "$toUser", n: { $sum: 1 } } },
    ]),
  ]);
  const likedMeSet = new Set(likesToMe.map((l) => l.fromUser.toString()));
  const popularity = new Map(likeCounts.map((c) => [c._id.toString(), c.n]));
  const poolPopularity = Math.max(0, ...popularity.values(), 0);

  const idf = buildIdf([...users, viewer]);

  const score = (u) =>
    scoreCandidate({
      viewer,
      candidate: u,
      idf,
      likedMe: likedMeSet.has(u._id.toString()),
      popularity: popularity.get(u._id.toString()) || 0,
      poolPopularity,
      lastActiveAt: u.lastActiveAt,
      slotId,
    });

  // 6. Two-way gender compatibility as the strict tier.
  const strict = [];
  const relaxed = [];
  for (const u of users) {
    const theirPref = prefByUser.get(u._id.toString());
    if (genderCompatible(viewer, viewerPref, u, theirPref)) strict.push(u);
    else relaxed.push(u);
  }

  let expanded = false;
  let chosen = strict;
  if (strict.length < MIN_DECK_SIZE && relaxed.length > 0) {
    // Someone whose own filter excludes the viewer is still hidden — liking
    // them could never match. Only viewers' own filters get relaxed.
    const onlyViewerFilterBlocked = relaxed.filter((u) => {
      const theirPref = prefByUser.get(u._id.toString());
      const theyWant = (theirPref?.preferredGender || "any").toLowerCase();
      return theyWant === "any" || theyWant === (viewer.gender || "").toLowerCase();
    });
    if (onlyViewerFilterBlocked.length > 0) {
      expanded = true;
      chosen = [...strict, ...onlyViewerFilterBlocked];
    }
  }

  const people = chosen
    .map((u) => {
      const s = score(u);
      const theirPref = prefByUser.get(u._id.toString());
      const outsideStrict = !genderCompatible(viewer, viewerPref, u, theirPref);
      return {
        kind: "person",
        _id: u._id,
        name: u.name,
        age: u.age,
        gender: u.gender,
        college: u.college,
        bio: u.bio,
        interests: u.interests,
        clubs: u.clubs,
        intent: u.intent,
        foodPreference: u.foodPreference,
        personalityType: u.personalityType,
        profilePic: u.profilePic,
        prompts: u.prompts,
        matchScore: s.score,
        sharedInterests: s.sharedInterests,
        likedMe: s.likedMe,
        isActiveNow: s.isActiveNow,
        reasons: s.reasons,
        breakdown: s.breakdown,
        outsideYourFilter: outsideStrict,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return { people, expanded };
};

/** Build the ranked open-table list for a viewer in a slot. */
const buildTableDeck = async ({ viewer, slotId }) => {
  const tables = await Community.find({ slotId, college: viewer.college })
    .populate("members", "name profilePic birthday interests")
    .populate("createdBy", "name profilePic")
    .lean();

  if (tables.length === 0) return [];

  const idf = buildIdf([
    ...tables.flatMap((t) => t.members || []),
    viewer,
  ]);

  return tables
    .filter((t) => !(t.members || []).some((m) => m._id.toString() === viewer._id.toString()))
    .map((t) => {
      const s = scoreTable({ viewer, table: t, idf, slotId });
      return {
        kind: "table",
        _id: t._id,
        name: t.name,
        description: t.description,
        venue: t.venue,
        interests: t.interests,
        mealTime: t.mealTime,
        mealDate: t.mealDate,
        maxMembers: t.maxMembers,
        seatsLeft: s.seatsLeft,
        isFull: s.seatsLeft === 0,
        members: (t.members || []).map((m) => ({
          _id: m._id,
          name: m.name,
          profilePic: m.profilePic,
        })),
        createdBy: t.createdBy,
        matchScore: s.score,
        sharedInterests: s.sharedInterests,
        reasons: s.reasons,
      };
    })
    .sort((a, b) => {
      if (a.isFull !== b.isFull) return a.isFull ? 1 : -1;
      return b.matchScore - a.matchScore;
    });
};

/**
 * Interleave people and tables into one deck.
 *
 * Straight score-sorting would bury tables (they score on a different scale),
 * so instead a table is slotted in every `TABLE_EVERY` cards. The result reads
 * as one feed while guaranteeing group tables get real exposure.
 */
const TABLE_EVERY = 4;
const interleave = (people, tables, openTo) => {
  if (openTo === "solo") return people;
  if (openTo === "group") return [...tables, ...people];

  const out = [];
  let ti = 0;
  for (let i = 0; i < people.length; i++) {
    out.push(people[i]);
    if ((i + 1) % TABLE_EVERY === 0 && ti < tables.length) out.push(tables[ti++]);
  }
  while (ti < tables.length) out.push(tables[ti++]);
  return out;
};

// ─── UNREAD COUNTS ──────────────────────────────────────────────────────────

const unreadCountFor = async (userId, threadType, threadId) => {
  if (!threadId) return 0;
  return Message.countDocuments({
    threadType,
    threadId,
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });
};

// ─── MAIN ENTRY ─────────────────────────────────────────────────────────────

/**
 * Everything the app needs to render any screen for one slot, in one call.
 */
const getSlotSnapshot = async ({ viewer, slotId, viewerPref }) => {
  const { date: mealDate, mealType: mealTime } = parseSlotId(slotId);
  const open = isSlotActive(slotId);

  const state = await getOrCreateState(viewer._id, slotId);

  const base = {
    slotId,
    mealDate,
    mealTime,
    mealLabel: MEAL_LABELS[mealTime] || null,
    slotStatus: open ? "active" : "closed",
    minutesLeft: minutesUntilSlotCloses(slotId),
    state: state.state,
    userId: viewer._id,
    openTo: viewerPref?.openTo || "both",
    groupSize: viewerPref?.groupSize || 4,
    preferredGender: viewerPref?.preferredGender || "any",
    feed: [],
    people: [],
    tables: [],
    likesReceived: [],
    matchData: null,
    communityData: null,
    expandedSearch: false,
    unread: 0,
  };

  // ── Locked into a 1-on-1 match ──
  if (state.state === "matched" && state.matchId) {
    const match = await Match.findById(state.matchId)
      .populate("users", User.CARD_FIELDS)
      .lean();
    if (match) {
      const partner = withAge(
        match.users.find((u) => u._id.toString() !== viewer._id.toString())
      );
      base.matchData = {
        _id: match._id,
        slotId: match.slotId,
        mealTime: match.mealTime,
        mealDate: match.mealDate,
        status: match.status,
        user: partner || null,
      };
      base.unread = await unreadCountFor(viewer._id, "match", match._id);
      return base;
    }
    // Match vanished (cleanup raced us) — fall through as idle.
    await setState(viewer._id, slotId, "idle");
    base.state = "idle";
  }

  // ── Locked into a group table ──
  if (state.state === "in_community" && state.communityId) {
    const community = await Community.findById(state.communityId)
      .populate("members", "name profilePic birthday college interests")
      .populate("createdBy", "name profilePic")
      .lean();
    if (community) {
      base.communityData = {
        ...community,
        isCreator: community.createdBy?._id?.toString() === viewer._id.toString(),
        seatsLeft: Math.max(0, community.maxMembers - (community.members || []).length),
      };
      base.unread = await unreadCountFor(viewer._id, "community", community._id);
      return base;
    }
    await setState(viewer._id, slotId, "idle");
    base.state = "idle";
  }

  // ── Closed slot: nothing to browse ──
  if (!open) return base;

  // ── Open: build the deck ──
  const [{ people, expanded }, tables, rawLikes] = await Promise.all([
    buildPeopleDeck({ viewer, viewerPref, slotId }),
    buildTableDeck({ viewer, slotId }),
    Like.find({ toUser: viewer._id, slotId, status: "pending" })
      .populate("fromUser", User.CARD_FIELDS)
      .lean()
      .then((list) => list.map((l) => ({ ...l, fromUser: withAge(l.fromUser) }))),
  ]);

  base.people = people;
  base.tables = tables;
  base.expandedSearch = expanded;
  base.feed = interleave(people, tables, base.openTo);

  const likeIdf = buildIdf([...rawLikes.map((l) => l.fromUser).filter(Boolean), viewer]);
  base.likesReceived = rawLikes
    .filter((l) => l.fromUser)
    .map((l) => {
      const s = scoreCandidate({
        viewer,
        candidate: l.fromUser,
        idf: likeIdf,
        likedMe: true,
        lastActiveAt: l.fromUser.lastActiveAt,
        slotId,
      });
      return {
        likeId: l._id,
        _id: l.fromUser._id,
        name: l.fromUser.name,
        age: l.fromUser.age,
        college: l.fromUser.college,
        bio: l.fromUser.bio,
        interests: l.fromUser.interests,
        profilePic: l.fromUser.profilePic,
        prompts: l.fromUser.prompts,
        matchScore: s.score,
        sharedInterests: s.sharedInterests,
        reasons: s.reasons.filter((r) => r.icon !== "💘"),
        likedAt: l.createdAt,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return base;
};

module.exports = {
  getSlotSnapshot,
  buildPeopleDeck,
  buildTableDeck,
  getOrCreateState,
  setState,
  unreadCountFor,
};
