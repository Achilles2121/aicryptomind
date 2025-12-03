import { safeFetch } from "./safeFetch";

type CacheEntry<T> = { value: T; expires: number };

const cache = new Map<string, CacheEntry<unknown>>();
const TTL = 500;

const buildKey = (path: string, params?: Record<string, unknown>) =>
  `${path}?${JSON.stringify(params ?? {})}`;

const getCache = <T>(key: string): T | undefined => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
};

const setCache = <T>(key: string, value: T): T => {
  cache.set(key, { value, expires: Date.now() + TTL });
  return value;
};

async function retry<T>(operation: () => Promise<T>, attempts = 2, delay = 120): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

const toQuery = (params?: Record<string, unknown>) => {
  if (!params) return "";
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    qs.append(key, String(value));
  });
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
};

async function request<T>(
  path: string,
  params?: Record<string, unknown>,
  init?: RequestInit
): Promise<T> {
  const key = buildKey(path, params);
  const cached = getCache<T>(key);
  if (cached !== undefined) return cached;

  const query = toQuery(params);
  const data = await retry(
    () => safeFetch<T>(`/api${path}${query}`, { ...(init || {}), timeoutMs: 5500 }),
    3,
    150
  );
  return setCache(key, data);
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(path, params),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
};
