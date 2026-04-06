/**
 * Get today's date as a YYYY-MM-DD string in LOCAL timezone (IST for Indian users).
 * IMPORTANT: Do NOT use new Date().toISOString().split('T')[0] — that gives UTC date,
 * which at 1:00 AM IST is still the previous day in UTC.
 */
export const getLocalDateStr = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Utility to check if a meal time has passed for a specific date.
 * @param {string} mealTime - 'breakfast', 'lunch', 'snacks', 'dinner'
 * @param {string} mealDate - 'YYYY-MM-DD'
 * @returns {boolean} - true if the meal time has passed
 */
export const isMealTimePassed = (mealTime, mealDate) => {
    const now = new Date();
    const todayStr = getLocalDateStr(now); // ✅ Local date, not UTC

    // If the date is in the future, the meal has not passed
    if (mealDate > todayStr) return false;
    // If the date is in the past, all meals have passed
    if (mealDate < todayStr) return true;

    // Cut-off hours (24-hour format)
    const cutOffs = {
        breakfast: 10, // 10:00 AM
        lunch: 15,     // 3:00 PM
        snacks: 18,    // 6:00 PM
        dinner: 22     // 10:00 PM
    };

    const currentHour = now.getHours(); // ✅ Local hour (IST)
    
    return currentHour >= cutOffs[mealTime];
};

/**
 * Returns the first available meal time for a given date.
 * If all meals for 'today' have passed, defaults to the first meal.
 */
export const getFirstAvailableMeal = (dateStr) => {
    const todayStr = getLocalDateStr(); // ✅ Local date
    if (dateStr > todayStr) return MEAL_ORDER[0];
    
    for (const meal of MEAL_ORDER) {
        if (!isMealTimePassed(meal, dateStr)) return meal;
    }
    
    return MEAL_ORDER[MEAL_ORDER.length - 1]; // Default to dinner if all passed
};

export const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];
