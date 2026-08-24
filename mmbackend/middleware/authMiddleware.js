const jwt = require("jsonwebtoken");
const User = require("../models/User");

/** Only touch lastActiveAt once a minute — it feeds the "active now" signal. */
const ACTIVITY_THROTTLE_MS = 60 * 1000;

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Please sign in.", code: "NO_TOKEN" });
    }

    let decoded;
    try {
      decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch (e) {
      const expired = e.name === "TokenExpiredError";
      return res.status(401).json({
        message: expired ? "Your session expired. Please sign in again." : "Invalid session.",
        code: expired ? "TOKEN_EXPIRED" : "BAD_TOKEN",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Account not found.", code: "NO_USER" });
    }

    if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVITY_THROTTLE_MS) {
      user.lastActiveAt = new Date();
      user.save({ validateBeforeSave: false }).catch(() => {});
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error("[authMiddleware]", err);
    return res.status(500).json({ message: "Authentication failed." });
  }
};

/** Blocks discovery endpoints until the profile is worth showing to others. */
const requireCompleteProfile = (req, res, next) => {
  if (!req.user?.isProfileComplete) {
    return res.status(428).json({
      message: "Finish your profile before matching.",
      code: "PROFILE_INCOMPLETE",
    });
  }
  return next();
};

module.exports = { protect, requireCompleteProfile };
