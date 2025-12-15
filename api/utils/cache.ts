type CacheEntry<T> = { value: T; expiresAt: number };

class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): T {
    const ttl = Number.isFinite(ttlMs) ? Math.max(0, Number(ttlMs)) : this.defaultTtlMs;
    const expiresAt = Date.now() + ttl;
    this.store.set(key, { value, expiresAt });
    return value;
  }

  clear(key?: string) {
    if (typeof key === "string") {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }
}

const globalAny = globalThis as typeof globalThis & { __VAI_CACHE__?: MemoryCache };
export const cache: MemoryCache = globalAny.__VAI_CACHE__ ?? (globalAny.__VAI_CACHE__ = new MemoryCache());

export const cacheKey = (...parts: (string | number | undefined)[]) =>
  parts
    .filter((part) => part !== undefined && part !== "")
    .map((part) => String(part))
    .join(":");

export async function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  cache.set(key, value, ttlMs);
  return value;
}
