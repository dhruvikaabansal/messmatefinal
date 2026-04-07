const User = require("../models/User");
const Preference = require("../models/Preference");
const { calculateAge } = require("../utils/ageUtils");

// GET USER PROFILE
const getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const preferences = await Preference.findOne({ user: user._id });

    res.json({
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        birthday: user.birthday,
        age: calculateAge(user.birthday),
        gender: user.gender,
        interests: user.interests,
        clubs: user.clubs,
        intent: user.intent,
        profilePic: user.profilePic,
        bio: user.bio,
        prompts: user.prompts || [],
        isAvailable: user.isAvailable,
        preferences: preferences || null, 
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE USER PROFILE
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update fields (only if provided in body)
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.college !== undefined) user.college = req.body.college;
    if (req.body.gender !== undefined) user.gender = req.body.gender;
    if (req.body.interests !== undefined) user.interests = req.body.interests;
    if (req.body.clubs !== undefined) user.clubs = req.body.clubs;
    if (req.body.intent !== undefined) user.intent = req.body.intent;
    if (req.body.profilePic !== undefined) user.profilePic = req.body.profilePic;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.prompts !== undefined) user.prompts = req.body.prompts;
    
    // Birthday handling
    if (req.body.birthday !== undefined) {
      const bDay = new Date(req.body.birthday);
      if (user.birthday && user.birthday.toISOString() !== bDay.toISOString()) {
        return res.status(400).json({ message: "Birthday cannot be changed once set." });
      }
      user.birthday = bDay;
    }

    if (req.body.isAvailable !== undefined) {
      user.isAvailable = req.body.isAvailable;
    }

    const updatedUser = await user.save();
    
    // 🔥 Standardize the response to match getUserProfile exactly
    const preferences = await Preference.findOne({ user: user._id });

    res.json({
      message: "Profile updated successfully",
      profile: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        college: updatedUser.college,
        birthday: updatedUser.birthday,
        age: calculateAge(updatedUser.birthday),
        gender: updatedUser.gender,
        interests: updatedUser.interests,
        clubs: updatedUser.clubs,
        intent: updatedUser.intent,
        profilePic: updatedUser.profilePic,
        bio: updatedUser.bio,
        prompts: updatedUser.prompts || [],
        isAvailable: updatedUser.isAvailable,
        preferences: preferences || null,
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUserProfile, updateUserProfile };