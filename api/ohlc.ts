/**
 * Unified OHLC API Endpoint
 * Vision AI Mind - Vision AI Mind
 * 
 * Supports ALL assets via Yahoo Finance with fallbacks:
 * - Crypto: BTC, ETH, SOL, etc. (Binance/Kraken fallback)
 * - Forex: EUR/USD, GBP/USD, etc.
 * - Indices: S&P 500, DAX, NASDAQ, etc.
 * - Commodities: Gold, Silver, Oil, etc.
 */

// ============================================
// TYPES
// ============================================

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

type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  provider?: string;
};

// ============================================
// YAHOO FINANCE SYMBOL MAPPING (COMPREHENSIVE)
// ============================================

const YAHOO_SYMBOLS: Record<string, string> = {
  // Crypto
  BTC: "BTC-USD", BTCUSD: "BTC-USD", BTCUSDT: "BTC-USD",
  ETH: "ETH-USD", ETHUSD: "ETH-USD", ETHUSDT: "ETH-USD",
  SOL: "SOL-USD", SOLUSD: "SOL-USD", SOLUSDT: "SOL-USD",
  XRP: "XRP-USD", XRPUSD: "XRP-USD",
  DOGE: "DOGE-USD", DOGEUSD: "DOGE-USD",
  ADA: "ADA-USD", ADAUSD: "ADA-USD",
  DOT: "DOT-USD", DOTUSD: "DOT-USD",
  AVAX: "AVAX-USD", AVAXUSD: "AVAX-USD",
  MATIC: "MATIC-USD", MATICUSD: "MATIC-USD",
  LINK: "LINK-USD", LINKUSD: "LINK-USD",
  UNI: "UNI-USD", UNIUSD: "UNI-USD",
  LTC: "LTC-USD", LTCUSD: "LTC-USD",
  
  // Forex
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X",
  EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X",
  
  // Indices
  SPX: "^GSPC", SP500: "^GSPC", GSPC: "^GSPC",
  DAX: "^GDAXI", GDAXI: "^GDAXI",
  NASDAQ: "^IXIC", NDX: "^NDX", NDX100: "^NDX", IXIC: "^IXIC",
  DJI: "^DJI", DJIA: "^DJI", DOW: "^DJI",
  NIKKEI: "^N225", N225: "^N225",
  FTSE: "^FTSE", FTSE100: "^FTSE",
  CAC40: "^FCHI", FCHI: "^FCHI",
  STOXX50: "^STOXX50E",
  
  // Commodities
  GOLD: "GC=F", XAUUSD: "GC=F", GC: "GC=F",
  SILVER: "SI=F", XAGUSD: "SI=F", SI: "SI=F",
  OIL: "CL=F", CRUDEOIL: "CL=F", WTI: "CL=F", CL: "CL=F",
  BRENT: "BZ=F", BZ: "BZ=F",
  NATGAS: "NG=F", NG: "NG=F",
  COPPER: "HG=F", HG: "HG=F",
  PLATINUM: "PL=F", PL: "PL=F",
};

const INTERVAL_MAP: Record<number, { yahoo: string; range: string; binance: string }> = {
  1: { yahoo: "1m", range: "1d", binance: "1m" },
  5: { yahoo: "5m", range: "5d", binance: "5m" },
  15: { yahoo: "15m", range: "5d", binance: "15m" },
  60: { yahoo: "1h", range: "1mo", binance: "1h" },
  240: { yahoo: "1h", range: "3mo", binance: "4h" },
  1440: { yahoo: "1d", range: "6mo", binance: "1d" },
};

function getAssetCategory(asset: string): "crypto" | "forex" | "index" | "commodity" | "unknown" {
  const norm = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI", "LTC"].some(c => norm.includes(c))) return "crypto";
  if (["EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"].some(c => norm.includes(c))) return "forex";
  if (["SPX", "SP500", "DAX", "NASDAQ", "NDX", "DJI", "DOW", "NIKKEI", "FTSE", "CAC", "STOXX", "IXIC"].some(c => norm.includes(c))) return "index";
  if (["GOLD", "XAU", "SILVER", "XAG", "OIL", "CL", "GC", "SI", "NG", "BRENT", "COPPER", "PLATINUM"].some(c => norm.includes(c))) return "commodity";
  return "unknown";
}

// ============================================
// CACHE (60 seconds for fast updates)
// ============================================

const ohlcCache = new Map<string, { data: { candles: Candle[]; provider: string; currentPrice?: number }; expires: number }>();
const CACHE_TTL = 60000;

