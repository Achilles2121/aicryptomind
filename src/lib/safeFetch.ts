import {
  type DataSourceKey,
  type DataSourceStatus,
  dataSources,
  identifySource,
  isSourceEnabled,
} from "../config/dataSources";

import type { ToastFn, ToastType } from "./toast";
export type { ToastFn, ToastType } from "./toast";
export type ApiHealthStatus = "ok" | "warn" | "error" | "degraded" | "disabled";

// allow use in browser/edge without Node globals
declare const process: { env?: Record<string, string | undefined> } | undefined;
export type ApiHealthUpdateFn = (service: string, status: ApiHealthStatus, message?: string) => void;

export type SourceHealthEntry = {
  status: DataSourceStatus;
  message?: string;
  code?: string;
  ts: number;
};

export type SourceHealthSnapshot = Record<DataSourceKey, SourceHealthEntry>;

const healthState = new Map<DataSourceKey, SourceHealthEntry>();
const healthListeners = new Set<(snapshot: SourceHealthSnapshot) => void>();

const emitHealth = (source: DataSourceKey, status: DataSourceStatus, message?: string, code?: string) => {
  const entry: SourceHealthEntry = { status, message, code, ts: Date.now() };
  healthState.set(source, entry);
  const snapshot = getSourceHealthSnapshot();
  for (const listener of healthListeners) {
    try {
      listener(snapshot);
    } catch (err) {
      console.warn("health listener error", err);
    }
  }
};

const isDataSourceKey = (value?: string | null): value is DataSourceKey => {
  if (!value) return false;
  return Boolean(dataSources[value as DataSourceKey]);
};

export const getSourceHealthSnapshot = (): SourceHealthSnapshot => {
  const snapshot: Partial<SourceHealthSnapshot> = {};
  for (const [key, value] of healthState.entries()) {
    snapshot[key] = value;
  }
  return snapshot as SourceHealthSnapshot;
};

export const subscribeToSourceHealth = (listener: (snapshot: SourceHealthSnapshot) => void) => {
  healthListeners.add(listener);
  listener(getSourceHealthSnapshot());
  return () => healthListeners.delete(listener);
};

const DISABLED_SOURCE_CODE = "DISABLED_SOURCE";

export type SafeFetchOptions = RequestInit & {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  onHealthUpdate?: ApiHealthUpdateFn;
  onLog?: (source: string, level: ToastType, message?: string, meta?: Record<string, unknown>) => void;
  onToast?: ToastFn;
  serviceName?: string;
  uiLevel?: "silent" | "status" | "toast";
  abortKey?: string;
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

const isRequestLike = (val: unknown): val is { url?: string; href?: string } => {
  if (!val || typeof val !== "object") return false;
  const maybeObj = val as Record<string, unknown>;
  return (typeof maybeObj.url === "string" && maybeObj.url.length > 0) || (typeof maybeObj.href === "string" && maybeObj.href.length > 0);
};

const toUrlString = (input: RequestInfo | URL) => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  const maybeRequestLike: unknown = input;
  if (isRequestLike(maybeRequestLike)) return maybeRequestLike.url || maybeRequestLike.href || "";
  return "";
};

const resolveSourceKey = (serviceName?: string, input?: RequestInfo | URL): DataSourceKey | null => {
  const normalized = serviceName?.toLowerCase() ?? null;
  if (normalized && isDataSourceKey(normalized)) return normalized;
  if (input) {
    const detected = identifySource(toUrlString(input));
    if (detected && isDataSourceKey(detected)) return detected;
  }
  return null;
};

const isCorsError = (err: Error) => {
  const msg = err?.message?.toLowerCase() || "";
  return msg.includes("failed to fetch") || msg.includes("network request failed") || msg.includes("cors");
};

