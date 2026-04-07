/**
 * Calculate age from birthday.
 * @param {Date|string} birthday 
 * @returns {number}
 */
const calculateAge = (birthday) => {
  if (!birthday) return 20; // fallback
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

module.exports = { calculateAge };
