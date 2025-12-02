const buckets = new Map();

const prune = (key, windowMs) => {
  const entry = buckets.get(key);
  if (!entry) return { count: 0, resetAt: Date.now() + windowMs };
  if (entry.resetAt < Date.now()) return { count: 0, resetAt: Date.now() + windowMs };
  return entry;
};

export const rateLimit = ({ windowMs = 60_000, max = 120, keyGenerator } = {}) => {
  const getKey = keyGenerator || ((req) => req.ip || req.headers["x-forwarded-for"] || "global");

  return (req, res, next) => {
    const key = getKey(req);
    const entry = prune(key, windowMs);
    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "rate_limited",
        message: "Rate limit exceeded",
        retryAfterSeconds: retryAfter,
      });
    }

    buckets.set(key, entry);
    return next();
  };
};

export default rateLimit;
