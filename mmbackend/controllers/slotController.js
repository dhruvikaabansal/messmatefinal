/**
 * slotController.js — the frontend contract.
 *
 * GET /api/slot/status is the only call any screen needs to render itself.
 * It returns the user's state for the slot plus everything that state implies:
 * the ranked feed, incoming likes, the active match or table, and the slot
 * picker. One request, one render, no cross-screen disagreement.
 */

const Preference = require("../models/Preference");
const { getSlotSnapshot } = require("../services/feedService");
const {
  buildSlotId,
  isValidDateStr,
  MEAL_TYPES,
  resolveSlotFromPref,
  upcomingSlots,
  nextOpenSlot,
} = require("../utils/slotUtils");

const getSlotStatus = async (req, res) => {
  try {
    const viewer = req.user;

    // A preference row always exists after registration, but heal it if not.
    let pref = await Preference.findOne({ user: viewer._id });
    if (!pref) {
      const next = nextOpenSlot();
      pref = await Preference.create({
        user: viewer._id,
        mealTime: next.mealTime,
        mealDate: next.mealDate,
      });
    }

    // Explicit slot override (the slot picker) — otherwise use the preference,
    // self-healing it forward when it has drifted into the past.
    let slotId;
    if (req.query.date || req.query.mealType) {
      const date = req.query.date;
      const mealType = req.query.mealType;
      if (!isValidDateStr(date) || !MEAL_TYPES.includes(mealType)) {
        return res.status(400).json({ message: "Invalid slot requested." });
      }
      slotId = buildSlotId(date, mealType);
    } else {
      const resolved = resolveSlotFromPref(pref);
      if (resolved.healed) {
        pref.mealDate = resolved.mealDate;
        pref.mealTime = resolved.mealTime;
        await pref.save();
      }
      slotId = resolved.slotId;
    }

    const snapshot = await getSlotSnapshot({
      viewer: {
        _id: viewer._id,
        name: viewer.name,
        college: viewer.college,
        gender: viewer.gender,
        age: viewer.age,
        interests: viewer.interests,
        clubs: viewer.clubs,
        intent: viewer.intent,
        foodPreference: viewer.foodPreference,
        personalityType: viewer.personalityType,
      },
      slotId,
      viewerPref: pref,
    });

    return res.json({
      ...snapshot,
      slots: upcomingSlots(),
      profileComplete: viewer.isProfileComplete,
    });
  } catch (err) {
    console.error("[slotController] getSlotStatus:", err);
    return res.status(500).json({ message: "Couldn't load your slot. Try again." });
  }
};

/**
 * POST /api/slot/switch { date, mealType }
 * Move the user to a different slot in one call — used by the header picker so
 * changing slots never means a trip to a settings page.
 */
const switchSlot = async (req, res) => {
  try {
    const { date, mealType } = req.body;
    if (!isValidDateStr(date) || !MEAL_TYPES.includes(mealType)) {
      return res.status(400).json({ message: "Pick a valid meal and date." });
    }

    const pref = await Preference.findOneAndUpdate(
      { user: req.user._id },
      { $set: { mealDate: date, mealTime: mealType } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ message: "Slot updated.", preference: pref });
  } catch (err) {
    console.error("[slotController] switchSlot:", err);
    return res.status(500).json({ message: "Couldn't switch slots." });
  }
};

module.exports = { getSlotStatus, switchSlot };
