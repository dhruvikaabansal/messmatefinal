const express = require("express");
const router = express.Router();
const { getSlotStatus, switchSlot } = require("../controllers/slotController");
const { protect } = require("../middleware/authMiddleware");

router.get("/status", protect, getSlotStatus);
router.post("/switch", protect, switchSlot);

module.exports = router;
