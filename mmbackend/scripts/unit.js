/**
 * unit.js — pure-logic tests. No database, no network, runs in milliseconds.
 *
 *   npm run test:unit
 *
 * These cover the parts most likely to break silently: the slot/timezone maths
 * and the ranking engine. The database-backed journey lives in e2e.js.
 */

process.env.TZ = process.env.TZ || "UTC";

let passed = 0;
let failed = 0;
const failures = [];

const check = (name, cond, detail = "") => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
};
const section = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 58 - t.length))}`);

const slot = require("../utils/slotUtils");
const {
  buildIdf,
  scoreCandidate,
  scoreTable,
  genderCompatible,
  interestScore,
  hash01,
} = require("../utils/matching");
const { calculateAge } = require("../utils/ageUtils");

// ─── SLOT / TIMEZONE ────────────────────────────────────────────────────────
section("Slot and timezone maths");

const { dateStr, hour } = slot.getISTNow();
check("IST date is well formed", /^\d{4}-\d{2}-\d{2}$/.test(dateStr), dateStr);
check("IST hour is in range", hour >= 0 && hour < 24, String(hour));

// The old implementation added getTimezoneOffset() on top of the UTC epoch,
// which shifted the clock on any non-UTC server. Verify we're within a minute
// of the correct value computed independently.
const expectedIst = new Date(Date.now() + (5 * 60 + 30) * 60000);
check(
  "IST hour matches an independent computation",
  hour === expectedIst.getUTCHours(),
  `${hour} vs ${expectedIst.getUTCHours()}`
);

check("valid date strings are accepted", slot.isValidDateStr("2026-01-09"));
check("garbage date strings are rejected", !slot.isValidDateStr("09/01/2026"));
check("buildSlotId rejects a bad meal", (() => {
  try { slot.buildSlotId("2026-01-09", "brunch"); return false; } catch { return true; }
})());

check("date shifting crosses a month boundary", slot.shiftDateStr("2026-01-31", 1) === "2026-02-01");
check("date shifting crosses a year boundary", slot.shiftDateStr("2026-01-01", -1) === "2025-12-31");
check("leap day is handled", slot.shiftDateStr("2028-02-28", 1) === "2028-02-29");

const parsed = slot.parseSlotId("2026-04-07_lunch");
check("slot ids round-trip", parsed.date === "2026-04-07" && parsed.mealType === "lunch");

check("a future slot is active", slot.isSlotActive(`${slot.shiftDateStr(dateStr, 3)}_breakfast`));
check("a past date is closed", !slot.isSlotActive(`${slot.shiftDateStr(dateStr, -1)}_dinner`));
check("a malformed slot is closed, not crashing", slot.isSlotActive("nonsense") === false);

const next = slot.nextOpenSlot();
check("nextOpenSlot is genuinely open", slot.isSlotActive(slot.buildSlotId(next.mealDate, next.mealTime)),
  JSON.stringify(next));

const slots = slot.upcomingSlots();
check("slot picker covers two days of meals", slots.length === 8);
check("every slot carries a label", slots.every((s) => s.label && s.emoji));
check("tomorrow's slots are all open", slots.filter((s) => !s.isToday).every((s) => s.isOpen));
check("open slots report time remaining", slots.filter((s) => s.isOpen).every((s) => s.minutesLeft > 0));

// A stale preference must heal forward to something usable.
const healed = slot.resolveSlotFromPref({ mealDate: "2020-01-01", mealTime: "lunch" });
check("a stale preference heals forward", healed.healed === true && slot.isSlotActive(healed.slotId), healed.slotId);
const fresh = slot.resolveSlotFromPref({ mealDate: next.mealDate, mealTime: next.mealTime });
check("a valid preference is left alone", fresh.healed === false);

// Expiry is an absolute instant, independent of server timezone.
const expiry = slot.getSlotExpiry("2026-04-07_lunch");
check("lunch expires at 15:00 IST (09:30 UTC)", expiry.toISOString() === "2026-04-07T09:30:00.000Z",
  expiry.toISOString());
check("dinner expires at 22:00 IST (16:30 UTC)",
  slot.getSlotExpiry("2026-04-07_dinner").toISOString() === "2026-04-07T16:30:00.000Z");

// ─── CLEANUP SLOT SELECTION ─────────────────────────────────────────────────
section("Expiry job slot selection");
const { buildExpiredSlotIds } = require("../utils/cleanup");
const expiredIds = buildExpiredSlotIds();
check("no open slot is ever marked expired", !expiredIds.some((id) => slot.isSlotActive(id)),
  expiredIds.filter((id) => slot.isSlotActive(id)).join(","));
check("expired list uses IST dates", expiredIds.every((id) => slot.isValidDateStr(slot.parseSlotId(id).date)));

// ─── AGE ────────────────────────────────────────────────────────────────────
section("Age");
check("missing birthday yields null, not a fake 20", calculateAge(null) === null);
check("garbage birthday yields null", calculateAge("not a date") === null);
const twentyYearsAgo = new Date();
twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
check("a 20-year-old is 20", calculateAge(twentyYearsAgo) === 20);
const almost = new Date();
almost.setFullYear(almost.getFullYear() - 20);
almost.setDate(almost.getDate() + 1);
check("birthday tomorrow means still 19", calculateAge(almost) === 19);

// ─── INTEREST SIMILARITY ────────────────────────────────────────────────────
section("Interest similarity");
const pool = [
  { interests: ["music", "anime", "coding"] },
  { interests: ["music", "gym"] },
  { interests: ["music", "chess"] },
  { interests: ["music", "football"] },
  { interests: ["music", "reading"] },
];
const idf = buildIdf(pool);
check("a rare interest outweighs a ubiquitous one", idf.get("anime") > idf.get("music"),
  `${idf.get("anime")} vs ${idf.get("music")}`);

const rare = interestScore(["anime", "kathak"], ["anime", "kathak"], idf);
const common = interestScore(["music"], ["music"], idf);
check("matching on rare interests scores higher", rare.score > common.score,
  `${rare.score} vs ${common.score}`);
check("shared interests come back ranked by rarity",
  interestScore(["music", "anime"], ["music", "anime"], idf).shared[0] === "anime");
check("no overlap scores zero", interestScore(["a"], ["b"], idf).score === 0);
check("empty interests are safe", interestScore([], ["a"], idf).score === 0);
check("interest matching is case-insensitive",
  interestScore(["Anime"], ["anime"], idf).shared.length === 1);

// ─── CANDIDATE SCORING ──────────────────────────────────────────────────────
section("Candidate scoring");
const viewer = {
  _id: "viewer", interests: ["anime", "coding"], clubs: ["robotics"],
  age: 20, intent: "casual", foodPreference: "veg", personalityType: "introvert",
};
const soulmate = {
  _id: "soulmate", interests: ["anime", "coding"], clubs: ["robotics"],
  age: 20, intent: "casual", foodPreference: "veg", personalityType: "extrovert",
};
const opposite = {
  _id: "opposite", interests: ["gym"], clubs: [],
  age: 30, intent: "dating", foodPreference: "non-veg", personalityType: "introvert",
};
const blank = { _id: "blank" };

const sSoul = scoreCandidate({ viewer, candidate: soulmate, idf, slotId: "s" });
const sOpp = scoreCandidate({ viewer, candidate: opposite, idf, slotId: "s" });
const sBlank = scoreCandidate({ viewer, candidate: blank, idf, slotId: "s" });

check("a strong match outranks a weak one", sSoul.score > sOpp.score, `${sSoul.score} vs ${sOpp.score}`);
check("scores stay within 0-100", [sSoul, sOpp, sBlank].every((s) => s.score >= 0 && s.score <= 100));
check("a weak match is still shown (never zero)", sOpp.score > 0, String(sOpp.score));
check("an empty profile still scores", sBlank.score > 0, String(sBlank.score));
check("strong matches explain themselves", sSoul.reasons.length >= 2, JSON.stringify(sSoul.reasons));
check("reasons are capped at three", sSoul.reasons.length <= 3);
check("breakdown is exposed for debugging", typeof sSoul.breakdown.interests === "number");

const sLiked = scoreCandidate({ viewer, candidate: opposite, idf, likedMe: true, slotId: "s" });
check("a pending like beats a better stranger", sLiked.score > sOpp.score);
check("a pending like is called out", sLiked.reasons.some((r) => r.icon === "💘"));

const sPopular = scoreCandidate({
  viewer, candidate: soulmate, idf, popularity: 20, poolPopularity: 20, slotId: "s",
});
check("attention is spread away from the most-liked", sPopular.score < sSoul.score,
  `${sPopular.score} vs ${sSoul.score}`);

const sActive = scoreCandidate({ viewer, candidate: soulmate, idf, lastActiveAt: new Date(), slotId: "s" });
const sStale = scoreCandidate({
  viewer, candidate: soulmate, idf, lastActiveAt: new Date(Date.now() - 3 * 24 * 3600 * 1000), slotId: "s",
});
check("someone active now ranks above someone from days ago", sActive.score > sStale.score);
check("active-now is exposed as a presence flag", sActive.isActiveNow === true && sStale.isActiveNow === false);

check("scoring is deterministic across calls",
  scoreCandidate({ viewer, candidate: soulmate, idf, slotId: "s" }).score === sSoul.score);
check("different viewers get different tie-breaks",
  scoreCandidate({ viewer: { ...viewer, _id: "other" }, candidate: soulmate, idf, slotId: "s" }).score !== sSoul.score);
check("different slots reshuffle ties",
  scoreCandidate({ viewer, candidate: soulmate, idf, slotId: "t" }).score !== sSoul.score);

// Age falloff should be gentle, not a cliff.
const ageScores = [0, 2, 5, 10].map(
  (d) => scoreCandidate({ viewer, candidate: { ...soulmate, age: 20 + d }, idf, slotId: "s" }).score
);
check("age similarity decays monotonically",
  ageScores.every((s, i) => i === 0 || s <= ageScores[i - 1]), ageScores.join(" > "));
check("a 10-year gap is a penalty, not an exclusion", ageScores[3] > ageScores[0] * 0.6, ageScores.join(","));

// ─── GENDER COMPATIBILITY ───────────────────────────────────────────────────
section("Two-way gender compatibility");
const F = { gender: "female" };
const M = { gender: "male" };
check("both sides satisfied → visible",
  genderCompatible(F, { preferredGender: "male" }, M, { preferredGender: "female" }));
check("their filter excludes me → hidden",
  !genderCompatible(F, { preferredGender: "male" }, M, { preferredGender: "male" }));
check("my filter excludes them → hidden",
  !genderCompatible(F, { preferredGender: "female" }, M, { preferredGender: "any" }));
check("'any' on both sides always matches",
  genderCompatible(F, { preferredGender: "any" }, M, { preferredGender: "any" }));
check("a missing preference behaves like 'any'", genderCompatible(F, null, M, undefined));

// ─── TABLE SCORING ──────────────────────────────────────────────────────────
section("Table scoring");
const nearlyFull = {
  _id: "t1", interests: ["anime"], maxMembers: 4,
  members: [{ _id: "x", interests: ["anime", "coding"] }, { _id: "y", interests: ["anime"] }, { _id: "z", interests: [] }],
};
const empty = { _id: "t2", interests: ["gym"], maxMembers: 4, members: [{ _id: "w", interests: ["gym"] }] };
const full = { _id: "t3", interests: ["anime"], maxMembers: 2, members: [{ _id: "p" }, { _id: "q" }] };

const tNear = scoreTable({ viewer, table: nearlyFull, idf, slotId: "s" });
const tEmpty = scoreTable({ viewer, table: empty, idf, slotId: "s" });
const tFull = scoreTable({ viewer, table: full, idf, slotId: "s" });

check("a filling table beats a mismatched quiet one", tNear.score > tEmpty.score,
  `${tNear.score} vs ${tEmpty.score}`);
check("seats remaining are reported", tNear.seatsLeft === 1 && tEmpty.seatsLeft === 3);
check("a full table reports zero seats", tFull.seatsLeft === 0);
check("the last seat is called out", tNear.reasons.some((r) => r.text.includes("Last seat")));
check("tables explain themselves", tEmpty.reasons.length > 0);

// ─── HASH ───────────────────────────────────────────────────────────────────
section("Tie-break hash");
const samples = Array.from({ length: 500 }, (_, i) => hash01(`k${i}`));
check("hash stays in [0,1)", samples.every((v) => v >= 0 && v < 1));
check("hash is stable", hash01("abc") === hash01("abc"));
check("hash is well spread", new Set(samples).size > 450, String(new Set(samples).size));

// ─── RESULT ─────────────────────────────────────────────────────────────────
section("Result");
console.log(`  ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(`  • ${f}`));
}
process.exit(failed === 0 ? 0 : 1);
