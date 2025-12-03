import { safeFetch, type SafeFetchOptions, type ApiHealthStatus } from "./safeFetch";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  provider?: string;
};

const MIN_POINTS = 5;
const inFlight = new Map<string, { ts: number; promise: Promise<Candle[]> }>();

const normalizeSeries = (rows: any[] = [], fallbackProvider = "proxy"): Candle[] =>
  rows.map((row) => ({
    time: Number(row.time ?? Math.floor((row.openTime ?? row.closeTime ?? Date.now()) / 1000)),
    open: Number(row.open ?? row.o ?? 0),
    high: Number(row.high ?? row.h ?? 0),
    low: Number(row.low ?? row.l ?? 0),
    close: Number(row.close ?? row.c ?? 0),
    volume: Number(row.volume ?? row.v ?? 0),
    provider: row.provider || fallbackProvider,
  }));

const hasEnoughData = (series: Candle[] | null | undefined) => Array.isArray(series) && series.length >= MIN_POINTS;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type OhlcApiResponse = {
  ok?: boolean;
  status?: "ok" | "upstream_error" | "timeout" | "invalid_params";
  error?: string | null;
  data?: Candle[] | null;
};

const fetchCandles = async (url: string, providerKey: string, options: SafeFetchOptions): Promise<Candle[]> => {
  const fetchOptions: SafeFetchOptions = {
    ...options,
    serviceName: options.serviceName ? `${options.serviceName}:${providerKey}` : providerKey,
  };
  const key = `${providerKey}:${url}`;
  const now = Date.now();
  const existing = inFlight.get(key);
  if (existing && now - existing.ts < 500) {
    return existing.promise;
  }

  const task = (async () => {
    try {
      const response = await safeFetch<OhlcApiResponse | Candle[]>(url, fetchOptions);
      const apiRes = response as OhlcApiResponse;
      const rows = Array.isArray(apiRes?.data) ? apiRes.data : (Array.isArray(response as any) ? (response as any) : []);
      const normalized = normalizeSeries(rows as any[], (response as any)?.provider || providerKey);
      if (apiRes?.ok === false || !hasEnoughData(normalized)) {
        const status = apiRes?.status || "upstream_error";
        const error = apiRes?.error || `${providerKey} unavailable`;
        const healthStatus: ApiHealthStatus = status === "timeout" ? "degraded" : "error";
        fetchOptions.onHealthUpdate?.(fetchOptions.serviceName || providerKey, healthStatus, error);
        return [];
      }
      return normalized;
    } catch (err: any) {
      fetchOptions.onHealthUpdate?.(
        fetchOptions.serviceName || providerKey,
        "degraded",
        err?.message || `${providerKey} failed`
      );
      fetchOptions.onLog?.(fetchOptions.serviceName || providerKey, "warn", err?.message || `${providerKey} failed`);
      return [];
    }
  })();

  inFlight.set(key, { ts: now, promise: task });
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
};

export type ChartLoadConfig = {
  pair?: string;
  binanceSymbol?: string;
  interval?: number;
  limit?: number;
};

export async function loadChart(
  { pair = "XXBTZUSD", binanceSymbol = "BTCUSDT", interval = 60, limit = 160 }: ChartLoadConfig,
  options: SafeFetchOptions = {}
): Promise<Candle[] | null> {
  if (!pair && !binanceSymbol) return null;
  const attempts = [
    {
      key: "kraken",
      url: `/api/kraken/ohlc?pair=${encodeURIComponent(pair)}&interval=${interval}&limit=${limit}`,
    },
    {
      key: "binance",
      url: `/api/binance/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${interval}&limit=${limit}`,
    },
    {
      key: "proxy",
      url: `/api/ohlc?pair=${encodeURIComponent(pair)}&binance=${encodeURIComponent(binanceSymbol)}&interval=${interval}&limit=${limit}`,
    },
  ];
  // Hedge requests: start primary, then fallbacks a few hundred ms later to avoid long sequential waits.
  const staggerMs = 350;
  const loaders = attempts.map((attempt, idx) =>
    delay(idx * staggerMs).then(async () => {
      const candles = await fetchCandles(attempt.url, attempt.key, options);
      if (hasEnoughData(candles)) return { provider: attempt.key, candles };
      if (import.meta.env.DEV) {
        console.warn(`[chartLoader] ${attempt.key} failed or returned insufficient data`);
      }
      throw new Error(`${attempt.key} unavailable`);
    })
  );

  try {
    const winner = await Promise.any(loaders);
    return winner.candles;
  } catch (aggregateErr) {
    if (import.meta.env.DEV) {
      console.warn("[chartLoader] all providers failed, using fallback", aggregateErr);
    }
  }
  // Last resort: return a synthetic fallback to keep charts rendering and avoid crashes
  return buildFallbackChart(Math.max(limit, MIN_POINTS));
}

export const buildFallbackChart = (length = 24): Candle[] => {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length }, (_, idx) => ({
    time: now - (length - idx) * 3600,
    open: 0,
    high: 0,
    low: 0,
    close: 0,
    volume: 0,
    provider: "fallback",
  }));
};

export const showFallbackChart = () => buildFallbackChart();
