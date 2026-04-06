/**
 * Utility to check if a meal time has passed for a specific date.
 * @param {string} mealTime - 'breakfast', 'lunch', 'snacks', 'dinner'
 * @param {string} mealDate - 'YYYY-MM-DD'
 * @returns {boolean} - true if the meal time has passed
 */
export const isMealTimePassed = (mealTime, mealDate) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

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

    const currentHour = now.getHours();
    
    return currentHour >= cutOffs[mealTime];
};

export const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];
