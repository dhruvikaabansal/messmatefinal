const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getSession } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/rateLimit");

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.get("/me", protect, getSession);

module.exports = router;
