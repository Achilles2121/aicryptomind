type CacheEntry<T> = { value: T; expires: number };

/**
 * Schlanker In-Memory-Cache mit TTL und defensivem Verhalten.
 * Wird als Singleton an globalThis gehängt, damit Vercel-Dev/Hot-Reload
 * nicht bei jeder Ausführung einen neuen Cache erzeugt.
 */
class MemoryCache {
  private store: Map<string, CacheEntry<unknown>>;
  private readonly ttlMs: number;

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
    this.store = new Map();
  }

  get<T>(key: string): T | undefined {
    try {
      const entry = this.store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expires) {
        this.store.delete(key);
        return undefined;
      }
      return entry.value as T;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T): T {
    try {
      this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    } catch {
      // bei Fehler Cache ignorieren
    }
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

const globalAny = globalThis as typeof globalThis & { __VAI_CACHE__?: MemoryCache };

export const cache: MemoryCache = globalAny.__VAI_CACHE__ ?? (globalAny.__VAI_CACHE__ = new MemoryCache());

export const cacheKey = (...parts: (string | number | undefined)[]) => parts.filter(Boolean).join(":");
