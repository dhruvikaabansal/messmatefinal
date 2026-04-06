const Preference = require("../models/Preference");

// SET / UPDATE preference
const setPreference = async (req, res) => {
  const { mealTime, preferredGender, groupSize, mealDate, isAvailable } = req.body;

  try {
    let preference = await Preference.findOne({ user: req.user._id });

    if (preference) {
      // update existing
      preference.mealTime = mealTime || preference.mealTime;
      preference.preferredGender = preferredGender || preference.preferredGender;
      preference.groupSize = groupSize || preference.groupSize;
      preference.mealDate = mealDate || preference.mealDate;
      preference.isAvailable = isAvailable ?? preference.isAvailable;

      await preference.save();

      return res.json({ message: "Preference updated", preference });
    }

    // create new
    preference = await Preference.create({
      user: req.user._id,
      mealTime,
      preferredGender,
      groupSize,
      mealDate,
      isAvailable: isAvailable ?? true
    });

    res.status(201).json({ message: "Preference set", preference });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET preference
const getPreference = async (req, res) => {
  try {
    const preference = await Preference.findOne({ user: req.user._id });

    res.json(preference);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { setPreference, getPreference };