const hasMissingKeys = (sourceKey: DataSourceKey | null) => {
  if (!sourceKey) return [];
  const cfg = dataSources[sourceKey];
  if (!cfg?.premium || !cfg.requiredKeys?.length) return [];
  const missing = cfg.requiredKeys.filter((key) => {
    const val =
      (import.meta as any)?.env?.[key] ??
      (typeof process !== "undefined" && process?.env ? (process as any)?.env?.[key] : undefined);
    return !val;
  });
  return missing;
};

const buildDisabledError = (source: DataSourceKey) => {
  const err = new AppError(`${source} disabled`, 503, source);
  (err as AppError & { code?: string }).code = DISABLED_SOURCE_CODE;
  return err;
};

const normalizeError = (error: AppError & { code?: string }, isFinalAttempt: boolean): { status: ApiHealthStatus; message: string; code?: string } => {
  if (error?.code === DISABLED_SOURCE_CODE) {
    return { status: "disabled", message: "Source disabled", code: DISABLED_SOURCE_CODE };
  }
  if (isCorsError(error)) {
    return { status: "warn", message: "CORS / Network blocked", code: "CORS" };
  }
  const statusCode = error?.status ?? (error as any)?.statusCode;
  if (statusCode === 401 || statusCode === 403) {
    return { status: "degraded", message: `HTTP ${statusCode} (auth/key)`, code: `HTTP_${statusCode}` };
  }
  if (error?.name === "AbortError") {
    return { status: isFinalAttempt ? "error" : "warn", message: "timeout", code: "TIMEOUT" };
  }
  const status: ApiHealthStatus = isFinalAttempt ? "error" : "warn";
  return { status, message: error?.message || "fetch failed", code: statusCode ? `HTTP_${statusCode}` : undefined };
};

