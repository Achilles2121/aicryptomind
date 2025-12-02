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

const fetchProxyHtf = async (
  pair: string,
  binanceSymbol: string,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const url = `/api/ohlc?pair=${encodeURIComponent(pair)}&binance=${encodeURIComponent(binanceSymbol)}&interval=${interval}&limit=240`;
  const res = await safeFetch<{ data?: any[] } | any[]>(url, {
    serviceName: "MARKET_HTF_PRIMARY",
    timeoutMs: 10000,
    retries: 1,
    onHealthUpdate,
    onLog,
    onToast,
  });
  const rows = Array.isArray((res as any)?.data) ? (res as any).data : (Array.isArray(res) ? res : []);
  return mapOhlcSeries(rows);
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
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "degraded", "Tier required");
    return { h4: [], d1: [] };
  }
  try {
    const h4 = await fetchProxyHtf(pair, symbolId, 240, onHealthUpdate, onLog, onToast);
    const d1 = await fetchProxyHtf(pair, symbolId, 1440, onHealthUpdate, onLog, onToast);
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "ok");
    return { h4, d1 };
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "error", err?.message || "primary HTF failed");
    return { h4: [], d1: [] };
  }
};

export type HtfResult = Awaited<ReturnType<typeof fetchHtfOhlc>>;
