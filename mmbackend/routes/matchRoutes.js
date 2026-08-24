const express = require("express");
const router = express.Router();
const {
  likeUser,
  skipUser,
  undoLastSkip,
  getMatches,
  getLikesReceived,
  ignoreLike,
  unmatchUser,
  completeMatch,
} = require("../controllers/matchController");
const { protect, requireCompleteProfile } = require("../middleware/authMiddleware");
const { actionLimiter } = require("../middleware/rateLimit");

router.post("/like", protect, requireCompleteProfile, actionLimiter, likeUser);
router.post("/skip", protect, requireCompleteProfile, actionLimiter, skipUser);
router.post("/undo", protect, requireCompleteProfile, undoLastSkip);
router.post("/ignore", protect, ignoreLike);
router.post("/unmatch", protect, unmatchUser);
router.post("/complete", protect, completeMatch);

router.get("/likes-received", protect, getLikesReceived);
router.get("/received", protect, getLikesReceived); // legacy alias
router.get("/list", protect, getMatches);
router.get("/", protect, getMatches);

module.exports = router;
