import { retry } from "./retry";

export type SafeFetchOptions = {
  timeoutMs?: number;
  attempts?: number;
  fallbackData?: unknown;
};

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit,
  options: SafeFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 3_500, attempts = 2, fallbackData } = options;

  const perform = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = (await response.json()) as T;
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await retry(perform, { attempts, delayMs: 180 });
  } catch (error) {
    if (fallbackData !== undefined) {
      return fallbackData as T;
    }
    throw error;
  }
}
