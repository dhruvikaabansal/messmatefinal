const Message = require("../models/Message");
const Match = require("../models/Match");

// SEND MESSAGE
const sendMessage = async (req, res) => {
  try {
    const { matchId, text } = req.body;

    if (!matchId || !text) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // Check if user is part of match
    const match = await Match.findById(matchId);

    if (!match || !match.users.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const message = await Message.create({
      match: matchId,
      sender: req.user._id,
      text,
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET MESSAGES
const getMessages = async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);

    if (!match || !match.users.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const messages = await Message.find({ match: matchId })
      .populate("sender", "name")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { sendMessage, getMessages };