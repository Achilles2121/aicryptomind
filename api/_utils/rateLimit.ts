type LimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, LimitBucket>();

export function isRateLimited(
  key: string,
  limit = 60,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > limit) return true;
  return false;
}
