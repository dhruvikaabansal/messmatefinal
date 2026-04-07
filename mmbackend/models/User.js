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

    birthday: {
      type: Date,
      // Required during profile completion (Step 1), but optional during registration
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for age calculation
userSchema.virtual("age").get(function () {
  if (!this.birthday) return 20;
  const today = new Date();
  const birthDate = new Date(this.birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

const User = mongoose.model("User", userSchema);

module.exports = User;