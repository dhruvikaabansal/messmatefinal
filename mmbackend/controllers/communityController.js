const Community = require("../models/Community");
const cosineSimilarity = require("../utils/cosineSimilarity");

// 🌐 BROWSE COMMUNITIES
const browseCommunities = async (req, res) => {
  try {
    const { mealTime, mealDate } = req.query;
    const currentUser = req.user;

    const exactMatch = { college: currentUser.college };
    if (mealTime) exactMatch.mealTime = mealTime;
    if (mealDate) exactMatch.mealDate = mealDate;
    
    // Always fetch perfectly matched communities PLUS any community the user is in
    const communities = await Community.find({
      $or: [
        exactMatch,
        { members: currentUser._id }
      ]
    })
      .populate("members", "name profilePic")
      .populate("createdBy", "name profilePic");

    const enhanced = communities.map(c => {
      const isCreator = c.createdBy._id.toString() === currentUser._id.toString();
      const isMember = c.members.some(m => m._id.toString() === currentUser._id.toString());
      
      const userInterests = currentUser.interests || [];
      const commInterests = c.interests || [];
      const matchScore = cosineSimilarity(userInterests, commInterests);

      return { ...c.toObject(), isCreator, isMember, matchScore };
    });

    const strictlyRanked = enhanced.filter(c => c.matchScore > 0 || c.isMember || c.isCreator);
    strictlyRanked.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ communities: strictlyRanked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🏛️ CREATE COMMUNITY
const createCommunity = async (req, res) => {
  try {
    const { name, mealTime, mealDate, description, interests } = req.body;
    const userId = req.user._id;

    if (!name || !mealTime) {
      return res.status(400).json({ message: "Name and mealTime are required" });
    }

    // 🚨 CROSS-EXCLUSIVITY: Block if already in a 1-on-1 match
    if (req.user.activeMatch) {
       return res.status(400).json({ message: "You have an active 1-on-1 match! 🔒 Complete or Unmatch first." });
    }

    // 🚨 STRICT EXCLUSIVITY: Check if user is already in a community ON THIS SPECIFIC DATE
    const existing = await Community.findOne({ 
      members: userId,
      mealDate: mealDate || new Date().toISOString().split('T')[0]
    });
    if (existing) {
        return res.status(400).json({ message: `You already have a community group for ${mealDate || 'today'}!` });
    }

    const newCommunity = await Community.create({
      name,
      mealTime,
      college: req.user.college, // 🔥 Save college context
      mealDate: mealDate || new Date().toISOString().split('T')[0],
      description,
      interests: interests || [],
      createdBy: userId,
      members: [userId],
    });

    res.status(201).json({ community: newCommunity });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🤝 JOIN COMMUNITY
const joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    // 🚨 CROSS-EXCLUSIVITY: Block if already in a 1-on-1 match
    if (req.user.activeMatch) {
       return res.status(400).json({ message: "You have an active 1-on-1 match! 🔒 Complete or Unmatch first." });
    }

    // 🚨 STRICT EXCLUSIVITY: Check if user is already in a community ON THIS SPECIFIC DATE
    const alreadyInOnDate = await Community.findOne({ 
      members: userId,
      mealDate: community.mealDate
    });
    if (alreadyInOnDate) {
        return res.status(400).json({ message: `You are already in a community group for ${community.mealDate}!` });
    }

    community.members.push(userId);
    await community.save();

    res.json({ message: "Joined successfully", community });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🚶‍♂️ LEAVE COMMUNITY
const leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    if (community.createdBy.toString() === userId.toString()) {
      return res.status(400).json({ message: "As the creator, you must dissolve the community instead of leaving it." });
    }

    community.members = community.members.filter(m => m.toString() !== userId.toString());
    await community.save();

    res.json({ message: "Left successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 💥 DISSOLVE COMMUNITY
const dissolveCommunity = async (req, res) => {
  try {
    const { communityId } = req.body;
    const userId = req.user._id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({ message: "Community not found" });
    }

    if (community.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the creator can dissolve this community." });
    }

    await Community.findByIdAndDelete(communityId);
    res.json({ message: "Community dissolved" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { browseCommunities, createCommunity, joinCommunity, leaveCommunity, dissolveCommunity };
