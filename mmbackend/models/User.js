const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    password: {
  type: String,
  required: [true, "Password is required"],
  minlength: 8,
},

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    college: {
      type: String,
      required: [true, "College is required"],
      trim: true,
      lowercase: true,
      index: true, // 🔥 faster matching queries
    },

    age: {
      type: Number,
      min: 16,
      max: 50,
    },

    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "prefer not to say"],
    },

    interests: {
      type: [String],
      default: [],
    },

    clubs: {
      type: [String],
      default: [],
    },

    // 🔥 added for better matching
    intent: {
      type: String,
      enum: ["casual", "networking", "dating", "just company"],
      default: "casual",
    },

    personalityType: {
      type: String,
      enum: ["introvert", "extrovert", "ambivert"],
    },

    foodPreference: {
      type: String,
      enum: ["veg", "non-veg", "vegan"],
    },
    
    // 🔥 NEW FIELDS FOR RICH PROFILES
    profilePic: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "Looking for lunch buddies 🍱",
      maxlength: 150,
    },
    mealPreference: {
      type: String, // optional detail
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    activeMatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    prompts: [
      {
        question: String,
        answer: String,
      },
    ],
  },
  {
    timestamps: true,
  },

  

);

const User = mongoose.model("User", userSchema);

module.exports = User;