const Match = require("../models/Match");
const Community = require("../models/Community");
const User = require("../models/User");

const MEAL_EXPIRY_CONFIG = {
  breakfast: { hour: 11, minute: 30 },
  lunch: { hour: 16, minute: 30 },
  snacks: { hour: 19, minute: 30 },
  dinner: { hour: 23, minute: 59 },
};

const runAutoCleanup = async () => {
  try {
    const now = new Date();
    // Get today's date in YYYY-MM-DD for comparison
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(`[CLEANUP] Date: ${todayStr}, Time: ${currentHour}:${currentMinute}`);

    // 1. DISSOLVE MATCHES
    const matches = await Match.find({ status: "active" });
    for (const match of matches) {
      const { mealTime, mealDate, _id } = match;
      
      let shouldExpire = false;

      if (mealDate < todayStr) {
        // expired by date
        shouldExpire = true;
      } else if (mealDate === todayStr) {
        // check time-based expiry for today
        const config = MEAL_EXPIRY_CONFIG[mealTime];
        if (config) {
          if (currentHour > config.hour || (currentHour === config.hour && currentMinute >= config.minute)) {
            shouldExpire = true;
          }
        }
      }

      if (shouldExpire) {
        console.log(`[CLEANUP] Dissolving Match ${_id} (${mealTime} on ${mealDate})`);
        await Match.findByIdAndDelete(_id);
        await User.updateMany({ activeMatch: _id }, { activeMatch: null });
      }
    }

    // 2. DISSOLVE COMMUNITIES
    const communities = await Community.find({});
    for (const community of communities) {
      const { mealTime, mealDate, _id } = community;
      
      let shouldExpire = false;
      if (mealDate < todayStr) {
        shouldExpire = true;
      } else if (mealDate === todayStr) {
        const config = MEAL_EXPIRY_CONFIG[mealTime];
        if (config) {
          if (currentHour > config.hour || (currentHour === config.hour && currentMinute >= config.minute)) {
            shouldExpire = true;
          }
        }
      }

      if (shouldExpire) {
        console.log(`[CLEANUP] Dissolving Community ${_id} (${community.name} on ${mealDate})`);
        await Community.findByIdAndDelete(_id);
      }
    }

  } catch (error) {
    console.error("[CLEANUP ERROR]:", error);
  }
};

module.exports = { runAutoCleanup };
