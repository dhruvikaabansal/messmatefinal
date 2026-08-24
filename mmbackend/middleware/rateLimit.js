/**
 * rateLimit.js — small in-process limiter.
 *
 * Deliberately dependency-free and memory-backed: a campus app on a single
 * dyno doesn't need Redis, and this stops the obvious abuse (credential
 * stuffing, a script mass-liking everyone, chat flooding) without adding
 * infrastructure. If MessMate ever runs on more than one instance, swap the
 * store for Redis — the call sites won't change.
 */

const buckets = new Map();

// Keep memory bounded even if the process runs for weeks.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

const createLimiter = ({ windowMs, max, message, keyFn }) => (req, res, next) => {
  const key = `${keyFn ? keyFn(req) : req.ip}:${req.baseUrl}${req.path}`;
  const now = Date.now();

  let entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(key, entry);
  }

  entry.count += 1;
  const remaining = Math.max(0, max - entry.count);
  res.setHeader("X-RateLimit-Limit", max);
  res.setHeader("X-RateLimit-Remaining", remaining);

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({ message, retryAfter });
  }
  return next();
};

const byUser = (req) => (req.user?._id ? String(req.user._id) : req.ip);

/** Login / register — the only endpoints worth brute-forcing. */
const authLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many attempts. Wait a few minutes and try again.",
});

/** Likes, skips, joins — generous enough that a fast swiper never notices. */
const actionLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 90,
  message: "Slow down a moment.",
  keyFn: byUser,
});

const messageLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 45,
  message: "You're sending messages very fast. Take a breath.",
  keyFn: byUser,
});

module.exports = { createLimiter, authLimiter, actionLimiter, messageLimiter };
