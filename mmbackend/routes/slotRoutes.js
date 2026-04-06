const express = require("express");
const router = express.Router();
const { getSlotStatus } = require("../controllers/slotController");
const { protect } = require("../middleware/authMiddleware");

// GET /api/slot/status
// Optional query: ?date=YYYY-MM-DD&mealType=lunch
// Returns full slot state for the authenticated user
router.get("/status", protect, getSlotStatus);

module.exports = router;
