import { safeFetch, type SafeFetchOptions } from "./safeFetch";

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

const fetchCandles = async (url: string, providerKey: string, options: SafeFetchOptions): Promise<Candle[]> => {
  const fetchOptions: SafeFetchOptions = {
    ...options,
    serviceName: options.serviceName ? `${options.serviceName}:${providerKey}` : providerKey,
  };
  const response = await safeFetch<{ data?: Candle[]; error?: string } | Candle[]>(url, fetchOptions);
  if ((response as any)?.error) throw new Error((response as any).error);
  const rows = Array.isArray((response as any)?.data) ? (response as any).data : response;
  const normalized = normalizeSeries(rows as any[], providerKey);
  if (!hasEnoughData(normalized)) {
    throw new Error(`${providerKey} returned insufficient data`);
  }
  return normalized;
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
  for (const attempt of attempts) {
    try {
      const candles = await fetchCandles(attempt.url, attempt.key, options);
      if (hasEnoughData(candles)) {
        return candles;
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[chartLoader] ${attempt.key} failed`, err);
      }
    }
  }
  return null;
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
