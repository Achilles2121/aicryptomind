/**
 * Unified Price API Endpoint
 * Vision AI Mind - Vision AI Mind
 * 
 * Supports all assets via Yahoo Finance with fallbacks:
 * - Crypto: BTC, ETH, SOL, etc. (CoinGecko fallback)
 * - Forex: EUR/USD, GBP/USD, etc.
 * - Indices: S&P 500, DAX, NASDAQ, etc.
 * - Commodities: Gold, Silver, Oil, etc.
 */

import {
  fetchYahooPrice,
  isYahooSupported,
  getAssetCategory,
  PriceData,
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
  data: PriceData;
  expires: number;
}

const priceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

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
// SAFE FETCH UTILITY
// ============================================

async function safeFetch<T>(url: string, options?: { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);
  
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

// CoinGecko fallback for crypto
async function fetchCryptoFromCoinGecko(asset: string): Promise<PriceData> {
  const coinMap: Record<string, string> = {
    BTC: "bitcoin",
    BTCUSD: "bitcoin",
    BTCUSDT: "bitcoin",
    ETH: "ethereum",
    ETHUSD: "ethereum",
    ETHUSDT: "ethereum",
    SOL: "solana",
    SOLUSD: "solana",
    XRP: "ripple",
    DOGE: "dogecoin",
    ADA: "cardano",
    DOT: "polkadot",
    AVAX: "avalanche-2",
    MATIC: "matic-network",
    LINK: "chainlink",
  };
  
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const coinId = coinMap[normalizedAsset] || "bitcoin";
  
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
  const data = await safeFetch<Record<string, { usd?: number; usd_24h_change?: number; usd_24h_vol?: number }>>(url, { timeoutMs: 5000 });
  
  const coinData = data[coinId];
  if (!coinData?.usd) throw new Error(`CoinGecko: No price for ${coinId}`);
  
  return {
    asset: normalizedAsset,
    symbol: coinId,
    price: coinData.usd,
    change24h: null,
    changePercent24h: coinData.usd_24h_change || null,
    high24h: null,
    low24h: null,
    volume24h: coinData.usd_24h_vol || null,
    timestamp: Date.now(),
    provider: "coingecko",
  };
}

// Open Exchange Rate fallback for Forex
async function fetchForexFromOpenER(asset: string): Promise<PriceData> {
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Parse forex pair (e.g., EURUSD -> EUR, USD)
  let base = "EUR";
  let quote = "USD";
  
  if (normalizedAsset.length === 6) {
    base = normalizedAsset.slice(0, 3);
    quote = normalizedAsset.slice(3, 6);
  }
  
  const url = `https://open.er-api.com/v6/latest/${base}`;
  const res = await safeFetch<{ result?: string; rates?: Record<string, number> }>(url, { timeoutMs: 5000 });
  
  if (res?.result !== "success" || !res?.rates) {
    throw new Error("OpenExchangeRate API failed");
  }
  
  const rate = Number(res.rates[quote]);
  if (!Number.isFinite(rate)) {
    throw new Error(`Missing rate for ${quote}`);
  }
  
  return {
    asset: normalizedAsset,
    symbol: `${base}/${quote}`,
    price: rate,
    change24h: null,
    changePercent24h: null,
    high24h: null,
    low24h: null,
    volume24h: null,
    timestamp: Date.now(),
    provider: "open.er-api",
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

// Supported assets list
const SUPPORTED_ASSETS = [
  // Crypto
  "BTC", "BTCUSD", "BTCUSDT", "ETH", "ETHUSD", "ETHUSDT", "SOL", "SOLUSD", "XRP", "DOGE", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI",
  // Forex
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY",
  // Indices
  "SPX", "SP500", "GSPC", "DAX", "GDAXI", "NASDAQ", "NDX", "NDX100", "DJIA", "DOW", "FTSE", "NIKKEI", "CAC40",
  // Commodities
  "XAUUSD", "GOLD", "XAU", "XAGUSD", "SILVER", "XAG", "OIL", "CRUDE", "WTI", "BRENT", "NATGAS", "COPPER",
];

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
    const assetParam = getQueryParam(req.query, "asset")?.toUpperCase()?.replace(/[^A-Z0-9]/g, "");
    
    if (!assetParam) {
      return res.status(400).json({
        ok: false,
        status: "error",
        error: "Missing 'asset' parameter",
        supported: SUPPORTED_ASSETS,
      });
    }
    
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
        cached: true,
        data: {
          asset: cached.asset,
          value: cached.price,
          price: cached.price,
          change24h: cached.change24h,
          changePercent24h: cached.changePercent24h,
          high24h: cached.high24h,
          low24h: cached.low24h,
          volume24h: cached.volume24h,
          ts: cached.timestamp,
          source: cached.provider,
        },
      });
    }
    
    const category = getAssetCategory(assetParam);
    let priceData: PriceData | null = null;
    let lastError: Error | null = null;
    
    // Try Yahoo Finance first (primary source)
    if (isYahooSupported(assetParam)) {
      try {
        priceData = await fetchYahooPrice(assetParam);
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Yahoo failed for ${assetParam}:`, (err as Error).message);
      }
    }
    
    // Fallbacks based on asset category
    if (!priceData) {
      try {
        if (category === "crypto") {
          priceData = await fetchCryptoFromCoinGecko(assetParam);
        } else if (category === "forex") {
          priceData = await fetchForexFromOpenER(assetParam);
        }
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Fallback failed for ${assetParam}:`, (err as Error).message);
      }
    }
    
    if (!priceData) {
      return res.status(502).json({
        ok: false,
        status: "error",
        error: lastError?.message || `Unable to fetch price for ${assetParam}`,
        asset: assetParam,
        category,
      });
    }
    
    // Cache and return
    setCache(assetParam, priceData);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: {
        asset: priceData.asset,
        value: priceData.price,
        price: priceData.price,
        change24h: priceData.change24h,
        changePercent24h: priceData.changePercent24h,
        high24h: priceData.high24h,
        low24h: priceData.low24h,
        volume24h: priceData.volume24h,
        ts: priceData.timestamp,
        source: priceData.provider,
        category,
      },
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

