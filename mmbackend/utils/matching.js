/**
 * matching.js — MessMate compatibility engine.
 *
 * Design goals
 * ------------
 * 1. NEVER return an empty feed when eligible people exist. Preferences are
 *    ranking signals first and filters second; when a strict filter would empty
 *    the feed we widen it and tell the UI we did ("expanded" reason).
 * 2. Symmetric fairness. A profile only appears if BOTH sides' gender
 *    preferences are satisfied, so a like is never structurally doomed.
 * 3. Spread the attention. Candidates who already collected a lot of likes in
 *    this slot are damped, so the same three profiles don't absorb everything
 *    and everyone else eats alone. This is the single biggest driver of
 *    "did the app actually work for me".
 * 4. Stable but not identical ordering. A deterministic hash seeded on
 *    (viewer, candidate, slot) breaks ties, so refreshing doesn't reshuffle the
 *    deck, yet two users don't see the same order.
 * 5. Explainable. Every card carries human-readable reasons, which is what
 *    makes a match feel considered rather than random.
 *
 * All scores are normalised to 0..1 before weighting; the final score is 0..100.
 */

// ─── WEIGHTS ────────────────────────────────────────────────────────────────
// Tuned so that no single signal can dominate, and so that two strangers with
// nothing in common still score meaningfully above zero (they can still eat!).
const WEIGHTS = {
  interests: 0.30,
  intent: 0.16,
  food: 0.10,
  personality: 0.08,
  clubs: 0.08,
  age: 0.10,
  freshness: 0.08,
  reciprocity: 0.10, // applied as a bonus, see below
};

// Bonus applied on top (not part of the normalised weights) when the candidate
// has already liked the viewer — liking back is an instant match, so these
// belong at the very top of the deck.
const RECIPROCAL_BONUS = 0.35;

// How hard to damp already-popular candidates. 0 = no damping.
const POPULARITY_DAMPING = 0.18;

// Amount of deterministic jitter used purely for tie-breaking.
const JITTER = 0.03;

// ─── SMALL HELPERS ──────────────────────────────────────────────────────────

const norm = (v) => String(v || "").trim().toLowerCase();

const toSet = (arr) => new Set((arr || []).map(norm).filter(Boolean));

/** Stable 32-bit string hash → 0..1. Deterministic across processes. */
const hash01 = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// ─── SIGNAL 1: INTERESTS (rarity-weighted overlap) ──────────────────────────
/**
 * Plain Jaccard treats "music" (which everyone picks) the same as "kathak".
 * Weighting each shared interest by its rarity in the current candidate pool
 * makes uncommon overlaps count for much more — which is exactly what people
 * mean when they say a match "gets" them.
 *
 * @param {Map<string, number>} idf  interest -> inverse document frequency
 */
const interestScore = (mine, theirs, idf) => {
  const a = toSet(mine);
  const b = toSet(theirs);
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };

  const shared = [...a].filter((x) => b.has(x));
  if (shared.length === 0) return { score: 0, shared: [] };

  const weightOf = (i) => idf.get(i) ?? 1;
  const sharedWeight = shared.reduce((s, i) => s + weightOf(i), 0);
  const unionWeight = [...new Set([...a, ...b])].reduce((s, i) => s + weightOf(i), 0);

  // Soft saturation: 3 strong shared interests should already feel like a lot.
  const raw = unionWeight === 0 ? 0 : sharedWeight / unionWeight;
  const saturated = 1 - Math.exp(-2.2 * raw * (1 + Math.min(shared.length, 4) / 4));

  // Rank shared interests by rarity so the UI can show the most telling ones.
  const ranked = shared.sort((x, y) => weightOf(y) - weightOf(x));
  return { score: clamp01(saturated), shared: ranked };
};

