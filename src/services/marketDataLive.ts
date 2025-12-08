import { safeFetch } from "../lib/safeFetch";
import { getCachedUserTier } from "../firebase";
import type { ApiHealthStatus } from "../lib/safeFetch";
import { apiUrl } from "../lib/http";

type HealthCb = (service: string, status: ApiHealthStatus, message?: string) => void;
type LogCb = (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
type ToastCb = (message: string, type?: "warn" | "error" | "info") => void;

const toSeconds = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
};

type OhlcRow = {
  time: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const mapOhlcSeries = (rows: any[] = []): OhlcRow[] =>
  rows
    .filter((row) => row && (row.time || row.ts || row.closeTime || row.openTime))
    .map((row) => {
      const rawTs = Number(row.time ?? row.ts ?? row.closeTime ?? row.openTime ?? Date.now());
      const ts = toSeconds(rawTs);
      const date = new Date(ts * 1000);
      return {
        time: ts,
        label: date.toISOString(),
        open: Number(row.open ?? row.o ?? 0),
        high: Number(row.high ?? row.h ?? 0),
        low: Number(row.low ?? row.l ?? 0),
        close: Number(row.close ?? row.c ?? 0),
        volume: Number(row.volume ?? row.v ?? 0),
      };
    });

type OhlcApiResponse = {
  ok?: boolean;
  status?: "ok" | "upstream_error" | "timeout" | "invalid_params";
  error?: string | null;
  data?: any[] | null;
};

const toastCooldown = new Map<string, number>();
const shouldToast = (key: string, cooldownMs = 180000) => {
  const now = Date.now();
  const last = toastCooldown.get(key) || 0;
  if (now - last < cooldownMs) return false;
  toastCooldown.set(key, now);
  return true;
};

const fetchProxyHtf = async (
  pair: string,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  // FIX: Use the kraken OHLC proxy (with apiUrl) and accept both data/candles shapes.
  const url = apiUrl(`/api/kraken/ohlc?pair=${encodeURIComponent(pair)}&interval=${interval}&limit=240`);
  try {
    const res = await safeFetch<OhlcApiResponse | { candles?: any[]; data?: any[] } | any[]>(url, {
      serviceName: "MARKET_HTF_PRIMARY",
      timeoutMs: 10000,
      retries: 1,
      onHealthUpdate,
      onLog,
      onToast,
    });
    const apiRes = res as OhlcApiResponse & { candles?: any[]; data?: any[] };
    if (apiRes?.ok === false) {
      const status = apiRes.status || "upstream_error";
      const message = apiRes.error || "Price data temporarily unavailable";
      const healthStatus: ApiHealthStatus = status === "timeout" ? "warn" : "error";
      onHealthUpdate?.("MARKET_HTF_PRIMARY", healthStatus, message);
      if (shouldToast("MARKET_HTF_PRIMARY")) {
        onToast?.("Price data temporarily unavailable, retrying...", "warn");
      }
      return [];
    }
    const rows = Array.isArray(apiRes?.data)
      ? apiRes.data
      : Array.isArray(apiRes?.candles)
      ? apiRes.candles
      : Array.isArray(res)
      ? (res as any[])
      : [];
    if (!rows.length) {
      onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", "Empty OHLC response");
      return [];
    }
    return mapOhlcSeries(rows);
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    if (shouldToast("MARKET_HTF_PRIMARY")) {
      onToast?.("Price data temporarily unavailable, retrying...", "warn");
    }
    return [];
  }
};

const fetchProxyHtfFallback = async (
  pair: string,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const url = apiUrl(`/api/ohlc?pair=${encodeURIComponent(pair)}&interval=${interval}&limit=240`);
  try {
    const res = await safeFetch<OhlcApiResponse | { candles?: any[]; data?: any[] } | any[]>(url, {
      serviceName: "MARKET_HTF_FALLBACK",
      timeoutMs: 10000,
      retries: 1,
      onHealthUpdate,
      onLog,
      onToast,
    });
    const apiRes = res as OhlcApiResponse & { candles?: any[]; data?: any[] };
    if (apiRes?.ok === false) {
      const status = apiRes.status || "upstream_error";
      const message = apiRes.error || "Price data temporarily unavailable";
      const healthStatus: ApiHealthStatus = status === "timeout" ? "warn" : "error";
      onHealthUpdate?.("MARKET_HTF_FALLBACK", healthStatus, message);
      return [];
    }
    const rows = Array.isArray(apiRes?.data)
      ? apiRes.data
      : Array.isArray(apiRes?.candles)
      ? apiRes.candles
      : Array.isArray(res)
      ? (res as any[])
      : [];
    if (!rows.length) {
      onHealthUpdate?.("MARKET_HTF_FALLBACK", "warn", "Empty OHLC response");
      return [];
    }
    onHealthUpdate?.("MARKET_HTF_FALLBACK", "ok");
    return mapOhlcSeries(rows);
  } catch (err: any) {
    onLog?.("MARKET_HTF_FALLBACK", "warn", err?.message || "fallback HTF failed");
    onHealthUpdate?.("MARKET_HTF_FALLBACK", "warn", err?.message || "fallback HTF failed");
    return [];
  }
};

export const fetchHtfOhlc = async (
  pair: string,
  _symbolId: string,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const tier = getCachedUserTier();
  if (tier !== "pro" && tier !== "elite") {
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", "Tier required");
    return { h4: [], d1: [] };
  }
  try {
    const [h4Primary, d1Primary] = await Promise.all([
      fetchProxyHtf(pair, 240, onHealthUpdate, onLog, onToast),
      fetchProxyHtf(pair, 1440, onHealthUpdate, onLog, onToast),
    ]);

    const h4 = h4Primary?.length ? h4Primary : await fetchProxyHtfFallback(pair, 240, onHealthUpdate, onLog, onToast);
    const d1 = d1Primary?.length ? d1Primary : await fetchProxyHtfFallback(pair, 1440, onHealthUpdate, onLog, onToast);

    const hasDataPrimary: ApiHealthStatus = h4Primary?.length || d1Primary?.length ? "ok" : "warn";
    onHealthUpdate?.("MARKET_HTF_PRIMARY", hasDataPrimary, hasDataPrimary === "ok" ? "" : "HTF data empty");
    const hasDataFallback: ApiHealthStatus = h4?.length || d1?.length ? "ok" : "warn";
    onHealthUpdate?.("MARKET_HTF_FALLBACK", hasDataFallback, hasDataFallback === "ok" ? "" : "HTF fallback used");
    return { h4, d1 };
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "error", err?.message || "primary HTF failed");
    if (shouldToast("MARKET_HTF_PRIMARY")) {
      onToast?.("Price data temporarily unavailable, retrying...", "warn");
    }
    return { h4: [], d1: [] };
  }
};

export type HtfResult = Awaited<ReturnType<typeof fetchHtfOhlc>>;
// NOTE: Removed unused binanceSymbol parameter to fix TS6133 without changing behavior.
