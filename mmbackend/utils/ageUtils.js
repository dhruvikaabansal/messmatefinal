/**
 * Age from a birthday. Returns null when unknown so callers can decide what to
 * show — the old version returned a hardcoded 20, which quietly made every
 * profile without a birthday look like a 20-year-old and skewed age matching.
 */
const calculateAge = (birthday) => {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
};

module.exports = { calculateAge };