/** Build the rarity table from the candidate pool. */
const buildIdf = (people) => {
  const df = new Map();
  for (const p of people) {
    for (const i of toSet(p.interests)) df.set(i, (df.get(i) || 0) + 1);
  }
  const n = Math.max(1, people.length);
  const idf = new Map();
  for (const [i, count] of df) {
    // +1 smoothing, floor of 0.5 so a common interest still counts for something
    idf.set(i, 0.5 + Math.log((n + 1) / (count + 1)));
  }
  return idf;
};

// ─── SIGNAL 2: INTENT ───────────────────────────────────────────────────────
// Why someone is here matters more than what music they like. Someone looking
// to network and someone looking to date will both have a bad lunch.
const INTENT_AFFINITY = {
  casual: { casual: 1, "just company": 0.9, networking: 0.5, dating: 0.35 },
  "just company": { "just company": 1, casual: 0.9, networking: 0.5, dating: 0.3 },
  networking: { networking: 1, casual: 0.5, "just company": 0.5, dating: 0.2 },
  dating: { dating: 1, casual: 0.35, "just company": 0.3, networking: 0.2 },
};

const intentScore = (mine, theirs) => {
  const a = norm(mine) || "casual";
  const b = norm(theirs) || "casual";
  return INTENT_AFFINITY[a]?.[b] ?? 0.5;
};

// ─── SIGNAL 3: FOOD PREFERENCE ──────────────────────────────────────────────
// You are literally sharing a table. Veg and vegan sit together happily; a
// strict vegan and a non-veg eater is a smaller, but real, friction.
const FOOD_AFFINITY = {
  veg: { veg: 1, vegan: 0.85, "non-veg": 0.55 },
  vegan: { vegan: 1, veg: 0.85, "non-veg": 0.4 },
  "non-veg": { "non-veg": 1, veg: 0.55, vegan: 0.4 },
};

const foodScore = (mine, theirs) => {
  const a = norm(mine);
  const b = norm(theirs);
  if (!a || !b) return 0.65; // unknown — mildly positive, never a penalty
  return FOOD_AFFINITY[a]?.[b] ?? 0.65;
};

// ─── SIGNAL 4: PERSONALITY ──────────────────────────────────────────────────
// Two deep introverts across a table can be a long forty minutes; an introvert
// and an extrovert usually works. Ambiverts glue to anyone.
const PERSONALITY_AFFINITY = {
  introvert: { introvert: 0.62, ambivert: 0.95, extrovert: 0.88 },
  ambivert: { introvert: 0.95, ambivert: 0.9, extrovert: 0.95 },
  extrovert: { introvert: 0.88, ambivert: 0.95, extrovert: 0.8 },
};

const personalityScore = (mine, theirs) => {
  const a = norm(mine);
  const b = norm(theirs);
  if (!a || !b) return 0.7;
  return PERSONALITY_AFFINITY[a]?.[b] ?? 0.7;
};

// ─── SIGNAL 5: CLUBS ────────────────────────────────────────────────────────
const clubScore = (mine, theirs) => {
  const a = toSet(mine);
  const b = toSet(theirs);
  if (a.size === 0 || b.size === 0) return { score: 0.5, shared: [] };
  const shared = [...a].filter((x) => b.has(x));
  if (shared.length === 0) return { score: 0.35, shared: [] };
  return { score: clamp01(0.6 + 0.2 * shared.length), shared };
};

// ─── SIGNAL 6: AGE ──────────────────────────────────────────────────────────
// Gaussian falloff: same year is ideal, 2 years is fine, 6+ years starts to
// matter on a campus. Never zero — a first-year and a PhD can still have chai.
const ageScore = (mine, theirs) => {
  if (!mine || !theirs) return 0.6;
  const diff = Math.abs(mine - theirs);
  return clamp01(0.15 + 0.85 * Math.exp(-(diff * diff) / 18));
};

// ─── SIGNAL 7: FRESHNESS ────────────────────────────────────────────────────
// Someone who opened the app 5 minutes ago will actually turn up for lunch.
const freshnessScore = (lastActiveAt) => {
  if (!lastActiveAt) return 0.4;
  const mins = (Date.now() - new Date(lastActiveAt).getTime()) / 60000;
  if (mins <= 15) return 1;
  if (mins >= 24 * 60) return 0.2;
  return clamp01(1 - (mins - 15) / (24 * 60 - 15) * 0.8);
};

