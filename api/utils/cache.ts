type CacheEntry<T> = { value: T; expires: number };

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>>;
  private ttlMs: number;

  constructor(ttlMs = 500) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): T {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    return value;
  }

  clear(key?: string) {
    if (key) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}

export const cache = new MemoryCache(500);

export const cacheKey = (...parts: (string | number | undefined)[]) =>
  parts.filter(Boolean).join(":");
