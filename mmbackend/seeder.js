const mongoose = require("mongoose");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Preference = require("./models/Preference");
const Like = require("./models/Like");
const Match = require("./models/Match");
const Community = require("./models/Community");

dotenv.config();

const clearDB = async () => {
    await User.deleteMany();
    await Preference.deleteMany();
    await Like.deleteMany();
    await Match.deleteMany();
    await Community.deleteMany();
};

const seedV3 = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected for V3 Seeding... 🚀");
        await clearDB();

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("password123", salt);

        const colleges = ["NIIT University", "IIT Delhi", "DTU", "NSUT"];
        const promptOptions = [
            { q: "My ideal mess meal is...", a: ["Paneer Butter Masala", "Chilly Chicken", "Double Fried Egg", "Rajma Chawal"] },
            { q: "You shouldn't mess with me if...", a: ["I haven't had my chai", "The mess serves lauki", "I'm debugging code", "I'm at the gym"] },
            { q: "Favorite campus spot:", a: ["The library corner", "The football field", "Tuck shop", "The rooftop"] }
        ];

        const usersData = [];
        for (let i = 1; i <= 40; i++) {
            const college = colleges[i % colleges.length];
            const name = `Student ${i}`;
            const gender = i % 2 === 0 ? "female" : "male";
            
            usersData.push({
                name,
                email: `student${i}@example.com`,
                password: hashedPassword,
                college,
                age: 18 + (i % 5),
                bio: `Bio for ${name}. I love ${['coding', 'sports', 'music', 'dance'][i % 4]}.`,
                interests: [['coding', 'gaming'], ['music', 'travel'], ['sports', 'gym'], ['reading', 'art']][i % 4],
                gender,
                profilePic: `https://i.pravatar.cc/400?u=${i}`,
                prompts: [
                    { question: promptOptions[0].q, answer: promptOptions[0].a[i % 4] },
                    { question: promptOptions[1].q, answer: promptOptions[1].a[i % 4] }
                ]
            });
        }

        const createdUsers = await User.insertMany(usersData);
        console.log(`✅ ${createdUsers.length} Rich Persona Users Created.`);

        const mealTimes = ["breakfast", "lunch", "snacks", "dinner"];
        for (const user of createdUsers) {
            await Preference.create({
                user: user._id,
                mealTime: mealTimes[Math.floor(Math.random() * mealTimes.length)],
                preferredGender: "any",
                groupSize: 2 + Math.floor(Math.random() * 2),
                mealDate: "today",
                isAvailable: true
            });
        }

        console.log("✅ Preferences Configured.");
        console.log("🎊 V3 SEEDING COMPLETE!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedV3();
