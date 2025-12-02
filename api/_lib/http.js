const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(message, status = 500, body) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

export async function fetchJson(url, options = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 10000,
    retries = 0,
    backoffMs = 250,
  } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text();
        throw new HttpError(`HTTP ${res.status} for ${url}`, res.status, text.slice(0, 500));
      }
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!text) return null;
      if (contentType.includes("application/json")) {
        try {
          return JSON.parse(text);
        } catch (err) {
          throw new HttpError("Invalid JSON response", 502, text.slice(0, 200));
        }
      }
      return text;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt === retries) break;
      await sleep(backoffMs * (attempt + 1));
    }
  }
  throw lastError;
}

export const jsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

export const errorResponse = (message, status = 500, meta = {}) =>
  jsonResponse({ error: message, ...meta, generatedAt: new Date().toISOString() }, status);
