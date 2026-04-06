const express = require("express");
const router = express.Router();
const { getCandidates, likeUser, skipUser, getMatches, getLikesReceived, ignoreLike, unmatchUser, completeMatch } = require("../controllers/matchController");
const { protect } = require("../middleware/authMiddleware");

router.get("/candidates", protect, getCandidates);
router.post("/like", protect, likeUser);
router.post("/skip", protect, skipUser);
router.get("/received", protect, getLikesReceived);
router.get("/likes-received", protect, getLikesReceived); // Matching the frontend request
router.post("/ignore", protect, ignoreLike);
router.get("/list", protect, getMatches); // Matching the frontend request
router.get("/", protect, getMatches);
router.post("/unmatch", protect, unmatchUser);
router.post("/complete", protect, completeMatch);

module.exports = router;

