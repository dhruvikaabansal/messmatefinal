const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Preference = require("../models/Preference");
const Like = require("../models/Like");
const Match = require("../models/Match");
const Community = require("../models/Community");

dotenv.config();

const clearDB = async () => {
    console.log("Cleaning Database... 🧹");
    await User.deleteMany();
    await Preference.deleteMany();
    await Like.deleteMany();
    await Match.deleteMany();
    await Community.deleteMany();
};

const seedNIIT = async () => {
    try {
        // Use the connection string from .env or fallback to local
        const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/messmate";
        await mongoose.connect(mongoUri);
        console.log("Connected for NIIT Seeding... 🚀");
        
        await clearDB();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("password123", salt);

        const promptOptions = [
            { q: "My ideal mess meal is...", a: ["Paneer Butter Masala", "Chilly Chicken", "Double Fried Egg", "Rajma Chawal", "Masala Dosa"] },
            { q: "You shouldn't mess with me if...", a: ["I haven't had my chai", "The mess serves lauki", "I'm debugging code", "I'm at the gym", "I'm watching a movie"] },
            { q: "Favorite campus spot:", a: ["The library corner", "The football field", "Tuck shop", "The rooftop", "The lake side"] }
        ];

        const interestsList = ["Coding", "Gaming", "Music", "Travel", "Sports", "Gym", "Reading", "Art", "Dance", "Photography"];

        const usersData = [];
        const totalUsers = 30;

        for (let i = 1; i <= totalUsers; i++) {
            const name = `NIITian ${i}`;
            const gender = i % 2 === 0 ? "female" : "male";
            
            // Randomly select 3 interests
            const myInterests = [];
            while(myInterests.length < 3) {
                const interest = interestsList[Math.floor(Math.random() * interestsList.length)];
                if(!myInterests.includes(interest)) myInterests.push(interest);
            }

            usersData.push({
                name,
                email: `niit${i}@example.com`,
                password: hashedPassword,
                college: "niit university", // 🔥 Stored as lowercase for matching consistency
                age: 18 + (i % 5),
                bio: `Student at NIIT. I love ${myInterests[0]} and hanging out at the ${promptOptions[2].a[i % 5]}.`,
                interests: myInterests,
                gender,
                profilePic: `https://i.pravatar.cc/400?u=niit${i}`,
                prompts: [
                    { question: promptOptions[0].q, answer: promptOptions[0].a[i % 5] },
                    { question: promptOptions[1].q, answer: promptOptions[1].a[Math.floor(Math.random() * 5)] }
                ]
            });
        }

        const createdUsers = await User.insertMany(usersData);
        console.log(`✅ ${createdUsers.length} NIIT University Users Created.`);

        const mealTimes = ["breakfast", "lunch", "snacks", "dinner"];
        const mealDates = ["today", "tomorrow"];

        for (const user of createdUsers) {
            await Preference.create({
                user: user._id,
                mealTime: mealTimes[Math.floor(Math.random() * mealTimes.length)],
                preferredGender: "any",
                groupSize: 2 + (Math.floor(Math.random() * 2)), // 2 or 3
                mealDate: mealDates[Math.floor(Math.random() * 2)],
                isAvailable: true
            });
        }

        console.log("✅ NIIT Preferences Configured.");
        console.log("🎊 NIIT SEEDING COMPLETE!");
        console.log("--------------------------------------------------");
        console.log("You can now login with: niit1@example.com / password123");
        console.log("--------------------------------------------------");
        process.exit();
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    }
};

seedNIIT();
