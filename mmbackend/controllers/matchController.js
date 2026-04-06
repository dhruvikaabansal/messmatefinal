const Preference = require("../models/Preference");
const Match = require("../models/Match");
const User = require("../models/User");
const Like = require("../models/Like");
const Community = require("../models/Community"); // 🔥 Added for cross-exclusivity check
const cosineSimilarity = require("../utils/cosineSimilarity");

// 🔥 GET CANDIDATES (Hard Filter + Fallback + Ranking)
const getCandidates = async (req, res) => {
  try {
    const currentUser = req.user;

    // 1. Get current user's preference
    const myPref = await Preference.findOne({ user: currentUser._id });
    if (!myPref || !myPref.isAvailable) {
       return res.json({ candidates: [], message: "Set your preferences first!" });
    }

    // 🚨 DATE-TIME EXCLUSIVITY RULE: Block if already matched for THIS SPECIFIC TIME slot
    const activeMatchForSlot = await Match.findOne({ 
        users: currentUser._id, 
        status: "active",
        mealDate: myPref.mealDate,
        mealTime: myPref.mealTime 
    }).populate("users");

    if (activeMatchForSlot) {
       const otherUser = activeMatchForSlot.users.find(u => u && u._id && u._id.toString() !== currentUser._id.toString());
       return res.json({ 
         candidates: [], 
         message: `You're already matched for ${myPref.mealTime} on ${myPref.mealDate}! 🔒`,
         isLocked: true,
         activeMatch: {
             _id: activeMatchForSlot._id,
             user: otherUser,
             mealTime: activeMatchForSlot.mealTime,
             mealDate: activeMatchForSlot.mealDate
         }
       });
    }
    
    // 🚨 CROSS-EXCLUSIVITY: Block if in a group meal for THIS SPECIFIC TIME slot
    const activeCommunityForSlot = await Community.findOne({ 
        members: currentUser._id,
        mealDate: myPref.mealDate,
        mealTime: myPref.mealTime
    });

    if (activeCommunityForSlot) {
       return res.json({ 
         candidates: [], 
         message: `You're already in a Group Meal for ${myPref.mealTime}! 👥`,
         isLocked: true,
         activeCommunity: {
             _id: activeCommunityForSlot._id,
             name: activeCommunityForSlot.name,
             mealTime: activeCommunityForSlot.mealTime,
             mealDate: activeCommunityForSlot.mealDate
         }
       });
    }

    // 2. Get users THIS user has already interacted with
    const previousInteractions = await Like.find({ fromUser: currentUser._id });
    const interactedUserIds = new Set(previousInteractions.map(l => l.toUser.toString()));

    // 3. STRICT SAME COLLEGE + MEAL + DATE FILTER
    const candidates = await User.find({
      _id: { $ne: currentUser._id },
      college: currentUser.college,
      activeMatch: null, // Only people without active matches
      gender: myPref.preferredGender === "any" ? { $exists: true } : myPref.preferredGender
    }).limit(100);

    // Filter by Preference (Must find THEIR preference to match mealTime and mealDate)
    const availableUsersWithPrefs = await Preference.find({
        user: { $in: candidates.map(c => c._id) },
        mealTime: myPref.mealTime,
        mealDate: myPref.mealDate, // Uses absolute date string
        isAvailable: true
    }).populate("user");

    const filteredCandidates = availableUsersWithPrefs
        .map(p => p.user)
        .filter(u => !interactedUserIds.has(u._id.toString()));

    // 4. RANKING (Cosine Similarity & Age)
    const rankedCandidates = filteredCandidates.map((otherUser) => {
      // Interest similarity
      const userInterests = currentUser.interests || [];
      const candidateInterests = otherUser.interests || [];
      const sharedInterests = userInterests.filter(i => candidateInterests.includes(i));
      
      const interestScore = cosineSimilarity(userInterests, candidateInterests);
      
      // Age similarity
      const ageDiff = Math.abs((currentUser.age || 20) - (otherUser.age || 20));
      const ageScore = Math.max(0, 1 - ageDiff / 10);

      const score = (interestScore * 0.7) + (ageScore * 0.3);

      return {
        ...otherUser.toObject(),
        matchScore: score,
        sharedInterests,
        reason: {
            sameCollege: otherUser.college === currentUser.college,
            interestMatch: sharedInterests.length,
            sharedInterests: sharedInterests.slice(0, 3)
        }
      };
    });

    // Filter out candidates with 0 shared interests then Sort by score
    const strictlyRanked = rankedCandidates.filter(c => c.matchScore > 0);
    strictlyRanked.sort((a, b) => b.matchScore - a.matchScore);

    res.json({ candidates: strictlyRanked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


// 🔥 LIKE USER (Mutual Match Logic)
const likeUser = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required" });
    }

    const currentUser = await User.findById(fromUserId);
    const myPref = await Preference.findOne({ user: fromUserId });

    // 🚨 EXCLUSIVE MATCH RULE: Check same time slot for 1-on-1
    const activeMatchForSlot = await Match.findOne({ 
        users: fromUserId, 
        status: "active",
        mealDate: myPref?.mealDate,
        mealTime: myPref?.mealTime 
    });
    if (activeMatchForSlot) {
       return res.status(400).json({ message: "You already have a 1-on-1 match for this time slot! 🔒" });
    }
    
    // 🚨 CROSS-EXCLUSIVITY RULE: Check same time slot for Communities
    const activeCommunityForSlot = await Community.findOne({ 
        members: fromUserId,
        mealDate: myPref?.mealDate,
        mealTime: myPref?.mealTime
    });
    if (activeCommunityForSlot) {
       return res.status(400).json({ message: "You are already in a Group Meal for this time slot! 👥" });
    }
    // 🚨 TARGET EXCLUSIVITY: Check if target user is free for THIS SLOT
    const targetMatchForSlot = await Match.findOne({ 
        users: targetUserId, 
        status: "active",
        mealDate: myPref?.mealDate,
        mealTime: myPref?.mealTime
    });
    if (targetMatchForSlot) {
       return res.status(400).json({ message: "This user already has a match for this time slot! 🍱" });
    }

    const targetCommunityForSlot = await Community.findOne({ 
        members: targetUserId,
        mealDate: myPref?.mealDate,
        mealTime: myPref?.mealTime
    });
    if (targetCommunityForSlot) {
       return res.status(400).json({ message: "This user is in a group meal for this time slot! 👥" });
    }

    // 1. Check if user already liked/skipped this person
    const existingInterest = await Like.findOne({ fromUser: fromUserId, toUser: targetUserId });
    if (existingInterest && existingInterest.status !== "pending") {
       return res.status(400).json({ message: "Already matched or skipped this user" });
    }

    // 2. Check if the recipient already liked the sender
    const reciprocalLike = await Like.findOne({ fromUser: targetUserId, toUser: fromUserId });

    if (reciprocalLike && reciprocalLike.status === "pending") {
      // 🎉 IT'S A MATCH!
      
      // Update the reciprocal like
      reciprocalLike.status = "matched";
      await reciprocalLike.save();

      // Update or create sender's like as matched
      if (existingInterest) {
        existingInterest.status = "matched";
        await existingInterest.save();
      } else {
        await Like.create({
          fromUser: fromUserId,
          toUser: targetUserId,
          status: "matched"
        });
      }

      // 🏆 Create the Match document
      const myPref = await Preference.findOne({ user: fromUserId });
      const newMatch = await Match.create({
        users: [fromUserId, targetUserId],
        mealTime: myPref ? myPref.mealTime : "lunch",
        mealDate: myPref ? myPref.mealDate : new Date().toISOString().split('T')[0],
      });

      // 🔥 Set activeMatch for both users
      await User.findByIdAndUpdate(fromUserId, { activeMatch: newMatch._id });
      await User.findByIdAndUpdate(targetUserId, { activeMatch: newMatch._id });

      return res.status(201).json({
        message: "🎉 Match Found!",
        isMatch: true
      });
    }

    // ⏳ Store pending like if not exists
    if (!existingInterest) {
      await Like.create({
        fromUser: fromUserId,
        toUser: targetUserId,
        status: "pending"
      });
    }

    res.status(201).json({
      message: "Liked!",
      isMatch: false
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 GET LIKES RECEIVED
const getLikesReceived = async (req, res) => {
  try {
    const currentUser = req.user;

    // 🚨 SLOT-AWARE EXCLUSIVITY: Check if user is already matched for their CURRENT preferred slot
    const pref = await Preference.findOne({ user: currentUser._id });
    if (pref) {
        const hasMatchInSlot = await Match.findOne({ 
            users: currentUser._id, 
            status: "active",
            mealDate: pref.mealDate,
            mealTime: pref.mealTime 
        });
        if (hasMatchInSlot) {
            return res.json({ likes: [], isLocked: true, message: `You're already matched for ${pref.mealTime}! 🔒` });
        }
    }

    const likes = await Like.find({
      toUser: currentUser._id,
      status: "pending"
    }).populate("fromUser");

    const usersWhoLiked = likes.map(l => ({
      _id: l.fromUser._id,
      name: l.fromUser.name,
      age: l.fromUser.age,
      college: l.fromUser.college,
      bio: l.fromUser.bio,
      interests: l.fromUser.interests,
      profilePic: l.fromUser.profilePic,
      likeId: l._id
    }));

    res.json({ likes: usersWhoLiked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 IGNORE LIKE
const ignoreLike = async (req, res) => {
  try {
    const { likeId } = req.body;
    await Like.findByIdAndUpdate(likeId, { status: "skipped" });
    res.json({ message: "Like ignored" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 SKIP USER (Avoid Showing Again)
const skipUser = async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target user ID is required" });
    }

    await Like.create({
      fromUser: fromUserId,
      toUser: targetUserId,
      status: "skipped"
    });

    res.status(201).json({ message: "Skipped" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 GET MATCHES
const getMatches = async (req, res) => {
  try {
    const currentUser = req.user;

    const matches = await Match.find({
      users: currentUser._id,
    }).populate("users");

    const cleanMatches = matches.map((match) => {
      const otherUser = match.users.find(
        (u) => u && u._id && u._id.toString() !== currentUser._id.toString()
      );
      if (!otherUser) return null;
      return {
        _id: match._id,
        user: otherUser,
        mealTime: match.mealTime,
        mealDate: match.mealDate,
        status: match.status,
        createdAt: match.createdAt,
      };
    }).filter(Boolean);

    res.json({ matches: cleanMatches });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const unmatchUser = async (req, res) => {
  try {
    const { matchId } = req.body;
    const currentUser = req.user;

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const otherUserId = match.users.find(u => u.toString() !== currentUser._id.toString());

    // Delete the Match
    await Match.findByIdAndDelete(matchId);

    // 🔥 CLEAR activeMatch for both users
    await User.updateMany({ activeMatch: matchId }, { activeMatch: null });

    // Update Likes (Delete to allow potential rematch later)
    await Like.deleteMany({
      $or: [
        { fromUser: currentUser._id, toUser: otherUserId },
        { fromUser: otherUserId, toUser: currentUser._id }
      ]
    });

    res.json({ message: "Unmatched successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🔥 SUCCESSFUL MESSMATE (Mark Match as Completed)
const completeMatch = async (req, res) => {
  try {
    const { matchId } = req.body;
    const match = await Match.findById(matchId);

    if (!match) return res.status(404).json({ message: "Match not found" });

    // Update Match Status
    match.status = 'completed';
    await match.save();

    // 🔥 CLEAR activeMatch for both users
    await User.updateMany({ activeMatch: matchId }, { activeMatch: null });

    res.json({ message: "🎉 Hope you had a great meal! Match history saved." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCandidates, likeUser, skipUser, getMatches, getLikesReceived, ignoreLike, unmatchUser, completeMatch };

