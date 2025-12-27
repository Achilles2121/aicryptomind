/**
 * Unified OHLC API Endpoint
 * Vision AI Mind - Vision AI Mind
 * 
 * Supports all assets via Yahoo Finance with fallbacks:
 * - Crypto: BTC, ETH, SOL, etc. (Binance/Kraken fallback)
 * - Forex: EUR/USD, GBP/USD, etc.
 * - Indices: S&P 500, DAX, NASDAQ, etc.
 * - Commodities: Gold, Silver, Oil, etc.
 */

import {
  fetchYahooChart,
  isYahooSupported,
  getAssetCategory,
  OHLCCandle,
} from "./_lib/yahooFinance";

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 500;

function isRateLimited(key: string): boolean {
  const last = rateLimitMap.get(key);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(key, now);
  return false;
}

// ============================================
// CACHE
// ============================================

interface CacheEntry {
  data: { candles: OHLCCandle[]; provider: string; currentPrice?: number };
  expires: number;
}

const ohlcCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60000; // 1 minute

function getCached(key: string): CacheEntry["data"] | null {
  const entry = ohlcCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  ohlcCache.delete(key);
  return null;
}

function setCache(key: string, data: CacheEntry["data"]): CacheEntry["data"] {
  ohlcCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// ============================================
// SAFE FETCH UTILITY
// ============================================

async function safeFetch<T>(url: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 6000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ============================================
// FALLBACK PROVIDERS
// ============================================

// Binance fallback for crypto
async function fetchBinanceOHLC(symbol: string, interval: string, limit: number): Promise<OHLCCandle[]> {
  const pair = symbol.replaceAll(/[^A-Z0-9]/g, "").toUpperCase();
  let mappedPair = pair;
  if (pair === "BTCUSD") mappedPair = "BTCUSDT";
  else if (pair === "ETHUSD") mappedPair = "ETHUSDT";
  else if (pair.endsWith("USD")) mappedPair = `${pair}T`;
  
  const url = `https://api.binance.com/api/v3/klines?symbol=${mappedPair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 4000 });
  
  return data.map((row) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[5]),
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    provider: "binance",
  }));
}

// Kraken fallback for crypto
async function fetchKrakenOHLC(symbol: string, intervalMinutes: number, limit: number): Promise<OHLCCandle[]> {
  const pair = symbol.replaceAll(/[^A-Z0-9]/g, "").toUpperCase();
  let mapped = pair;
  if (pair === "BTCUSDT" || pair === "BTCUSD") mapped = "XBTUSD";
  else if (pair === "ETHUSDT" || pair === "ETHUSD") mapped = "ETHUSD";
  
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${intervalMinutes}`;
  const data = await safeFetch<{ result?: Record<string, unknown[]>; error?: string[] }>(url, { timeoutMs: 4000 });
  
  if (data.error?.length) {
    throw new Error(`Kraken error: ${data.error.join(", ")}`);
  }
  
  const resultKey = Object.keys(data.result || {}).find(k => k !== "last");
  const ohlcData = resultKey ? data.result?.[resultKey] as (number | string)[][] : null;
  
  if (!Array.isArray(ohlcData)) {
    throw new TypeError("No Kraken OHLC data");
  }
  
  return ohlcData.slice(-limit).map((row) => ({
    t: Number(row[0]) * 1000,
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: Number(row[6]),
    time: Number(row[0]) * 1000,
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[6]),
    provider: "kraken",
  }));
}

// CoinGecko fallback for crypto (limited data)
async function fetchCoinGeckoOHLC(symbol: string, limit: number): Promise<OHLCCandle[]> {
  const coinMap: Record<string, string> = {
    BTC: "bitcoin", BTCUSD: "bitcoin", BTCUSDT: "bitcoin",
    ETH: "ethereum", ETHUSD: "ethereum", ETHUSDT: "ethereum",
    SOL: "solana", SOLUSD: "solana", XRP: "ripple",
    DOGE: "dogecoin", ADA: "cardano", DOT: "polkadot",
  };
  
  const normalizedSymbol = symbol.replaceAll(/[^A-Z0-9]/g, "").toUpperCase();
  const coinId = coinMap[normalizedSymbol] || "bitcoin";
  
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=7`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 4000 });
  
  return data.slice(-limit).map((row) => ({
    t: Number(row[0]),
    o: Number(row[1]),
    h: Number(row[2]),
    l: Number(row[3]),
    c: Number(row[4]),
    v: 0,
    time: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: 0,
    provider: "coingecko",
  }));
}

// ============================================
// INTERVAL MAPPING
// ============================================

const mapInterval = (value: string | number | undefined): { minutes: number; binance: string; kraken: number } => {
  const minutes = Number.isFinite(Number(value)) ? Number(value) : 60;
  if (minutes >= 1440) return { minutes: 1440, binance: "1d", kraken: 1440 };
  if (minutes >= 240) return { minutes: 240, binance: "4h", kraken: 240 };
  if (minutes >= 60) return { minutes: 60, binance: "1h", kraken: 60 };
  if (minutes >= 15) return { minutes: 15, binance: "15m", kraken: 15 };
  if (minutes >= 5) return { minutes: 5, binance: "5m", kraken: 5 };
  return { minutes: 1, binance: "1m", kraken: 1 };
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: Req, res: Res) {
  // CORS headers
  res.setHeader?.("Access-Control-Allow-Origin", "*");
  res.setHeader?.("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader?.("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }
  
  try {
    // Parse parameters
    const assetParam = getQueryParam(req.query, "asset")?.toUpperCase()?.replaceAll(/[^A-Z0-9]/g, "") || 
                       getQueryParam(req.query, "symbol")?.toUpperCase()?.replaceAll(/[^A-Z0-9]/g, "") ||
                       "BTCUSD";
    const intervalParam = getQueryParam(req.query, "interval") || getQueryParam(req.query, "tf") || "60";
    const limitParam = getQueryParam(req.query, "limit") || "100";
    
    const interval = mapInterval(intervalParam);
    const limit = Math.min(Math.max(Number(limitParam) || 100, 10), 500);
    
    // Rate limiting
    const clientKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`ohlc:${clientKey}`)) {
      return res.status(429).json({
        ok: false,
        status: "rate_limited",
        error: "Rate limited. Please slow down.",
      });
    }
    
    // Check cache
    const cacheKey = `${assetParam}:${interval.minutes}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "ok",
        cached: true,
        data: {
          asset: assetParam,
          interval: interval.minutes,
          candles: cached.candles,
          currentPrice: cached.currentPrice,
          count: cached.candles.length,
          provider: cached.provider,
        },
      });
    }
    
    const category = getAssetCategory(assetParam);
    let result: { candles: OHLCCandle[]; provider: string; currentPrice?: number } | null = null;
    let lastError: Error | null = null;
    
    // Try Yahoo Finance first (works for all asset types)
    if (isYahooSupported(assetParam)) {
      try {
        const yahooResult = await fetchYahooChart(assetParam, interval.minutes, limit);
        result = {
          candles: yahooResult.candles,
          provider: yahooResult.provider,
          currentPrice: yahooResult.currentPrice,
        };
      } catch (err) {
        lastError = err as Error;
        console.log(`[ohlc] Yahoo failed for ${assetParam}:`, (err as Error).message);
      }
    }
    
    // Crypto fallbacks
    if (!result && category === "crypto") {
      // Try Binance
      try {
        const candles = await fetchBinanceOHLC(assetParam, interval.binance, limit);
        result = { candles, provider: "binance", currentPrice: candles.at(-1)?.c };
      } catch (err) {
        lastError = err as Error;
        console.log(`[ohlc] Binance failed for ${assetParam}:`, (err as Error).message);
      }
      
      // Try Kraken
      if (!result) {
        try {
          const candles = await fetchKrakenOHLC(assetParam, interval.kraken, limit);
          result = { candles, provider: "kraken", currentPrice: candles.at(-1)?.c };
        } catch (err) {
          lastError = err as Error;
          console.log(`[ohlc] Kraken failed for ${assetParam}:`, (err as Error).message);
        }
      }
      
      // Try CoinGecko
      if (!result) {
        try {
          const candles = await fetchCoinGeckoOHLC(assetParam, limit);
          result = { candles, provider: "coingecko", currentPrice: candles.at(-1)?.c };
        } catch (err) {
          lastError = err as Error;
          console.log(`[ohlc] CoinGecko failed for ${assetParam}:`, (err as Error).message);
        }
      }
    }
    
    if (!result || !result.candles.length) {
      return res.status(502).json({
        ok: false,
        status: "error",
        error: lastError?.message || `Unable to fetch OHLC data for ${assetParam}`,
        asset: assetParam,
        category,
      });
    }
    
    // Cache and return
    setCache(cacheKey, result);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: {
        asset: assetParam,
        interval: interval.minutes,
        candles: result.candles,
        currentPrice: result.currentPrice,
        count: result.candles.length,
        provider: result.provider,
        category,
      },
    });
    
  } catch (error) {
    console.error("[ohlc] handler error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Internal server error",
    });
  }
}

