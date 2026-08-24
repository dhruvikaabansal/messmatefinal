const mongoose = require("mongoose");

const PROMPT_LIMIT = 3;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 60,
    },

    // select:false — the hash must never ride along on an ordinary query.
    // Anything that needs it (login) asks for it explicitly.
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    phone: { type: String, trim: true },

    college: {
      type: String,
      required: [true, "College is required"],
      trim: true,
      lowercase: true,
      index: true,
    },

    birthday: { type: Date },

    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "prefer not to say"],
    },

    interests: { type: [String], default: [] },
    clubs: { type: [String], default: [] },

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

    profilePic: { type: String, default: "" },

    bio: {
      type: String,
      default: "",
      maxlength: 180,
    },

    prompts: {
      type: [
        {
          _id: false,
          question: { type: String, trim: true, maxlength: 120 },
          answer: { type: String, trim: true, maxlength: 300 },
        },
      ],
      default: [],
      validate: [
        (v) => v.length <= PROMPT_LIMIT,
        `At most ${PROMPT_LIMIT} prompts`,
      ],
    },

    // Drives the "active right now" signal in ranking. Touched by auth middleware,
    // at most once a minute, so it costs effectively nothing.
    lastActiveAt: { type: Date, default: Date.now, index: true },

    isAvailable: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual("age").get(function () {
  if (!this.birthday) return null;
  const today = new Date();
  const b = new Date(this.birthday);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
});

/**
 * One place that decides whether a profile is ready to be shown to others.
 * The frontend used to re-derive this in four different files with four
 * slightly different rules, which is why users kept getting bounced back to
 * the profile page after they had already filled it in.
 */
userSchema.virtual("isProfileComplete").get(function () {
  return Boolean(
    this.name &&
      this.college &&
      this.birthday &&
      this.gender &&
      (this.interests || []).length >= 3 &&
      this.bio &&
      this.bio.trim().length >= 10
  );
});

// Fields the public card needs — used with .select() everywhere.
userSchema.statics.CARD_FIELDS =
  "name birthday gender college bio interests clubs intent personalityType foodPreference profilePic prompts lastActiveAt";

module.exports = mongoose.model("User", userSchema);
