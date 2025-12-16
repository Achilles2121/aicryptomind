/**
 * Unified Price API Endpoint
 * Vision AI Mind - Elite Trader
 * 
 * Supports ALL assets via Yahoo Finance:
 * - Crypto: BTC, ETH, SOL, etc.
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

// ============================================
// YAHOO FINANCE SYMBOL MAPPING
// ============================================

const YAHOO_SYMBOLS: Record<string, string> = {
  // Crypto
  BTC: "BTC-USD", BTCUSD: "BTC-USD", BTCUSDT: "BTC-USD",
  ETH: "ETH-USD", ETHUSD: "ETH-USD", ETHUSDT: "ETH-USD",
  SOL: "SOL-USD", SOLUSD: "SOL-USD",
  XRP: "XRP-USD", DOGE: "DOGE-USD",
  ADA: "ADA-USD", DOT: "DOT-USD",
  AVAX: "AVAX-USD", MATIC: "MATIC-USD",
  LINK: "LINK-USD", UNI: "UNI-USD", LTC: "LTC-USD",
  
  // Forex
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X", USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X", USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X", EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X", GBPJPY: "GBPJPY=X",
  
  // Indices
  SPX: "^GSPC", SP500: "^GSPC",
  DAX: "^GDAXI", NASDAQ: "^IXIC",
  NDX: "^NDX", DJI: "^DJI", DOW: "^DJI",
  NIKKEI: "^N225", FTSE: "^FTSE",
  CAC40: "^FCHI", STOXX50: "^STOXX50E",
  
  // Commodities
  GOLD: "GC=F", XAUUSD: "GC=F",
  SILVER: "SI=F", XAGUSD: "SI=F",
  OIL: "CL=F", WTI: "CL=F", BRENT: "BZ=F",
  NATGAS: "NG=F", COPPER: "HG=F",
};

function getAssetCategory(asset: string): string {
  const norm = asset.toUpperCase();
  if (["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI", "LTC"].some(c => norm.includes(c))) return "crypto";
  if (["EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"].some(c => norm.includes(c))) return "forex";
  if (["SPX", "SP500", "DAX", "NASDAQ", "NDX", "DJI", "DOW", "NIKKEI", "FTSE", "CAC", "STOXX"].some(c => norm.includes(c))) return "index";
  if (["GOLD", "XAU", "SILVER", "XAG", "OIL", "CL", "GC", "SI", "NG", "BRENT", "COPPER"].some(c => norm.includes(c))) return "commodity";
  return "unknown";
}

// ============================================
// CACHE (30 seconds)
// ============================================

interface CacheEntry {
  data: PriceData;
  expires: number;
}

interface PriceData {
  asset: string;
  price: number;
  change24h: number | null;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  timestamp: number;
  provider: string;
  category: string;
}

const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000;

function getCached(key: string): PriceData | null {
  const entry = priceCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  priceCache.delete(key);
  return null;
}

function setCache(key: string, data: PriceData): PriceData {
  priceCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// ============================================
// RATE LIMITING
// ============================================

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 300;

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
// YAHOO FINANCE PRICE FETCHER
// ============================================

async function fetchYahooPrice(asset: string): Promise<PriceData> {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const yahooSymbol = YAHOO_SYMBOLS[normalized];
  
  if (!yahooSymbol) {
    throw new Error(`Unsupported asset: ${asset}`);
  }
  
  const encodedSymbol = encodeURIComponent(yahooSymbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1d&range=2d`;
  
  interface YahooResponse {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          regularMarketDayHigh?: number;
          regularMarketDayLow?: number;
          regularMarketVolume?: number;
        };
      }>;
      error?: { description?: string };
    };
  }
  
  const data = await safeFetch<YahooResponse>(url, { timeoutMs: 4000 });
  
  if (data.chart?.error) {
    throw new Error(data.chart.error.description || "Yahoo API error");
  }
  
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) {
    throw new Error("No Yahoo price data");
  }
  
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose || price;
  const change24h = price - prevClose;
  const changePercent24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  
  return {
    asset: normalized,
    price,
    change24h,
    changePercent24h,
    high24h: meta.regularMarketDayHigh || null,
    low24h: meta.regularMarketDayLow || null,
    volume24h: meta.regularMarketVolume || null,
    timestamp: Date.now(),
    provider: "yahoo",
    category: getAssetCategory(normalized),
  };
}

// ============================================
// BINANCE FALLBACK (CRYPTO)
// ============================================

async function fetchBinancePrice(asset: string): Promise<PriceData> {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let pair = normalized;
  if (pair === "BTC" || pair === "BTCUSD") pair = "BTCUSDT";
  else if (pair === "ETH" || pair === "ETHUSD") pair = "ETHUSDT";
  else if (pair === "SOL" || pair === "SOLUSD") pair = "SOLUSDT";
  else if (!pair.endsWith("USDT")) pair = pair + "USDT";
  
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
  const data = await safeFetch<{
    lastPrice?: string;
    priceChange?: string;
    priceChangePercent?: string;
    highPrice?: string;
    lowPrice?: string;
    volume?: string;
  }>(url, { timeoutMs: 3000 });
  
  const price = Number(data.lastPrice);
  if (!Number.isFinite(price)) {
    throw new Error("Invalid Binance price");
  }
  
  return {
    asset: normalized,
    price,
    change24h: Number(data.priceChange) || null,
    changePercent24h: Number(data.priceChangePercent) || null,
    high24h: Number(data.highPrice) || null,
    low24h: Number(data.lowPrice) || null,
    volume24h: Number(data.volume) || null,
    timestamp: Date.now(),
    provider: "binance",
    category: "crypto",
  };
}

// ============================================
// UTILITY
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
  // CORS
  res.setHeader?.("Access-Control-Allow-Origin", "*");
  res.setHeader?.("Access-Control-Allow-Methods", "GET, OPTIONS");
  
  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }
  
  try {
    const assetParam = getQueryParam(req.query, "asset")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") ||
                       getQueryParam(req.query, "symbol")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") ||
                       "BTCUSD";
    
    // Rate limiting
    const clientKey = req.headers?.["x-forwarded-for"] ?? "anon";
    if (isRateLimited(`price:${clientKey}`)) {
      return res.status(429).json({
        ok: false,
        status: "rate_limited",
        error: "Rate limited. Please slow down.",
      });
    }
    
    // Check cache
    const cached = getCached(assetParam);
    if (cached) {
      return res.status(200).json({
        ok: true,
        status: "ok",
        data: cached,
        cached: true,
      });
    }
    
    const category = getAssetCategory(assetParam);
    let result: PriceData | null = null;
    let lastError: Error | null = null;
    
    // Check if Yahoo supports this asset
    const isYahooSupported = !!YAHOO_SYMBOLS[assetParam];
    
    // Try Yahoo Finance first
    if (isYahooSupported) {
      try {
        result = await fetchYahooPrice(assetParam);
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Yahoo failed for ${assetParam}:`, (err as Error).message);
      }
    }
    
    // Crypto fallback: Binance
    if (!result && category === "crypto") {
      try {
        result = await fetchBinancePrice(assetParam);
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Binance failed for ${assetParam}:`, (err as Error).message);
      }
    }
    
    if (!result) {
      return res.status(502).json({
        ok: false,
        status: "error",
        error: lastError?.message || `Unable to fetch price for ${assetParam}`,
      });
    }
    
    // Cache and return
    setCache(assetParam, result);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: result,
      cached: false,
    });
    
  } catch (error) {
    console.error("[price] handler error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Internal server error",
    });
  }
}
