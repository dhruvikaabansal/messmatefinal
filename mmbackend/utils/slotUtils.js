/**
 * slotUtils.js — Single source of truth for slot logic.
 *
 * A "slot" is a unique (date + mealType) pair.
 * slotId format: "YYYY-MM-DD_mealType"  e.g. "2026-04-07_lunch"
 *
 * Everything below is computed in Asia/Kolkata (IST, UTC+5:30) regardless of
 * where the Node process runs. Cut-off hours MUST match the frontend
 * mealTimeUtils.js exactly.
 */

// Slot opens for discovery this many hours before the cut-off is irrelevant —
// slots are open from the moment they exist until the cut-off hour passes.
const SLOT_CUTOFFS = {
  breakfast: 10, // closes 10:00 IST
  lunch: 15, //     closes 15:00 IST
  snacks: 18, //    closes 18:00 IST
  dinner: 22, //    closes 22:00 IST
};

// Human labels used in API responses so the frontend never hardcodes them.
const MEAL_LABELS = {
  breakfast: { label: "Breakfast", emoji: "🍳", window: "7:00 – 10:00 AM" },
  lunch: { label: "Lunch", emoji: "🍱", window: "12:00 – 3:00 PM" },
  snacks: { label: "Snacks", emoji: "🥟", window: "4:00 – 6:00 PM" },
  dinner: { label: "Dinner", emoji: "🍛", window: "7:00 – 10:00 PM" },
};

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"];

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Current wall-clock date/time in IST.
 *
 * Implementation note: `Date.now()` is already an absolute UTC epoch, so the
 * ONLY adjustment needed is + 5:30. The previous version also added
 * `getTimezoneOffset()`, which silently double-counted on any server whose
 * local timezone was not UTC.
 */
const getISTNow = () => {
  const istMs = Date.now() + IST_OFFSET_MS;
  const d = new Date(istMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return {
    dateStr: `${year}-${month}-${day}`,
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    /** minutes since IST midnight — useful for fine-grained countdowns */
    minutesSinceMidnight: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
};

/** Today's date string (YYYY-MM-DD) in IST. */
const todayStr = () => getISTNow().dateStr;

/** Shift an IST date string by N days. */
const shiftDateStr = (dateStr, days) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const shifted = new Date(base + days * 24 * 60 * 60 * 1000);
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const isValidDateStr = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Build a canonical slotId string. Throws on invalid input.
 */
const buildSlotId = (date, mealType) => {
  if (!isValidDateStr(date)) throw new Error(`Invalid meal date: ${date}`);
  if (!MEAL_TYPES.includes(mealType)) throw new Error(`Invalid meal type: ${mealType}`);
  return `${date}_${mealType}`;
};

/** Parse a slotId back into its parts. */
const parseSlotId = (slotId) => {
  const idx = String(slotId).indexOf("_");
  if (idx === -1) return { date: null, mealType: null };
  return {
    date: slotId.substring(0, idx),
    mealType: slotId.substring(idx + 1),
  };
};

/**
 * The absolute UTC instant a slot closes.
 */
const getSlotExpiry = (slotId) => {
  const { date, mealType } = parseSlotId(slotId);
  const cutoffHour = SLOT_CUTOFFS[mealType];
  if (!isValidDateStr(date) || cutoffHour === undefined) return new Date(0);
  const asIfUtc = Date.parse(`${date}T${String(cutoffHour).padStart(2, "0")}:00:00Z`);
  return new Date(asIfUtc - IST_OFFSET_MS);
};

/**
 * Is this slot still open for discovery / matching?
 */
const isSlotActive = (slotId) => {
  const { date, mealType } = parseSlotId(slotId);
  const cutoffHour = SLOT_CUTOFFS[mealType];
  if (!isValidDateStr(date) || cutoffHour === undefined) return false;

  const { dateStr: today, hour } = getISTNow();
  if (date > today) return true;
  if (date < today) return false;
  return hour < cutoffHour;
};

/** Minutes remaining before a slot closes (0 if already closed). */
const minutesUntilSlotCloses = (slotId) => {
  if (!isSlotActive(slotId)) return 0;
  const ms = getSlotExpiry(slotId).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 60000));
};

/**
 * The next slot a user can realistically join, starting from "now" in IST.
 * Walks forward through today's remaining meals, then tomorrow's.
 */
const nextOpenSlot = () => {
  const today = todayStr();
  for (const mealType of MEAL_TYPES) {
    if (isSlotActive(buildSlotId(today, mealType))) {
      return { mealDate: today, mealTime: mealType };
    }
  }
  return { mealDate: shiftDateStr(today, 1), mealTime: MEAL_TYPES[0] };
};

/**
 * Build a slotId from a Preference document, self-healing when the stored
 * date/meal has drifted into the past. Returns the corrected pair too, so the
 * caller can persist the fix.
 */
const resolveSlotFromPref = (pref) => {
  if (!pref) return null;
  const candidateDate = isValidDateStr(pref.mealDate) ? pref.mealDate : todayStr();
  const candidateMeal = MEAL_TYPES.includes(pref.mealTime) ? pref.mealTime : "lunch";
  const slotId = buildSlotId(candidateDate, candidateMeal);

  if (isSlotActive(slotId)) {
    return { slotId, mealDate: candidateDate, mealTime: candidateMeal, healed: false };
  }
  const next = nextOpenSlot();
  return {
    slotId: buildSlotId(next.mealDate, next.mealTime),
    mealDate: next.mealDate,
    mealTime: next.mealTime,
    healed: true,
  };
};

/** All slots (today + tomorrow) with open/closed status — powers the slot picker. */
const upcomingSlots = () => {
  const today = todayStr();
  const tomorrow = shiftDateStr(today, 1);
  const out = [];
  for (const date of [today, tomorrow]) {
    for (const mealTime of MEAL_TYPES) {
      const slotId = buildSlotId(date, mealTime);
      out.push({
        slotId,
        mealDate: date,
        mealTime,
        isToday: date === today,
        ...MEAL_LABELS[mealTime],
        isOpen: isSlotActive(slotId),
        minutesLeft: minutesUntilSlotCloses(slotId),
      });
    }
  }
  return out;
};

module.exports = {
  SLOT_CUTOFFS,
  MEAL_TYPES,
  MEAL_LABELS,
  buildSlotId,
  parseSlotId,
  getISTNow,
  getSlotExpiry,
  isSlotActive,
  minutesUntilSlotCloses,
  nextOpenSlot,
  resolveSlotFromPref,
  upcomingSlots,
  shiftDateStr,
  isValidDateStr,
  todayStr,
  // legacy alias kept so any straggling import keeps working
  slotIdFromPref: (pref) => resolveSlotFromPref(pref)?.slotId,
};
