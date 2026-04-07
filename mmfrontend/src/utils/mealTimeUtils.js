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
/**
 * Get current time in IST (UTC+5:30)
 * @returns {{ dateStr: string, hour: number }}
 */
export const getISTNow = () => {
    const now = new Date();
    // Convert to IST by adding 5 hours 30 minutes to UTC
    const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
    const istMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000 + IST_OFFSET_MS;
    const istDate = new Date(istMs);
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return {
        dateStr: `${year}-${month}-${day}`,
        hour: istDate.getUTCHours(),
    };
};

/**
 * Utility to check if a meal time has passed for a specific date.
 */
export const isMealTimePassed = (mealTime, mealDate) => {
    const { dateStr: todayIST, hour: currentHourIST } = getISTNow();

    if (mealDate > todayIST) return false;
    if (mealDate < todayIST) return true;

    const cutOffs = {
        breakfast: 10,
        lunch: 15,
        snacks: 18,
        dinner: 22
    };

    return currentHourIST >= cutOffs[mealTime];
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