function getCached(key: string) {
  const entry = ohlcCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  ohlcCache.delete(key);
  return null;
}

function setCache(key: string, data: { candles: Candle[]; provider: string; currentPrice?: number }) {
  ohlcCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// ============================================
// RATE LIMITING (50ms - relaxed for serverless)
// ============================================

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 50; // Relaxed from 300ms - serverless has natural rate limiting

function isRateLimited(key: string): boolean {
  const last = rateLimitMap.get(key);
  const now = Date.now();
  if (last && now - last < RATE_LIMIT_MS) return true;
  rateLimitMap.set(key, now);
  return false;
}

// ============================================
// FETCH UTILITIES
// ============================================

async function safeFetch<T>(url: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
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
// YAHOO FINANCE FETCHER (PRIMARY - ALL ASSETS)
// ============================================

async function fetchYahooOHLC(asset: string, intervalMinutes: number, limit: number): Promise<{ candles: Candle[]; currentPrice: number }> {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const yahooSymbol = YAHOO_SYMBOLS[normalized];
  
  if (!yahooSymbol) {
    throw new Error(`Unsupported asset: ${asset}`);
  }
  
  const intervalConfig = INTERVAL_MAP[intervalMinutes] || INTERVAL_MAP[60];
  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=${intervalConfig.yahoo}&range=${intervalConfig.range}`;
  
  interface YahooResponse {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number };
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
      error?: { description?: string };
    };
  }
  
  const data = await safeFetch<YahooResponse>(url, { timeoutMs: 4000 });
  
  if (data.chart?.error) {
    throw new Error(data.chart.error.description || "Yahoo API error");
  }
  
  const result = data.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error("No Yahoo data available");
  }
  
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp;
  const currentPrice = result.meta?.regularMarketPrice || 0;
  
  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote?.open?.[i];
    const h = quote?.high?.[i];
    const l = quote?.low?.[i];
    const c = quote?.close?.[i];
    const v = quote?.volume?.[i];
    
    if (o == null || h == null || l == null || c == null) continue;
    
    const t = timestamps[i] * 1000;
    candles.push({
      t, o, h, l, c, v: v || 0,
      time: t, open: o, high: h, low: l, close: c, volume: v || 0,
      provider: "yahoo",
    });
  }
  
  return { candles: candles.slice(-limit), currentPrice };
}

// ============================================
// BINANCE FALLBACK (CRYPTO ONLY)
// ============================================

async function fetchBinance(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const pair = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  let mappedPair = pair;
  if (pair === "BTCUSD" || pair === "BTC") mappedPair = "BTCUSDT";
  else if (pair === "ETHUSD" || pair === "ETH") mappedPair = "ETHUSDT";
  else if (pair === "SOLUSD" || pair === "SOL") mappedPair = "SOLUSDT";
  else if (pair.endsWith("USD") && !pair.endsWith("USDT")) mappedPair = pair + "T";
  
  const url = `https://api.binance.com/api/v3/klines?symbol=${mappedPair}&interval=${interval}&limit=${limit}`;
  const data = await safeFetch<(number | string)[][]>(url, { timeoutMs: 3000 });
  
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

// ============================================
// KRAKEN FALLBACK (CRYPTO ONLY)
// ============================================

async function fetchKraken(symbol: string, intervalMinutes: number, limit: number): Promise<Candle[]> {
  const pair = symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  let mapped = pair;
  if (pair === "BTCUSDT" || pair === "BTCUSD" || pair === "BTC") mapped = "XBTUSD";
  else if (pair === "ETHUSDT" || pair === "ETHUSD" || pair === "ETH") mapped = "ETHUSD";
  
  const url = `https://api.kraken.com/0/public/OHLC?pair=${mapped}&interval=${intervalMinutes}`;
  const data = await safeFetch<{ result?: Record<string, unknown[]>; error?: string[] }>(url, { timeoutMs: 3200 });
  
  if (data.error?.length) {
    throw new Error(`Kraken: ${data.error.join(", ")}`);
  }
  
  const resultKey = Object.keys(data.result || {}).find(k => k !== "last");
  const ohlcData = resultKey ? data.result?.[resultKey] as (number | string)[][] : null;
  
  if (!Array.isArray(ohlcData)) {
    throw new Error("No Kraken OHLC data");
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

const mapInterval = (value: string | number | undefined) => {
  const minutes = Number.isFinite(Number(value)) ? Number(value) : 60;
  if (minutes >= 1440) return 1440;
  if (minutes >= 240) return 240;
  if (minutes >= 60) return 60;
  if (minutes >= 15) return 15;
  if (minutes >= 5) return 5;
  return 1;
};

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
  // CORS
  res.setHeader?.("Access-Control-Allow-Origin", "*");
  res.setHeader?.("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }
  
  try {
    // Parse parameters
    const assetParam = getQueryParam(req.query, "asset")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") || 
                       getQueryParam(req.query, "symbol")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") ||
                       getQueryParam(req.query, "pair")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") ||
                       "BTCUSD";
    const intervalParam = getQueryParam(req.query, "interval") || getQueryParam(req.query, "tf") || "60";
    const limitParam = getQueryParam(req.query, "limit") || "100";
    
    const intervalMinutes = mapInterval(intervalParam);
    const limit = Math.min(Math.max(Number(limitParam) || 100, 10), 500);
    const intervalConfig = INTERVAL_MAP[intervalMinutes] || INTERVAL_MAP[60];
    
    // Rate limiting
    const clientKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`ohlc:${clientKey}`)) {
      return res.status(429).json({
        ok: false,
        status: "rate_limited",
        error: "Rate limited. Please slow down.",
        data: [],
      });
    }
    
    // Check cache
    const cacheKey = `${assetParam}:${intervalMinutes}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "ok",
        data: cached.candles,
        meta: {
          symbol: assetParam,
          interval: intervalMinutes,
          provider: cached.provider,
          cached: true,
          count: cached.candles.length,
          category: getAssetCategory(assetParam),
        },
      });
    }
    
    const category = getAssetCategory(assetParam);
    let result: { candles: Candle[]; provider: string; currentPrice?: number } | null = null;
    let lastError: Error | null = null;
    
    // Check if Yahoo supports this asset
    const isYahooSupported = !!YAHOO_SYMBOLS[assetParam];
    
    // CRYPTO: Try Binance FIRST (faster ~380ms vs Yahoo ~660ms)
    if (category === "crypto") {
      // Try Binance first for crypto (fastest)
      try {
        const candles = await fetchBinance(assetParam, intervalConfig.binance, limit);
        if (candles.length >= 5) {
          result = { candles, provider: "binance", currentPrice: candles.at(-1)?.c };
        }
      } catch (err) {
        lastError = err as Error;
        console.log(`[ohlc] Binance failed for ${assetParam}:`, (err as Error).message);
      }
      
      // Fallback to Kraken if Binance failed
      if (!result) {
        try {
          const candles = await fetchKraken(assetParam, intervalMinutes, limit);
          if (candles.length >= 5) {
            result = { candles, provider: "kraken", currentPrice: candles.at(-1)?.c };
          }
        } catch (err) {
          lastError = err as Error;
          console.log(`[ohlc] Kraken failed for ${assetParam}:`, (err as Error).message);
        }
      }
      
      // Last resort: Yahoo for crypto
      if (!result && isYahooSupported) {
        try {
          const yahooResult = await fetchYahooOHLC(assetParam, intervalMinutes, limit);
          if (yahooResult.candles.length >= 5) {
            result = {
              candles: yahooResult.candles,
              provider: "yahoo",
              currentPrice: yahooResult.currentPrice,
            };
          }
        } catch (err) {
          lastError = err as Error;
          console.log(`[ohlc] Yahoo failed for ${assetParam}:`, (err as Error).message);
        }
      }
    } else {
      // NON-CRYPTO: Yahoo Finance is the only reliable source
      if (isYahooSupported) {
        try {
          const yahooResult = await fetchYahooOHLC(assetParam, intervalMinutes, limit);
          result = {
            candles: yahooResult.candles,
            provider: "yahoo",
            currentPrice: yahooResult.currentPrice,
          };
        } catch (err) {
          lastError = err as Error;
          console.log(`[ohlc] Yahoo failed for ${assetParam}:`, (err as Error).message);
        }
      }
    }
    
    // No data found
    if (!result || !result.candles.length) {
      return res.status(502).json({
        ok: false,
        status: "error",
        error: lastError?.message || `Unable to fetch OHLC data for ${assetParam}`,
        data: [],
        meta: { asset: assetParam, category },
      });
    }
    
    // Cache and return
    setCache(cacheKey, result);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: result.candles,
      meta: {
        symbol: assetParam,
        interval: intervalMinutes,
        provider: result.provider,
        cached: false,
        count: result.candles.length,
        currentPrice: result.currentPrice,
        category,
      },
    });
    
  } catch (error) {
    console.error("[ohlc] handler error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Internal server error",
      data: [],
    });
  }
}