// ─── GENDER COMPATIBILITY (two-way) ─────────────────────────────────────────
/**
 * The original build only checked the viewer's preference. That let A see B,
 * like B, and wait forever because B's filter excluded A. Both directions must
 * agree before a card is ever shown.
 */
const genderCompatible = (viewer, viewerPref, candidate, candidatePref) => {
  const wants = (pref, person) => {
    const want = norm(pref?.preferredGender) || "any";
    if (want === "any") return true;
    return norm(person?.gender) === want;
  };
  return wants(viewerPref, candidate) && wants(candidatePref, viewer);
};

// ─── REASON BUILDER ─────────────────────────────────────────────────────────
const buildReasons = ({ sharedInterests, sharedClubs, sameIntent, intentLabel, ageDiff, foodSame, reciprocal }) => {
  const reasons = [];
  if (reciprocal) reasons.push({ icon: "💘", text: "Already liked you — like back to match instantly" });
  if (sharedInterests.length >= 3) {
    reasons.push({ icon: "✨", text: `${sharedInterests.length} shared interests · ${sharedInterests.slice(0, 3).join(", ")}` });
  } else if (sharedInterests.length > 0) {
    reasons.push({ icon: "✨", text: `Both into ${sharedInterests.slice(0, 2).join(" & ")}` });
  }
  if (sharedClubs.length > 0) reasons.push({ icon: "🎓", text: `Same club: ${sharedClubs[0]}` });
  if (sameIntent && intentLabel) reasons.push({ icon: "🎯", text: `Also here for ${intentLabel}` });
  if (foodSame) reasons.push({ icon: "🍽️", text: "Same food preference" });
  if (ageDiff !== null && ageDiff <= 1) reasons.push({ icon: "🎂", text: "Same year group" });
  return reasons.slice(0, 3);
};

// ─── MAIN SCORER ────────────────────────────────────────────────────────────
/**
 * @param {object}  opts
 * @param {object}  opts.viewer            plain user object (with .age)
 * @param {object}  opts.candidate         plain user object (with .age)
 * @param {Map}     opts.idf               rarity table
 * @param {boolean} opts.likedMe           candidate already liked viewer
 * @param {number}  opts.popularity        likes the candidate received this slot
 * @param {number}  opts.poolPopularity    max likes any candidate received
 * @param {Date}    opts.lastActiveAt
 * @param {string}  opts.slotId
 */
