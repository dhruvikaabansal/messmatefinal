const User = require("../models/User");
const Preference = require("../models/Preference");
const { calculateAge } = require("../utils/ageUtils");

/** Everything the client needs about the signed-in user, in one shape. */
const shapeProfile = (user, preferences) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  college: user.college,
  birthday: user.birthday,
  age: calculateAge(user.birthday),
  gender: user.gender,
  interests: user.interests,
  clubs: user.clubs,
  intent: user.intent,
  personalityType: user.personalityType,
  foodPreference: user.foodPreference,
  profilePic: user.profilePic,
  bio: user.bio,
  prompts: user.prompts || [],
  isAvailable: user.isAvailable,
  isProfileComplete: user.isProfileComplete,
  /** What's still missing — the UI shows this instead of guessing. */
  missing: [
    !user.birthday && "birthday",
    !user.gender && "gender",
    (user.interests || []).length < 3 && "interests",
    (!user.bio || user.bio.trim().length < 10) && "bio",
    !user.profilePic && "photo",
  ].filter(Boolean),
  preferences: preferences || null,
});

const getUserProfile = async (req, res) => {
  try {
    const preferences = await Preference.findOne({ user: req.user._id }).lean();
    return res.json({ profile: shapeProfile(req.user, preferences) });
  } catch (err) {
    console.error("[userController] getUserProfile:", err);
    return res.status(500).json({ message: "Couldn't load your profile." });
  }
};

const ENUMS = {
  gender: ["male", "female", "non-binary", "prefer not to say"],
  intent: ["casual", "networking", "dating", "just company"],
  personalityType: ["introvert", "extrovert", "ambivert"],
  foodPreference: ["veg", "non-veg", "vegan"],
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Account not found." });

    const b = req.body;

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (name.length < 2) return res.status(400).json({ message: "Name is too short." });
      user.name = name.slice(0, 60);
    }

    for (const field of Object.keys(ENUMS)) {
      if (b[field] !== undefined && b[field] !== "") {
        if (!ENUMS[field].includes(b[field])) {
          return res.status(400).json({ message: `Invalid value for ${field}.` });
        }
        user[field] = b[field];
      }
    }

    if (b.interests !== undefined) {
      if (!Array.isArray(b.interests)) {
        return res.status(400).json({ message: "Interests must be a list." });
      }
      user.interests = [
        ...new Set(b.interests.map((i) => String(i).trim().toLowerCase()).filter(Boolean)),
      ].slice(0, 12);
    }

    if (b.clubs !== undefined && Array.isArray(b.clubs)) {
      // Dedupe case-insensitively but keep the first spelling for display, so
      // "Dance Society" and "dance society" are one club rather than two that
      // never match each other.
      const seen = new Set();
      user.clubs = b.clubs
        .map((c) => String(c).trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .filter((c) => {
          const key = c.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 8);
    }

    if (b.bio !== undefined) user.bio = String(b.bio).slice(0, 180);
    if (b.profilePic !== undefined) user.profilePic = String(b.profilePic);
    if (b.isAvailable !== undefined) user.isAvailable = Boolean(b.isAvailable);

    if (b.prompts !== undefined && Array.isArray(b.prompts)) {
      user.prompts = b.prompts
        .filter((p) => p && p.question && p.answer)
        .slice(0, 3)
        .map((p) => ({
          question: String(p.question).slice(0, 120),
          answer: String(p.answer).slice(0, 300),
        }));
    }

    if (b.birthday !== undefined && b.birthday !== "") {
      const bday = new Date(b.birthday);
      if (Number.isNaN(bday.getTime())) {
        return res.status(400).json({ message: "That birthday isn't a valid date." });
      }
      const age = calculateAge(bday);
      if (age === null || age < 16 || age > 60) {
        return res.status(400).json({ message: "You must be between 16 and 60 to use MessMate." });
      }
      // Set-once, but only complain if it's actually being changed to a
      // different day (the old check compared exact timestamps and fired on
      // harmless re-saves of the same date).
      const sameDay =
        user.birthday && new Date(user.birthday).toISOString().slice(0, 10) === bday.toISOString().slice(0, 10);
      if (user.birthday && !sameDay) {
        return res.status(400).json({ message: "Birthday can't be changed once set." });
      }
      user.birthday = bday;
    }

    await user.save();
    const preferences = await Preference.findOne({ user: user._id }).lean();

    return res.json({
      message: "Profile saved.",
      profile: shapeProfile(user, preferences),
    });
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(400).json({ message: Object.values(err.errors)[0]?.message || "Invalid profile data." });
    }
    console.error("[userController] updateUserProfile:", err);
    return res.status(500).json({ message: "Couldn't save your profile." });
  }
};

module.exports = { getUserProfile, updateUserProfile };
