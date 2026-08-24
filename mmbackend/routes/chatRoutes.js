const express = require("express");
const router = express.Router();
const { getMessages, sendMessage, getUnreadSummary } = require("../controllers/chatController");
const { protect } = require("../middleware/authMiddleware");
const { messageLimiter } = require("../middleware/rateLimit");

router.get("/unread", protect, getUnreadSummary);
router.get("/:threadType/:threadId", protect, getMessages);
router.post("/:threadType/:threadId", protect, messageLimiter, sendMessage);

module.exports = router;
