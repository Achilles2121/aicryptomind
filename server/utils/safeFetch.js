/* eslint-env node */
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async (promise, timeoutMs, controller) => {
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await promise;
    clearTimeout(timeout);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
};

export async function safeFetchJson(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    label = "fetch",
    expected = "json",
    ...rest
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const response = await withTimeout(
        fetch(url, {
          ...rest,
          signal: controller.signal,
        }),
        timeoutMs,
        controller
      );

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`[${label}] HTTP ${response.status} - ${response.statusText} - ${text.slice(0, 200)}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (expected === "json") {
        if (contentType.includes("application/json")) return response.json();
        const raw = await response.text();
        try {
          return JSON.parse(raw);
        } catch {
          throw new Error(`[${label}] Expected JSON payload`);
        }
      }

      return response.text();
    } catch (err) {
      lastError = err;
      console.warn(`[${label}] attempt ${attempt + 1} failed:`, err.message);
      if (attempt === retries) break;
      await wait(500 * (attempt + 1));
    }
  }

  throw lastError;
}

export default { safeFetchJson };
