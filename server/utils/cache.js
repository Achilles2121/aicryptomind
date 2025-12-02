const cache = new Map();

const now = () => Date.now();

export const getCache = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires && entry.expires < now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

export const setCache = (key, value, ttlMs = 500) => {
  const expires = ttlMs ? now() + ttlMs : 0;
  cache.set(key, { value, expires });
  return value;
};

export const withCache = async (key, ttlMs = 500, factory) => {
  const cached = getCache(key);
  if (cached !== null && cached !== undefined) return cached;
  const value = await factory();
  return setCache(key, value, ttlMs);
};

export const clearCache = (predicate = () => true) => {
  for (const [key] of cache.entries()) {
    if (predicate(key)) cache.delete(key);
  }
};

export default { getCache, setCache, withCache, clearCache };
