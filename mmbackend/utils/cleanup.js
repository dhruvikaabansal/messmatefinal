/**
 * cleanup.js — Auto-Expiry System for Slot-Based State Architecture.
 *
 * Runs every 5 minutes via setInterval in server.js.
 *
 * What it does on each run:
 *   1. Find all slots that have expired (past their cut-off hour)
 *   2. Delete active Matches for those slots → reset UserSlotState → idle
 *   3. Delete Communities for those slots → reset UserSlotState → idle
 *   4. Delete pending/unresolved Likes for those slots (no longer relevant)
 *
 * This guarantees state returns to idle automatically, even when users are offline.
 * Cross-slot safety: only expired slots are touched.
 */

const Match = require("../models/Match");
const Community = require("../models/Community");
const Like = require("../models/Like");
const UserSlotState = require("../models/UserSlotState");
const { getSlotExpiry, MEAL_TYPES } = require("./slotUtils");

/**
 * Build a list of all slot IDs (date_mealType) for the past 3 days.
 * This covers any delayed cleanup runs without being too broad.
 */
const buildExpiredSlotIds = () => {
  const now = new Date();
  const expiredSlots = [];

  // Check today and the past 2 days
  for (let dayOffset = 0; dayOffset <= 2; dayOffset++) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);
    const dateStr = d.toISOString().split("T")[0];

    for (const mealType of MEAL_TYPES) {
      const slotId = `${dateStr}_${mealType}`;
      const expiry = getSlotExpiry(slotId);
      if (now >= expiry) {
        expiredSlots.push(slotId);
      }
    }
  }

  return expiredSlots;
};

/**
 * Main cleanup runner — called every 5 minutes.
 */
const runAutoCleanup = async () => {
  try {
    const expiredSlotIds = buildExpiredSlotIds();

    if (expiredSlotIds.length === 0) {
      console.log("[CLEANUP] No expired slots to process.");
      return;
    }

    console.log(`[CLEANUP] Processing ${expiredSlotIds.length} expired slots...`);

    // ── 1. DISSOLVE ACTIVE MATCHES ─────────────────────────────────────────
    const expiredMatches = await Match.find({
      slotId: { $in: expiredSlotIds },
      status: "active",
    });

    if (expiredMatches.length > 0) {
      const expiredMatchIds = expiredMatches.map((m) => m._id);

      // Mark as expired (keep for history)
      await Match.updateMany(
        { _id: { $in: expiredMatchIds } },
        { $set: { status: "expired" } }
      );

      // 🔥 Reset all UserSlotState records pointing to these matches → idle
      await UserSlotState.updateMany(
        { matchId: { $in: expiredMatchIds } },
        { $set: { state: "idle", matchId: null } }
      );

      console.log(`[CLEANUP] Expired ${expiredMatches.length} match(es) and reset associated states.`);
    }

    // ── 2. DISSOLVE COMMUNITIES ────────────────────────────────────────────
    const expiredCommunities = await Community.find({
      slotId: { $in: expiredSlotIds },
    });

    if (expiredCommunities.length > 0) {
      const expiredCommunityIds = expiredCommunities.map((c) => c._id);

      // 🔥 Reset all UserSlotState records pointing to these communities → idle
      await UserSlotState.updateMany(
        { communityId: { $in: expiredCommunityIds } },
        { $set: { state: "idle", communityId: null } }
      );

      // Delete the communities (ephemeral — no history needed)
      await Community.deleteMany({ _id: { $in: expiredCommunityIds } });

      console.log(`[CLEANUP] Dissolved ${expiredCommunities.length} community(ies) and reset associated states.`);
    }

    // ── 3. PURGE PENDING LIKES FOR EXPIRED SLOTS ──────────────────────────
    const deletedLikes = await Like.deleteMany({
      slotId: { $in: expiredSlotIds },
      status: "pending", // keep "matched" and "skipped" for history
    });

    // Also reset any "liked" states in expired slots to idle
    // (these have no associated match/community, cleanup above covers the rest)
    await UserSlotState.updateMany(
      {
        slotId: { $in: expiredSlotIds },
        state: "liked",
      },
      { $set: { state: "idle" } }
    );

    if (deletedLikes.deletedCount > 0) {
      console.log(`[CLEANUP] Purged ${deletedLikes.deletedCount} pending like(s) from expired slots.`);
    }

    console.log("[CLEANUP] Cleanup cycle complete. ✅");
  } catch (error) {
    console.error("[CLEANUP ERROR]:", error);
  }
};

module.exports = { runAutoCleanup };
