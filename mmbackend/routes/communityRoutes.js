const express = require("express");
const { 
  browseCommunities, 
  createCommunity, 
  joinCommunity,
  leaveCommunity,
  dissolveCommunity
} = require("../controllers/communityController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, browseCommunities);
router.post("/create", protect, createCommunity);
router.post("/join", protect, joinCommunity);
router.post("/leave", protect, leaveCommunity);
router.delete("/dissolve", protect, dissolveCommunity);

module.exports = router;
