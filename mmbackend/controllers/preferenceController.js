const Preference = require("../models/Preference");
const {
  MEAL_TYPES,
  isValidDateStr,
  isSlotActive,
  buildSlotId,
  nextOpenSlot,
  upcomingSlots,
  resolveSlotFromPref,
} = require("../utils/slotUtils");

const GENDERS = ["male", "female", "non-binary", "any"];
const OPEN_TO = ["both", "solo", "group"];

/**
 * PUT/POST /api/preferences
 * Validates the requested slot instead of silently storing a dead one — the
 * old version happily saved yesterday's lunch and then showed an empty feed.
 */
const setPreference = async (req, res) => {
  try {
    const b = req.body || {};
    const update = {};

    if (b.mealTime !== undefined) {
      if (!MEAL_TYPES.includes(b.mealTime)) {
        return res.status(400).json({ message: "Pick a valid meal." });
      }
      update.mealTime = b.mealTime;
    }

    if (b.mealDate !== undefined) {
      if (!isValidDateStr(b.mealDate)) {
        return res.status(400).json({ message: "Pick a valid date." });
      }
      update.mealDate = b.mealDate;
    }

    if (b.preferredGender !== undefined) {
      if (!GENDERS.includes(b.preferredGender)) {
        return res.status(400).json({ message: "Invalid gender preference." });
      }
      update.preferredGender = b.preferredGender;
    }

    if (b.openTo !== undefined) {
      if (!OPEN_TO.includes(b.openTo)) {
        return res.status(400).json({ message: "Invalid matching mode." });
      }
      update.openTo = b.openTo;
    }

    if (b.groupSize !== undefined) {
      const n = Number(b.groupSize);
      if (!Number.isFinite(n) || n < 2 || n > 8) {
        return res.status(400).json({ message: "Table size must be between 2 and 8." });
      }
      update.groupSize = n;
    }

    if (b.isAvailable !== undefined) update.isAvailable = Boolean(b.isAvailable);

    const existing = await Preference.findOne({ user: req.user._id });
    const mealTime = update.mealTime ?? existing?.mealTime ?? nextOpenSlot().mealTime;
    const mealDate = update.mealDate ?? existing?.mealDate ?? nextOpenSlot().mealDate;

    if (!isSlotActive(buildSlotId(mealDate, mealTime))) {
      return res.status(400).json({
        message: "That meal has already passed. Choose a later one.",
        slots: upcomingSlots().filter((s) => s.isOpen),
      });
    }

    update.mealTime = mealTime;
    update.mealDate = mealDate;

    const preference = await Preference.findOneAndUpdate(
      { user: req.user._id },
      { $set: update },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    return res.json({ message: "Preferences saved.", preference });
  } catch (err) {
    console.error("[preferenceController] setPreference:", err);
    return res.status(500).json({ message: "Couldn't save your preferences." });
  }
};

const getPreference = async (req, res) => {
  try {
    let preference = await Preference.findOne({ user: req.user._id });
    if (!preference) {
      const next = nextOpenSlot();
      preference = await Preference.create({
        user: req.user._id,
        mealTime: next.mealTime,
        mealDate: next.mealDate,
      });
    } else {
      const resolved = resolveSlotFromPref(preference);
      if (resolved.healed) {
        preference.mealDate = resolved.mealDate;
        preference.mealTime = resolved.mealTime;
        await preference.save();
      }
    }

    return res.json({ preference, slots: upcomingSlots() });
  } catch (err) {
    console.error("[preferenceController] getPreference:", err);
    return res.status(500).json({ message: "Couldn't load your preferences." });
  }
};

module.exports = { setPreference, getPreference };
