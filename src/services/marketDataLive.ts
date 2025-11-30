import { safeFetch, AppError } from "../lib/safeFetch";
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

const mapKrakenSeries = (series: any[] = []): OhlcRow[] =>
  series.map((row) => {
    const [ts, open, high, low, close, , volume] = row;
    const date = new Date(Number(ts) * 1000);
    return {
      time: Number(ts),
      label: date.toISOString(),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    };
  });

const fetchKrakenHtf = async (pair: string, interval: number, onHealthUpdate?: HealthCb, onLog?: LogCb, onToast?: ToastCb) => {
  const res = await safeFetch<any>(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`, {
    serviceName: "MARKET_HTF_PRIMARY",
    timeoutMs: 10000,
    retries: 1,
    onHealthUpdate,
    onLog,
    onToast,
  });
  const key = Object.keys(res?.result || {}).find((k) => k !== "last");
  const series = res?.result?.[key] || [];
  return mapKrakenSeries(series);
};

const mapCoinApiSeries = (rows: any[] = []): OhlcRow[] =>
  rows.map((r) => ({
    time: r.time_period_start ? Date.parse(r.time_period_start) / 1000 : 0,
    label: r.time_period_start || "",
    open: Number(r.price_open),
    high: Number(r.price_high),
    low: Number(r.price_low),
    close: Number(r.price_close),
    volume: Number(r.volume_traded) || Number(r.volume) || 0,
  }));

const fetchCoinApiHtf = async (
  symbolId: string,
  periodId: string,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const apiKey = import.meta.env.VITE_COINAPI_KEY;
  if (!apiKey) throw new AppError("Missing CoinAPI key", 401, "MARKET_HTF_FALLBACK");
  const url = `https://rest.coinapi.io/v1/ohlcv/${symbolId}/history?period_id=${periodId}&limit=200&include_empty_items=false`;
  const res = await safeFetch<any>(url, {
    serviceName: "MARKET_HTF_FALLBACK",
    timeoutMs: 12000,
    retries: 1,
    headers: { "X-CoinAPI-Key": apiKey },
    onHealthUpdate,
    onLog,
    onToast,
  });
  return mapCoinApiSeries(res);
};

export const fetchHtfOhlc = async (
  pair: string,
  symbolId: string,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  try {
    const h4 = await fetchKrakenHtf(pair, 240, onHealthUpdate, onLog, onToast);
    const d1 = await fetchKrakenHtf(pair, 1440, onHealthUpdate, onLog, onToast);
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "ok");
    return { h4, d1 };
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    try {
      const h4 = await fetchCoinApiHtf(symbolId, "4HRS", onHealthUpdate, onLog, onToast);
      const d1 = await fetchCoinApiHtf(symbolId, "1DAY", onHealthUpdate, onLog, onToast);
      onHealthUpdate?.("MARKET_HTF_FALLBACK", "ok");
      return { h4, d1 };
    } catch (fallbackErr: any) {
      onHealthUpdate?.("MARKET_HTF_FALLBACK", "error", fallbackErr?.message || "fallback HTF failed");
      onLog?.("MARKET_HTF_FALLBACK", "error", fallbackErr?.message || "fallback HTF failed");
      return { h4: [], d1: [] };
    }
  }
};

export type HtfResult = Awaited<ReturnType<typeof fetchHtfOhlc>>;
