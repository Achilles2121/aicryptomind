/**
 * Yahoo Finance Unified Data Service
 * Vision AI Mind - Vision AI Mind
 * 
 * Provides OHLC data and current prices for supported crypto assets only.
 */

import supportedCoins from "../../src/config/supportedCoins.js";

// ============================================
// TYPES
// ============================================

export interface OHLCCandle {
  t: number;        // timestamp in ms
  o: number;        // open
  h: number;        // high
  l: number;        // low
  c: number;        // close
  v: number;        // volume
  time: number;     // alias for t
  open: number;     // alias for o
  high: number;     // alias for h
  low: number;      // alias for l
  close: number;    // alias for c
  volume: number;   // alias for v
  provider: string;
}

export interface PriceData {
  asset: string;
  symbol: string;
  price: number;
  change24h: number | null;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  timestamp: number;
  provider: string;
}

export interface YahooChartResult {
  candles: OHLCCandle[];
  currentPrice: number;
  previousClose: number | null;
  provider: string;
}

// ============================================
// SYMBOL MAPPING
// ============================================

const normalizeSymbol = (value: string): string =>
  value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");

/**
 * Maps internal asset symbols to Yahoo Finance symbols
 */
export const SYMBOL_MAP: Record<string, string> = supportedCoins.reduce((acc, coin) => {
  const symbol = normalizeSymbol(coin.symbol);
  if (!symbol || acc[symbol]) return acc;
  const yahooSymbol = `${symbol}-USD`;
  acc[symbol] = yahooSymbol;
  acc[`${symbol}USD`] = yahooSymbol;
  acc[`${symbol}USDT`] = yahooSymbol;
  return acc;
}, {} as Record<string, string>);

/**
 * Maps interval in minutes to Yahoo Finance interval strings
 */
export const INTERVAL_MAP: Record<number, string> = {
  1: "1m",
  5: "5m",
  15: "15m",
  30: "30m",
  60: "1h",
  240: "1h",  // Yahoo doesn't have 4h, use 1h
  1440: "1d",
  10080: "1wk",
};

/**
 * Maps interval to appropriate range for Yahoo Finance
 */
const getRangeForInterval = (intervalMinutes: number, _limit: number): string => {
  // Calculate range based on interval - limit parameter reserved for future use
  
  if (intervalMinutes <= 5) return "1d";
  if (intervalMinutes <= 15) return "5d";
  if (intervalMinutes <= 60) return "1mo";
  if (intervalMinutes <= 240) return "3mo";
  if (intervalMinutes <= 1440) return "1y";
  return "5y";
};

// ============================================
// FETCH UTILITIES
// ============================================

async function safeFetch<T>(url: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 8000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================
// YAHOO FINANCE API
// ============================================

interface YahooQuote {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        currency?: string;
        symbol?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code?: string;
      description?: string;
    };
  };
}

/**
 * Fetches OHLC data and current price from Yahoo Finance
 */
export async function fetchYahooChart(
  asset: string,
  intervalMinutes: number = 60,
  limit: number = 100
): Promise<YahooChartResult> {
  // Normalize asset symbol
  const normalizedAsset = asset.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  const yahooSymbol = SYMBOL_MAP[normalizedAsset] || asset;
  
  // Map interval
  const interval = INTERVAL_MAP[intervalMinutes] || "1h";
  const range = getRangeForInterval(intervalMinutes, limit);
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;
  
  const data = await safeFetch<YahooQuote>(url, { timeoutMs: 8000 });
  
  if (data.chart?.error) {
    throw new Error(`Yahoo Finance error: ${data.chart.error.description || data.chart.error.code}`);
  }
  
  const result = data.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data returned for symbol: ${yahooSymbol}`);
  }
  
  const meta = result.meta;
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0];
  
  if (!quote || !timestamps.length) {
    throw new Error(`Invalid chart data for symbol: ${yahooSymbol}`);
  }
  
  const candles: OHLCCandle[] = [];
  
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i] * 1000; // Convert to ms
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];
    
    // Skip null/invalid candles
    if (o == null || h == null || l == null || c == null) continue;
    
    candles.push({
      t,
      o,
      h,
      l,
      c,
      v: v || 0,
      time: t,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v || 0,
      provider: "yahoo",
    });
  }
  
  // Limit to requested number of candles
  const limitedCandles = candles.slice(-limit);
  
  return {
    candles: limitedCandles,
    currentPrice: meta?.regularMarketPrice || limitedCandles[limitedCandles.length - 1]?.c || 0,
    previousClose: meta?.previousClose || null,
    provider: "yahoo",
  };
}

/**
 * Fetches current price with 24h stats from Yahoo Finance
 */
export async function fetchYahooPrice(asset: string): Promise<PriceData> {
  // Normalize asset symbol
  const normalizedAsset = asset.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  const yahooSymbol = SYMBOL_MAP[normalizedAsset] || asset;
  
  // Use 1d interval with 2d range to get previous close
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
  
  const data = await safeFetch<YahooQuote>(url, { timeoutMs: 6000 });
  
  if (data.chart?.error) {
    throw new Error(`Yahoo Finance error: ${data.chart.error.description || data.chart.error.code}`);
  }
  
  const result = data.chart?.result?.[0];
  if (!result?.meta) {
    throw new Error(`No data returned for symbol: ${yahooSymbol}`);
  }
  
  const meta = result.meta;
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp || [];
  
  const currentPrice = meta.regularMarketPrice || 0;
  const previousClose = meta.previousClose || null;
  
  // Calculate 24h change
  let change24h: number | null = null;
  let changePercent24h: number | null = null;
  let high24h: number | null = null;
  let low24h: number | null = null;
  let volume24h: number | null = null;
  
  if (previousClose && currentPrice) {
    change24h = currentPrice - previousClose;
    changePercent24h = (change24h / previousClose) * 100;
  }
  
  // Get today's high/low/volume
  if (quote && timestamps.length > 0) {
    const lastIdx = timestamps.length - 1;
    high24h = quote.high?.[lastIdx] || null;
    low24h = quote.low?.[lastIdx] || null;
    volume24h = quote.volume?.[lastIdx] || null;
  }
  
  return {
    asset: normalizedAsset,
    symbol: yahooSymbol,
    price: currentPrice,
    change24h,
    changePercent24h,
    high24h,
    low24h,
    volume24h,
    timestamp: Date.now(),
    provider: "yahoo",
  };
}

/**
 * Checks if an asset is supported by Yahoo Finance
 */
export function isYahooSupported(asset: string): boolean {
  const normalizedAsset = asset.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  return normalizedAsset in SYMBOL_MAP;
}

/**
 * Gets the Yahoo symbol for an asset
 */
export function getYahooSymbol(asset: string): string {
  const normalizedAsset = asset.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  return SYMBOL_MAP[normalizedAsset] || asset;
}

/**
 * Asset category detection
 */
export function getAssetCategory(asset: string): "crypto" | "unknown" {
  const normalizedAsset = normalizeSymbol(asset);
  if (SYMBOL_MAP[normalizedAsset]) return "crypto";
  const stripped = normalizedAsset.replace(/USDT?$/, "").replace(/USD$/, "");
  return SYMBOL_MAP[stripped] ? "crypto" : "unknown";
}

