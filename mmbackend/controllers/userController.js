const User = require("../models/User");
const Preference = require("../models/Preference");

// GET USER PROFILE
const getUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const preferences = await Preference.findOne({ user: user._id });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      college: user.college,
      age: user.age,
      gender: user.gender,
      interests: user.interests,
      clubs: user.clubs,
      intent: user.intent,
      profilePic: user.profilePic,
      bio: user.bio,
      isAvailable: user.isAvailable,
      preferences: preferences || null, // 🔥 Include preferences
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

    // Update fields (only if provided)
    user.college = req.body.college || user.college;
    user.age = req.body.age || user.age;
    user.gender = req.body.gender || user.gender;
    user.interests = req.body.interests || user.interests;
    user.clubs = req.body.clubs || user.clubs;
    user.intent = req.body.intent || user.intent;
    user.profilePic = req.body.profilePic || user.profilePic;
    user.bio = req.body.bio || user.bio;
    user.isAvailable = typeof req.body.isAvailable !== 'undefined' ? req.body.isAvailable : user.isAvailable;

    const updatedUser = await user.save();

    res.json({
      message: "Profile updated",
      user: updatedUser,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getUserProfile, updateUserProfile };