/**
 * slotUtils.js — Single source of truth for slot logic.
 *
 * A "slot" is a unique (date + mealType) combination.
 * slotId format: "YYYY-MM-DD_mealType"  e.g. "2026-04-07_lunch"
 *
 * This utility is used by every controller and the cleanup job.
 * Cut-off hours MUST match the frontend mealTimeUtils.js exactly.
 */

// Cut-off hour (24h format) — slot closes at this hour
const SLOT_CUTOFFS = {
  breakfast: 10, // 10:00 AM
  lunch: 15,     // 3:00 PM
  snacks: 18,    // 6:00 PM
  dinner: 22,    // 10:00 PM
};

const MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"];

/**
 * Build a canonical slotId string.
 * @param {string} date     - "YYYY-MM-DD"
 * @param {string} mealType - "breakfast" | "lunch" | "snacks" | "dinner"
 * @returns {string}        - e.g. "2026-04-07_lunch"
 */
const buildSlotId = (date, mealType) => {
  if (!date || !mealType) throw new Error("date and mealType are required to build a slotId");
  if (!MEAL_TYPES.includes(mealType)) throw new Error(`Invalid mealType: ${mealType}`);
  return `${date}_${mealType}`;
};

/**
 * Parse a slotId back into its parts.
 * @param {string} slotId - "2026-04-07_lunch"
 * @returns {{ date: string, mealType: string }}
 */
const parseSlotId = (slotId) => {
  const underscoreIdx = slotId.indexOf("_");
  const date = slotId.substring(0, underscoreIdx);
  const mealType = slotId.substring(underscoreIdx + 1);
  return { date, mealType };
};

/**
 * Get current date and hour in IST (UTC+5:30).
 * This is timezone-safe regardless of where the Node.js server is hosted.
 * @returns {{ dateStr: string, hour: number }}
 */
const getISTNow = () => {
  const now = new Date();
  // Convert to IST by adding 5 hours 30 minutes to UTC
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const istMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000 + IST_OFFSET_MS;
  const istDate = new Date(istMs);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return {
    dateStr: `${year}-${month}-${day}`,
    hour: istDate.getUTCHours(),
  };
};

/**
 * Get the Date object at which a slot expires (for cleanup job use).
 * @param {string} slotId
 * @returns {Date} — UTC Date when the slot closes
 */
const getSlotExpiry = (slotId) => {
  const { date, mealType } = parseSlotId(slotId);
  const cutoffHour = SLOT_CUTOFFS[mealType];
  // IST cutoff expressed as UTC: subtract 5:30
  // e.g. dinner cutoff = IST 22:00 = UTC 16:30
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const expiryIST = new Date(`${date}T${String(cutoffHour).padStart(2, '0')}:00:00Z`);
  return new Date(expiryIST.getTime() - IST_OFFSET_MS);
};

/**
 * Check whether a slot is currently active (not yet expired).
 * Uses IST time explicitly — safe on any server timezone.
 * Mirrors the frontend isMealTimePassed() logic exactly.
 * @param {string} slotId
 * @returns {boolean} — true if active, false if closed
 */
const isSlotActive = (slotId) => {
  const { date, mealType } = parseSlotId(slotId);
  const cutoffHour = SLOT_CUTOFFS[mealType];
  const { dateStr: todayIST, hour: currentHourIST } = getISTNow();

  if (date > todayIST) return true;  // Future date → always active
  if (date < todayIST) return false; // Past date → always closed
  // Same date → check if we've passed the cut-off hour
  return currentHourIST < cutoffHour;
};

/**
 * Build a slotId from a Preference document (user's currently selected meal settings).
 * @param {object} pref - Mongoose Preference document with mealDate + mealTime
 * @returns {string} slotId
 */
const slotIdFromPref = (pref) => {
  return buildSlotId(pref.mealDate, pref.mealTime);
};

/**
 * Get today's date string in YYYY-MM-DD format.
 * @returns {string}
 */
const todayStr = () => getISTNow().dateStr;

module.exports = {
  SLOT_CUTOFFS,
  MEAL_TYPES,
  buildSlotId,
  parseSlotId,
  getISTNow,
  getSlotExpiry,
  isSlotActive,
  slotIdFromPref,
  todayStr,
};