const parseResponse = async (res: Response) => {
  if (!res.ok) {
    throw new AppError(`HTTP ${res.status}`, res.status);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
};

const notifySuccess = (sourceKey: DataSourceKey | null, serviceName?: string, onHealthUpdate?: SafeFetchOptions["onHealthUpdate"]) => {
  if (sourceKey) emitHealth(sourceKey, "ok");
  if (serviceName && onHealthUpdate) onHealthUpdate(serviceName, "ok");
};

type FailureContext = {
  attempt: number;
  retries: number;
  retryDelayMs: number;
  sourceKey: DataSourceKey | null;
  serviceName?: string;
  onHealthUpdate?: SafeFetchOptions["onHealthUpdate"];
  onLog?: SafeFetchOptions["onLog"];
  onToast?: SafeFetchOptions["onToast"];
  uiLevel: SafeFetchOptions["uiLevel"];
};

const handleFailure = async (
  error: AppError & { code?: string },
  ctx: FailureContext
): Promise<boolean> => {
  const { attempt, retries, retryDelayMs, sourceKey, serviceName, onHealthUpdate, onLog, onToast, uiLevel } = ctx;
  const isFinalAttempt = attempt >= retries;
  const normalized = normalizeError(error, isFinalAttempt);
  if (sourceKey) emitHealth(sourceKey, normalized.status as DataSourceStatus, normalized.message, normalized.code);
  if (serviceName && onHealthUpdate) onHealthUpdate(serviceName, normalized.status, normalized.message);
  const logLevel = normalized.status === "error" ? "error" : "warn";
  if (onLog) onLog(serviceName || sourceKey || "fetch", logLevel, normalized.message, { attempt, code: normalized.code });
  const shouldToast = uiLevel === "toast";
  if (normalized.status === "error" && onToast && isFinalAttempt && shouldToast) {
    onToast(`${serviceName || sourceKey || "service"}: ${normalized.message}`, "error");
  }
  const disabled = normalized.status === "disabled" || normalized.code === DISABLED_SOURCE_CODE;
  if (isFinalAttempt || disabled) return false;
  await wait(retryDelayMs * (attempt + 1));
  return true;
};

const ensureSourceEnabled = (
  sourceKey: DataSourceKey | null,
  serviceName?: string,
  onHealthUpdate?: SafeFetchOptions["onHealthUpdate"]
) => {
  if (!sourceKey) return;
  if (isSourceEnabled(sourceKey)) return;
  const disabledError = buildDisabledError(sourceKey);
  emitHealth(sourceKey, "disabled", "Source disabled", DISABLED_SOURCE_CODE);
  onHealthUpdate?.(serviceName || sourceKey, "disabled", "Source disabled");
  throw disabledError;
};

const activeAbortControllers = new Map<string, AbortController>();

export async function safeFetch<T>(input: RequestInfo | URL, init: SafeFetchOptions = {}): Promise<T> {
  const {
    retries = 0,
    retryDelayMs = 400,
    timeoutMs = 10000,
    onHealthUpdate,
    onLog,
    onToast,
    serviceName,
    uiLevel = "status",
    abortKey,
    signal: externalSignal,
    ...rest
  } = init;

  let lastErr: Error | null = null;
  let abortedByUser = false;
  const requestController = new AbortController();
  const onRequestAbort = () => {
    abortedByUser = true;
  };
  requestController.signal.addEventListener("abort", onRequestAbort);

  if (abortKey) {
    const prev = activeAbortControllers.get(abortKey);
    if (prev) prev.abort();
    activeAbortControllers.set(abortKey, requestController);
  }

  const abortFromExternal = () => {
    abortedByUser = true;
    requestController.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternal);
    }
  }

  const sourceKey = resolveSourceKey(serviceName, input);
  ensureSourceEnabled(sourceKey, serviceName, onHealthUpdate);
  const missingKeys = hasMissingKeys(sourceKey);
  if (missingKeys.length && sourceKey) {
    const msg = `API key missing (${missingKeys.join(", ")})`;
    emitHealth(sourceKey, "degraded", msg, "MISSING_KEY");
    onHealthUpdate?.(serviceName || sourceKey, "degraded", msg);
  }

  const shouldLogPerf = typeof process !== "undefined" && process?.env?.DEBUG_PERF === "true";
  const perfNow = typeof performance !== "undefined" && performance?.now ? () => performance.now() : () => Date.now();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (requestController.signal.aborted) break;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    requestController.signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = shouldLogPerf ? perfNow() : 0;
    try {
      const res = await fetch(input, { ...rest, signal: controller.signal });
      clearTimeout(timer);
      requestController.signal.removeEventListener("abort", onAbort);
      const data = (await parseResponse(res)) as T;
      if (shouldLogPerf) {
        const duration = perfNow() - start;
        if (duration > 1000) {
          console.warn("[perf] slow fetch", {
            service: serviceName || sourceKey || "fetch",
            url: toUrlString(input),
            ms: Math.round(duration),
            attempt,
          });
        }
      }
      notifySuccess(sourceKey, serviceName, onHealthUpdate);
      if (abortKey && activeAbortControllers.get(abortKey) === requestController) {
        activeAbortControllers.delete(abortKey);
      }
      requestController.signal.removeEventListener("abort", onRequestAbort);
      if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      requestController.signal.removeEventListener("abort", onAbort);
      if (shouldLogPerf) {
        const duration = perfNow() - start;
        if (duration > 1000) {
          console.warn("[perf] slow failure", {
            service: serviceName || sourceKey || "fetch",
            url: toUrlString(input),
            ms: Math.round(duration),
            attempt,
          });
        }
      }
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (abortedByUser) {
        break;
      }
      const shouldRetry = await handleFailure(lastErr as AppError & { code?: string }, {
        attempt,
        retries,
        retryDelayMs,
        sourceKey,
        serviceName,
        onHealthUpdate,
        onLog,
        onToast,
        uiLevel,
      });
      if (!shouldRetry) break;
    }
  }
  if (abortKey && activeAbortControllers.get(abortKey) === requestController) {
    activeAbortControllers.delete(abortKey);
  }
  requestController.signal.removeEventListener("abort", onRequestAbort);
  if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
  if (abortedByUser && !lastErr) {
    const abortErr = new AppError("AbortError");
    abortErr.name = "AbortError";
    throw abortErr;
  }
  throw lastErr || new Error("fetch failed");
}
