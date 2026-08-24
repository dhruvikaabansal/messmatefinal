/**
 * seed.js — fill a database with believable test users for one college.
 *
 *   npm run seed                       # 24 users at "niit university"
 *   COLLEGE="dtu" COUNT=40 npm run seed
 *
 * Every seeded account uses the password `password123`. Safe to re-run: it
 * removes previously seeded users (identified by the @seed.messmate.test
 * domain) before inserting, and never touches real accounts.
 */

require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");
const Preference = require("../models/Preference");
const UserSlotState = require("../models/UserSlotState");
const Like = require("../models/Like");
const Match = require("../models/Match");
const Community = require("../models/Community");
const Message = require("../models/Message");
const { nextOpenSlot, MEAL_TYPES } = require("../utils/slotUtils");

const SEED_DOMAIN = "seed.messmate.test";

const FIRST = ["Aarav", "Ishita", "Kabir", "Meera", "Rohan", "Sara", "Dev", "Nikhil", "Ananya", "Zoya",
  "Arjun", "Riya", "Vihaan", "Tara", "Kunal", "Diya", "Yash", "Naina", "Om", "Sneha",
  "Aditya", "Kavya", "Reyansh", "Mira"];
const LAST = ["Menon", "Rao", "Sethi", "Nair", "Das", "Qureshi", "Patel", "Verma", "Iyer", "Khan",
  "Bhatt", "Chatterjee", "Reddy", "Joshi", "Gill", "Mehta"];

const INTERESTS = ["anime", "k-pop", "bollywood", "indie music", "hip hop", "coding", "startups",
  "design", "robotics", "cricket", "football", "badminton", "gym", "chess", "filter coffee",
  "street food", "baking", "photography", "poetry", "reading", "trekking", "gaming", "dance", "debate"];

const CLUBS = ["Robotics club", "Dance society", "Debate society", "Photography club", "Football team", "Coding club"];

const BIOS = [
  "Third year, permanently hungry, will trade notes for parathas.",
  "Runs on filter coffee and last-minute submissions.",
  "Looking for someone to argue about football with over dinner.",
  "I will walk fifteen minutes for better chai. Every time.",
  "New here and tired of eating with my laptop.",
  "Ask me about my dissertation and I will not stop talking.",
  "Mostly here for the food, staying for the company.",
];

const PROMPTS = [
  { question: "My go-to mess order", answer: "Extra rice, always." },
  { question: "A hill I'll die on", answer: "Filter coffee beats everything." },
  { question: "I'll talk for hours about", answer: "Why the 8pm dinner rush is a solvable problem." },
  { question: "Best thing about this campus", answer: "The 11pm maggi window." },
];

const pick = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};
const one = (arr) => arr[Math.floor(Math.random() * arr.length)];

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const college = (process.env.COLLEGE || "niit university").toLowerCase();
  const count = Math.min(200, Number(process.env.COUNT) || 24);

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. Seeding ${count} users at "${college}".`);

  // Clear previous seed data only.
  const previous = await User.find({ email: new RegExp(`@${SEED_DOMAIN}$`) }).select("_id").lean();
  const ids = previous.map((u) => u._id);
  if (ids.length) {
    await Promise.all([
      User.deleteMany({ _id: { $in: ids } }),
      Preference.deleteMany({ user: { $in: ids } }),
      UserSlotState.deleteMany({ userId: { $in: ids } }),
      Like.deleteMany({ $or: [{ fromUser: { $in: ids } }, { toUser: { $in: ids } }] }),
      Match.deleteMany({ users: { $in: ids } }),
      Community.deleteMany({ createdBy: { $in: ids } }),
    ]);
    console.log(`Removed ${ids.length} previously seeded user(s).`);
  }

  const password = await bcrypt.hash("password123", await bcrypt.genSalt(10));
  const slot = nextOpenSlot();

  const users = [];
  for (let i = 0; i < count; i++) {
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;
    const year = 2003 + (i % 5);
    users.push({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@${SEED_DOMAIN}`,
      password,
      college,
      birthday: new Date(`${year}-0${(i % 9) + 1}-1${i % 9}`),
      gender: ["male", "female", "non-binary"][i % 3],
      interests: pick(INTERESTS, 3 + (i % 4)),
      clubs: pick(CLUBS, i % 2),
      intent: ["casual", "just company", "networking", "dating"][i % 4],
      personalityType: ["introvert", "ambivert", "extrovert"][i % 3],
      foodPreference: ["veg", "non-veg", "vegan"][i % 3],
      bio: one(BIOS),
      prompts: pick(PROMPTS, 2),
      lastActiveAt: new Date(Date.now() - Math.floor(Math.random() * 120) * 60000),
    });
  }

  const created = await User.insertMany(users);
  console.log(`Created ${created.length} users.`);

  await Preference.insertMany(
    created.map((u, i) => ({
      user: u._id,
      // Most on the next open slot so the deck is populated straight away.
      mealTime: i % 4 === 0 ? one(MEAL_TYPES) : slot.mealTime,
      mealDate: slot.mealDate,
      preferredGender: i % 5 === 0 ? ["male", "female"][i % 2] : "any",
      openTo: "both",
      groupSize: 4,
      isAvailable: true,
    }))
  );

  // A couple of open tables so the group flow has something to show.
  const hosts = created.slice(0, 2);
  for (const [i, host] of hosts.entries()) {
    const table = await Community.create({
      name: ["Late lunch, loud table", "Assignment panic + chai"][i],
      slotId: `${slot.mealDate}_${slot.mealTime}`,
      mealTime: slot.mealTime,
      mealDate: slot.mealDate,
      college,
      description: "Seeded table — come sit down.",
      venue: ["Mess 2, near the window", "Main canteen"][i],
      interests: pick(INTERESTS, 2),
      maxMembers: 4,
      createdBy: host._id,
      members: [host._id, created[10 + i]._id],
    });
    await UserSlotState.insertMany(
      [host._id, created[10 + i]._id].map((userId) => ({
        userId,
        slotId: table.slotId,
        state: "in_community",
        communityId: table._id,
      }))
    );
    await Message.create({
      threadType: "community",
      threadId: table._id,
      sender: host._id,
      kind: "system",
      text: `${host.name} opened this table for ${slot.mealTime}.`,
    });
  }

  console.log(`\nDone. Sign in as any of these with password "password123":`);
  created.slice(0, 3).forEach((u) => console.log(`  ${u.email}`));
  console.log(`\nSlot: ${slot.mealTime} on ${slot.mealDate}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
