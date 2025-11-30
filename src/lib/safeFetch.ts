export type ApiHealthStatus = "ok" | "degraded" | "fallback" | "error";

export type SafeFetchOptions = RequestInit & {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  onHealthUpdate?: (service: string, status: ApiHealthStatus, message?: string) => void;
  onLog?: (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
  onToast?: (message: string, type?: "warn" | "error" | "info") => void;
  serviceName?: string;
};

export class AppError extends Error {
  status?: number;
  service?: string;
  constructor(message: string, status?: number, service?: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.service = service;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function safeFetch<T>(input: RequestInfo | URL, init: SafeFetchOptions = {}): Promise<T> {
  const {
    retries = 0,
    retryDelayMs = 400,
    timeoutMs = 10000,
    onHealthUpdate,
    onLog,
    onToast,
    serviceName,
    ...rest
  } = init;

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...rest, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        const err = new AppError(`HTTP ${res.status}`, res.status, serviceName);
        throw err;
      }
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json") ? await res.json() : ((await res.text()) as unknown as T);
      if (serviceName && onHealthUpdate) onHealthUpdate(serviceName, "ok");
      return data as T;
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err instanceof Error ? err : new Error(String(err));
      const status = err?.status ?? err?.statusCode;
      const timedOut = err?.name === "AbortError";
      const message = timedOut ? "timeout" : err?.message || "fetch failed";
      const healthStatus: ApiHealthStatus = attempt === retries ? "error" : "degraded";
      if (serviceName && onHealthUpdate) onHealthUpdate(serviceName, healthStatus, message);
      if (onLog) onLog(serviceName || "fetch", healthStatus === "error" ? "error" : "warn", message, { attempt, status });
      if (healthStatus === "error" && onToast && attempt === retries) {
        onToast(`${serviceName || "service"}: ${message}`, "error");
      }
      if (attempt < retries) await wait(retryDelayMs * (attempt + 1));
    }
  }
  throw lastErr || new Error("fetch failed");
}
