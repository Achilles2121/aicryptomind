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
  const response = await safeFetch<{ ok?: boolean; status?: string; data?: Candle[]; error?: string } | Candle[]>(url, fetchOptions);
  if ((response as any)?.ok === false) {
    return [];
  }
  if ((response as any)?.error) throw new Error((response as any).error);
  const rows = Array.isArray((response as any)?.data) ? (response as any).data : response;
  const normalized = normalizeSeries(rows as any[], providerKey);
  if (!hasEnoughData(normalized)) {
    throw new Error(`${providerKey} returned insufficient data`);
  }
  return normalized;
};

export type ChartLoadConfig = {
  assetId?: string;
  pair?: string;
  binanceSymbol?: string;
  interval?: number;
  limit?: number;
};

export async function loadChart(
  { assetId, pair = "XXBTZUSD", binanceSymbol = "BTCUSDT", interval = 60, limit = 80 }: ChartLoadConfig,
  options: SafeFetchOptions = {}
): Promise<Candle[] | null> {
  // Use consolidated /api/ohlc endpoint which has Binance/Kraken/CoinGecko fallback built-in
  const asset = assetId || pair?.replace(/^X+|Z+/g, "").replace("USD", "") || binanceSymbol?.replace("USDT", "") || "BTC";
  const url = `/api/ohlc?asset=${encodeURIComponent(asset)}&interval=${interval}&limit=${limit}`;
  
  try {
    const candles = await fetchCandles(url, "ohlc", options);
    if (hasEnoughData(candles)) {
      return candles;
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[chartLoader] ohlc failed`, err);
    }
  }
  return null;
}

/**
 * Build realistic-looking fallback chart data with synthetic candles.
 * Generates a random walk so indicators like RSI/MACD can still calculate values.
 * @param length Number of candles to generate
 * @param basePrice Starting price (default 100 for neutral display)
 * @param volatility Price movement factor (0.01 = 1% max move per candle)
 */
export const buildFallbackChart = (length = 24, basePrice = 100, volatility = 0.01): Candle[] => {
  const now = Math.floor(Date.now() / 1000);
  let price = basePrice;
  const candles: Candle[] = [];

  for (let idx = 0; idx < length; idx++) {
    // Random walk: each candle moves within ±volatility range
    const changePercent = (Math.random() - 0.5) * 2 * volatility;
    const open = price;
    const close = price * (1 + changePercent);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.round(1000 + Math.random() * 9000); // 1k-10k volume range

    candles.push({
      time: now - (length - idx) * 3600,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
      provider: "fallback",
    });

    price = close; // Next candle starts at previous close
  }

  return candles;
};

export const showFallbackChart = () => buildFallbackChart();
