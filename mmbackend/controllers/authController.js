const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Preference = require("../models/Preference");
const { nextOpenSlot } = require("../utils/slotUtils");

const TOKEN_TTL = "30d";

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape returned to the client on both register and login. */
const sessionPayload = (user) => ({
  token: generateToken(user._id),
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    college: user.college,
    profilePic: user.profilePic,
    isProfileComplete: user.isProfileComplete,
  },
});

// ─── REGISTER ───────────────────────────────────────────────────────────────

const registerUser = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const college = String(req.body.college || "").trim().toLowerCase();

    if (!name || !email || !password || !college) {
      return res.status(400).json({ message: "Please fill in every field." });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: "That email doesn't look right." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Use at least 8 characters for your password." });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    const hashed = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await User.create({ name, email, password: hashed, college });

    // Start everyone on the next slot they can actually still join, open to
    // both solo matches and group tables.
    const next = nextOpenSlot();
    await Preference.create({
      user: user._id,
      mealTime: next.mealTime,
      mealDate: next.mealDate,
      preferredGender: "any",
      openTo: "both",
      groupSize: 4,
      isAvailable: true,
    });

    return res.status(201).json({ message: "Welcome to MessMate!", ...sessionPayload(user) });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }
    console.error("[authController] register:", err);
    return res.status(500).json({ message: "Couldn't create your account. Try again." });
  }
};

// ─── LOGIN ──────────────────────────────────────────────────────────────────

const loginUser = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Enter your email and password." });
    }

    // password is select:false on the schema, so ask for it explicitly.
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Deliberately identical message for both cases — no account enumeration.
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    user.lastActiveAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res.json({ message: "Welcome back!", ...sessionPayload(user) });
  } catch (err) {
    console.error("[authController] login:", err);
    return res.status(500).json({ message: "Couldn't sign you in. Try again." });
  }
};

// ─── SESSION CHECK ──────────────────────────────────────────────────────────

/**
 * GET /api/auth/me — one call the app can trust for "who am I and where should
 * I be". The frontend used to answer this by stitching together three requests
 * with three different completeness rules.
 */
const getSession = async (req, res) => {
  const pref = await Preference.findOne({ user: req.user._id }).lean();
  return res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      college: req.user.college,
      profilePic: req.user.profilePic,
      isProfileComplete: req.user.isProfileComplete,
    },
    hasPreferences: Boolean(pref),
    nextStep: req.user.isProfileComplete ? "discover" : "profile",
  });
};

module.exports = { registerUser, loginUser, getSession };