const scoreCandidate = ({
  viewer,
  candidate,
  idf,
  likedMe = false,
  popularity = 0,
  poolPopularity = 0,
  lastActiveAt = null,
  slotId = "",
}) => {
  const interests = interestScore(viewer.interests, candidate.interests, idf);
  const clubs = clubScore(viewer.clubs, candidate.clubs);
  const intent = intentScore(viewer.intent, candidate.intent);
  const food = foodScore(viewer.foodPreference, candidate.foodPreference);
  const personality = personalityScore(viewer.personalityType, candidate.personalityType);
  const age = ageScore(viewer.age, candidate.age);
  const fresh = freshnessScore(lastActiveAt);

  let score =
    WEIGHTS.interests * interests.score +
    WEIGHTS.intent * intent +
    WEIGHTS.food * food +
    WEIGHTS.personality * personality +
    WEIGHTS.clubs * clubs.score +
    WEIGHTS.age * age +
    WEIGHTS.freshness * fresh;

  // Reciprocity: a like waiting for you is the highest-value card in the deck.
  if (likedMe) score += RECIPROCAL_BONUS;

  // Attention spreading: damp candidates who are already drowning in likes.
  if (poolPopularity > 0 && popularity > 0) {
    score *= 1 - POPULARITY_DAMPING * (popularity / poolPopularity);
  }

  // Deterministic tie-break so the deck is stable per user per slot.
  score += JITTER * hash01(`${viewer._id}:${candidate._id}:${slotId}`);

  const ageDiff =
    viewer.age && candidate.age ? Math.abs(viewer.age - candidate.age) : null;

  return {
    score: Math.round(clamp01(score / (1 + RECIPROCAL_BONUS)) * 1000) / 10, // 0..100, 1 dp
    sharedInterests: interests.shared,
    sharedClubs: clubs.shared,
    likedMe,
    reasons: buildReasons({
      sharedInterests: interests.shared,
      sharedClubs: clubs.shared,
      sameIntent: norm(viewer.intent) === norm(candidate.intent) && !!candidate.intent,
      intentLabel: norm(candidate.intent),
      ageDiff,
      foodSame:
        !!viewer.foodPreference &&
        norm(viewer.foodPreference) === norm(candidate.foodPreference),
      reciprocal: likedMe,
    }),
    // Rendered as a presence dot rather than competing for a reason slot —
    // it is a property of the person, not a reason you two fit.
    isActiveNow: fresh >= 0.95,
    breakdown: {
      interests: Math.round(interests.score * 100),
      intent: Math.round(intent * 100),
      food: Math.round(food * 100),
      personality: Math.round(personality * 100),
      clubs: Math.round(clubs.score * 100),
      age: Math.round(age * 100),
      freshness: Math.round(fresh * 100),
    },
  };
};

// ─── GROUP TABLE SCORING ────────────────────────────────────────────────────
/**
 * Tables are ranked on the same interest machinery plus how well the viewer
 * fits the people already sitting there, and a nudge toward tables that are
 * nearly full (a table with 3/4 seats is far more likely to actually happen
 * than an empty one).
 */
const scoreTable = ({ viewer, table, idf, slotId = "" }) => {
  const tableInterests = interestScore(viewer.interests, table.interests, idf);

  const memberScores = (table.members || [])
    .filter((m) => m && m._id?.toString() !== viewer._id?.toString())
    .map((m) => interestScore(viewer.interests, m.interests, idf).score);
  const memberFit = memberScores.length
    ? memberScores.reduce((a, b) => a + b, 0) / memberScores.length
    : 0.35;

  const seatsTaken = (table.members || []).length;
  const capacity = table.maxMembers || 4;
  const fillRatio = clamp01(seatsTaken / capacity);
  // Peaks when the table is filling up but not full.
  const momentum = fillRatio >= 1 ? 0 : 0.4 + 0.6 * fillRatio;

  const score =
    0.4 * tableInterests.score +
    0.3 * memberFit +
    0.3 * momentum +
    JITTER * hash01(`${viewer._id}:${table._id}:${slotId}`);

  const reasons = [];
  if (tableInterests.shared.length)
    reasons.push({ icon: "✨", text: `Table is into ${tableInterests.shared.slice(0, 2).join(" & ")}` });
  if (capacity - seatsTaken === 1) reasons.push({ icon: "🔥", text: "Last seat left" });
  else if (seatsTaken >= 2) reasons.push({ icon: "👥", text: `${seatsTaken} people already in` });
  if (memberFit > 0.4) reasons.push({ icon: "🤝", text: "You'd fit right in" });
  if (reasons.length === 0) {
    // Always say something useful — a table with no obvious hook is still a
    // table someone can sit at, and a blank card reads as broken.
    const seatsLeft = Math.max(0, capacity - seatsTaken);
    reasons.push({
      icon: "🪑",
      text: seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft > 1 ? "s" : ""} open` : "Table is full",
    });
  }

  return {
    score: Math.round(clamp01(score) * 1000) / 10,
    sharedInterests: tableInterests.shared,
    seatsLeft: Math.max(0, capacity - seatsTaken),
    reasons: reasons.slice(0, 3),
  };
};

module.exports = {
  WEIGHTS,
  buildIdf,
  scoreCandidate,
  scoreTable,
  genderCompatible,
  interestScore,
  hash01,
};
