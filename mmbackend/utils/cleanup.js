/**
 * cleanup.js — auto-expiry for slot-scoped state.
 *
 * Runs every 5 minutes. For every slot whose cut-off has passed:
 *   1. active Matches      → marked expired, both states reset to idle
 *   2. Communities         → deleted, all member states reset to idle
 *   3. pending Likes       → deleted (they can never resolve now)
 *   4. leftover "liked"    → reset to idle
 *   5. chat threads        → deleted with their match/table
 *
 * Dates are computed in IST. The previous version used
 * `new Date().toISOString()` (UTC), so between 00:00 and 05:30 IST it looked at
 * the wrong day and left yesterday's matches hanging.
 */

const Match = require("../models/Match");
const Community = require("../models/Community");
const Like = require("../models/Like");
const Message = require("../models/Message");
const UserSlotState = require("../models/UserSlotState");
const { getSlotExpiry, MEAL_TYPES, todayStr, shiftDateStr } = require("./slotUtils");

/** Slots from the last 3 IST days whose cut-off has passed. */
const buildExpiredSlotIds = () => {
  const now = Date.now();
  const today = todayStr();
  const out = [];

  for (let offset = 0; offset <= 2; offset++) {
    const dateStr = shiftDateStr(today, -offset);
    for (const mealType of MEAL_TYPES) {
      const slotId = `${dateStr}_${mealType}`;
      if (now >= getSlotExpiry(slotId).getTime()) out.push(slotId);
    }
  }
  return out;
};

const runAutoCleanup = async () => {
  const expired = buildExpiredSlotIds();
  if (expired.length === 0) return { matches: 0, communities: 0, likes: 0 };

  const summary = { matches: 0, communities: 0, likes: 0 };

  // 1. Matches
  const staleMatches = await Match.find({ slotId: { $in: expired }, status: "active" })
    .select("_id")
    .lean();
  if (staleMatches.length) {
    const ids = staleMatches.map((m) => m._id);
    await Match.updateMany({ _id: { $in: ids } }, { $set: { status: "expired" } });
    await UserSlotState.updateMany(
      { matchId: { $in: ids } },
      { $set: { state: "idle", matchId: null } }
    );
    await Message.deleteMany({ threadType: "match", threadId: { $in: ids } });
    summary.matches = ids.length;
  }

  // 2. Communities
  const staleTables = await Community.find({ slotId: { $in: expired } }).select("_id").lean();
  if (staleTables.length) {
    const ids = staleTables.map((c) => c._id);
    await UserSlotState.updateMany(
      { communityId: { $in: ids } },
      { $set: { state: "idle", communityId: null } }
    );
    await Message.deleteMany({ threadType: "community", threadId: { $in: ids } });
    await Community.deleteMany({ _id: { $in: ids } });
    summary.communities = ids.length;
  }

  // 3. Unresolved likes
  const removed = await Like.deleteMany({ slotId: { $in: expired }, status: "pending" });
  summary.likes = removed.deletedCount || 0;

  // 4. Anything still sitting in "liked" for a dead slot
  await UserSlotState.updateMany(
    { slotId: { $in: expired }, state: "liked" },
    { $set: { state: "idle" } }
  );

  // 5. Drop state rows older than a week — they have no further use.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await UserSlotState.deleteMany({ updatedAt: { $lt: weekAgo }, state: "idle" });

  if (summary.matches || summary.communities || summary.likes) {
    console.log(
      `[cleanup] expired ${summary.matches} match(es), ${summary.communities} table(s), ${summary.likes} like(s)`
    );
  }
  return summary;
};

module.exports = { runAutoCleanup, buildExpiredSlotIds };
