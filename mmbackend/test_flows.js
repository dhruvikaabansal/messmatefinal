const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testFlows() {
    console.log("🧪 Starting MessMate Automated Flow Tests...");
    
    try {
        // 1. SIGNUP
        console.log("📝 Testing Signup...");
        const signupRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: "Test User",
            email: `test${Date.now()}@example.com`,
            password: "password123",
            college: "NIIT University"
        });
        const { token, user } = signupRes.data;
        console.log("✅ Signup successful!");

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // 2. PROFILE SETUP
        console.log("👤 Testing Profile Setup...");
        await axios.put(`${BASE_URL}/user/profile`, {
            age: 20,
            gender: "male",
            bio: "I love testing apps!",
            interests: ["coding", "testing", "chai"],
            profilePic: "https://via.placeholder.com/150"
        }, config);
        console.log("✅ Profile setup successful!");

        // 3. PREFERENCES
        console.log("🍱 Testing Preferences...");
        await axios.put(`${BASE_URL}/preferences`, {
            mealTime: "lunch",
            preferredGender: "any",
            groupSize: 2,
            isAvailable: true
        }, config);
        console.log("✅ Preferences set!");

        // 4. DISCOVER
        console.log("🕵️ Testing Discover (Get Candidates)...");
        const candRes = await axios.get(`${BASE_URL}/match/candidates`, config);
        console.log(`✅ Found ${candRes.data.candidates.length} candidates!`);

        // 5. SEND LIKE
        if (candRes.data.candidates.length > 0) {
            const targetId = candRes.data.candidates[0]._id;
            console.log(`❤️ Testing Send Like to ${targetId}...`);
            const likeRes = await axios.post(`${BASE_URL}/match/like`, { targetUserId: targetId }, config);
            console.log("✅ Like sent!", likeRes.data.message);
        }

        // 6. COMMUNITY
        console.log("👥 Testing Community Browse...");
        const commRes = await axios.get(`${BASE_URL}/community`, config);
        console.log(`✅ Found ${commRes.data.communities.length} communities!`);

        console.log("\n🎊 ALL TESTS PASSED SUCCESSFULLY! MessMate is ready. 🚀");
    } catch (err) {
        console.error("❌ TEST FAILED:", err.response?.data?.message || err.message);
        process.exit(1);
    }
}

testFlows();
