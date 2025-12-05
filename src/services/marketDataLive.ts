import { safeFetch } from "../lib/safeFetch";
import { getCachedUserTier } from "../firebase";
import type { ApiHealthStatus } from "../lib/safeFetch";

type HealthCb = (service: string, status: ApiHealthStatus, message?: string) => void;
type LogCb = (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
type ToastCb = (message: string, type?: "warn" | "error" | "info") => void;

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
    .filter((row) => row && (row.time || row.ts || row.closeTime))
    .map((row) => {
      const ts = Number(row.time ?? Math.floor((row.openTime ?? row.closeTime ?? Date.now()) / 1000));
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
  binanceSymbol: string,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const url = `/api/ohlc?pair=${encodeURIComponent(pair)}&binance=${encodeURIComponent(binanceSymbol)}&interval=${interval}&limit=240`;
  try {
    const res = await safeFetch<OhlcApiResponse | any[]>(url, {
      serviceName: "MARKET_HTF_PRIMARY",
      timeoutMs: 10000,
      retries: 1,
      onHealthUpdate,
      onLog,
      onToast,
    });
    const apiRes = res as OhlcApiResponse;
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
    const rows = Array.isArray(apiRes?.data) ? apiRes.data : (Array.isArray(res) ? res : []);
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

export const fetchHtfOhlc = async (
  pair: string,
  symbolId: string,
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
    const [h4, d1] = await Promise.all([
      fetchProxyHtf(pair, symbolId, 240, onHealthUpdate, onLog, onToast),
      fetchProxyHtf(pair, symbolId, 1440, onHealthUpdate, onLog, onToast),
    ]);
    const hasData: ApiHealthStatus = h4?.length || d1?.length ? "ok" : "warn";
    onHealthUpdate?.("MARKET_HTF_PRIMARY", hasData, hasData === "ok" ? "" : "HTF data empty");
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
