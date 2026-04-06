const express = require("express");
const router = express.Router();
const { setPreference, getPreference } = require("../controllers/preferenceController");
const { protect } = require("../middleware/authMiddleware");

router.post("/", protect, setPreference);
router.put("/", protect, setPreference);
router.get("/", protect, getPreference);

module.exports = router;