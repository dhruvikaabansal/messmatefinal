const express = require("express");
const router = express.Router();
const {
  browseCommunities,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  dissolveCommunity,
  getCommunity,
} = require("../controllers/communityController");
const { protect, requireCompleteProfile } = require("../middleware/authMiddleware");
const { actionLimiter } = require("../middleware/rateLimit");

router.get("/", protect, browseCommunities);
router.get("/:id", protect, getCommunity);
router.post("/create", protect, requireCompleteProfile, actionLimiter, createCommunity);
router.post("/join", protect, requireCompleteProfile, actionLimiter, joinCommunity);
router.post("/leave", protect, leaveCommunity);
router.delete("/dissolve", protect, dissolveCommunity);
router.post("/dissolve", protect, dissolveCommunity); // some clients can't send a DELETE body

module.exports = router;
