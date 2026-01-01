/**
 * Unified Price API Endpoint
 * Vision AI Mind - Vision AI Mind
 * 
 * Supports crypto assets only via multi-source aggregation.
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
// CRYPTO-ONLY SYMBOL MAPPING
// ============================================

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COIN_BY_ID = new Map(supportedCoins.map((coin) => [coin.id, coin.symbol.toUpperCase()]));
const COINGECKO_SYMBOLS: Record<string, string> = supportedCoins.reduce((acc, coin) => {
  acc[coin.symbol.toUpperCase()] = coin.id;
  return acc;
}, {} as Record<string, string>);
const SUPPORTED_SYMBOLS = new Set(Object.keys(COINGECKO_SYMBOLS));

const COINCAP_SYMBOLS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "xrp",
  DOGE: "dogecoin",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche",
  MATIC: "polygon",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binance-coin",
  TRX: "tron",
  STETH: "staked-ether",
  WSTETH: "wrapped-steth",
  WETH: "weth",
  WBTC: "wrapped-bitcoin",
  XMR: "monero",
  HBAR: "hedera-hashgraph",
  DAI: "dai",
  SHIB: "shiba-inu",
  TON: "toncoin",
  MNT: "mantle",
  SUI: "sui",
  LEO: "leo-token",
  CRO: "cronos",
  BGB: "bitget-token",
  XAUT: "tether-gold",
};

type SourceKey = "binance" | "coincap" | "kraken" | "coingecko";

interface SourceMetric {
  avgLatency: number;
  samples: number;
  errorCount: number;
  lastErrorAt: number | null;
}

const sourceMetrics = new Map<SourceKey, SourceMetric>();

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

const MAX_CONCURRENT_FETCHES = 5;
let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

const withSemaphore = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve) => fetchQueue.push(resolve));
  }
  activeFetches += 1;
  try {
    return await task();
  } finally {
    activeFetches -= 1;
    const next = fetchQueue.shift();
    if (next) next();
  }
};

const recordSourceMetric = (source: SourceKey, ok: boolean, durationMs: number) => {
  const prev = sourceMetrics.get(source);
  const samples = (prev?.samples || 0) + 1;
  const avgLatency = prev ? (prev.avgLatency * (samples - 1) + durationMs) / samples : durationMs;
  const errorCount = (prev?.errorCount || 0) + (ok ? 0 : 1);
  const lastErrorAt = ok ? prev?.lastErrorAt ?? null : Date.now();
  sourceMetrics.set(source, { avgLatency, samples, errorCount, lastErrorAt });
};

const SOURCE_PRIORITY: SourceKey[] = ["binance", "coincap", "kraken", "coingecko"];

const getSourceOrder = () => SOURCE_PRIORITY;

const isRetryableBinanceError = (error: unknown) => {
  const status = (error as Error & { status?: number })?.status;
  return status === 400 || status === 429 || status === 500 || status === undefined;
};

const fetchWithMetrics = async <T>(source: SourceKey, task: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    const result = await task();
    recordSourceMetric(source, true, Date.now() - start);
    return result;
  } catch (err) {
    recordSourceMetric(source, false, Date.now() - start);
    throw err;
  }
};

const normalizeData = ({
  asset,
  price,
  change24h,
  changePercent24h,
  high24h,
  low24h,
  volume24h,
  provider,
  category,
}: {
  asset: string;
  price: number;
  change24h: number | null;
  changePercent24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  provider: string;
  category: string;
}): PriceData => ({
  asset,
  price,
  change24h,
  changePercent24h,
  high24h,
  low24h,
  volume24h,
  timestamp: Date.now(),
  provider,
  category,
});

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
  return withSemaphore(async () => {
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
        const error = new Error(`HTTP ${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      return await response.json() as T;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  });
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
  const data = await fetchWithMetrics("binance", () =>
    safeFetch<{
      lastPrice?: string;
      priceChange?: string;
      priceChangePercent?: string;
      highPrice?: string;
      lowPrice?: string;
      volume?: string;
    }>(url, { timeoutMs: 2000 })
  );
  
  const price = Number(data.lastPrice);
  if (!Number.isFinite(price)) {
    throw new Error("Invalid Binance price");
  }
  
  return normalizeData({
    asset: normalized,
    price,
    change24h: Number(data.priceChange) || null,
    changePercent24h: Number(data.priceChangePercent) || null,
    high24h: Number(data.highPrice) || null,
    low24h: Number(data.lowPrice) || null,
    volume24h: Number(data.volume) || null,
    provider: "binance",
    category: "crypto",
  });
}

import supportedCoins, { GOLD_FOREX_ASSETS, getAssetClass } from "../src/config/supportedCoins.js";

// ============================================
// GOLD & FOREX PRICE SOURCES
// ============================================

const GOLD_FOREX_SYMBOLS = new Set(GOLD_FOREX_ASSETS.map((a) => a.symbol.toUpperCase()));

// Static fallback prices (updated frequently via external sources)
const GOLD_FOREX_FALLBACK: Record<string, { price: number; change24h: number }> = {
  XAUUSD: { price: 2650.00, change24h: 0.45 },
  XAGUSD: { price: 31.50, change24h: 0.65 },
  EURUSD: { price: 1.0850, change24h: -0.12 },
  GBPUSD: { price: 1.2650, change24h: 0.08 },
  USDJPY: { price: 149.50, change24h: 0.25 },
};

async function fetchForexPrice(symbol: string): Promise<PriceData> {
  const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const assetClass = getAssetClass(normalized);
  const fallback = GOLD_FOREX_FALLBACK[normalized];
  
  // Try free forex API first (exchangerate-api)
  try {
    // For XAUUSD/XAGUSD use metal API, for forex use exchange rate API
    if (normalized === "XAUUSD" || normalized === "XAGUSD") {
      const metal = normalized === "XAUUSD" ? "XAU" : "XAG";
      const url = `https://api.metals.live/v1/spot/${metal.toLowerCase()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json() as Array<{ price: number }>;
        const price = data?.[0]?.price;
        if (typeof price === 'number' && price > 0) {
          return normalizeData({
            asset: normalized,
            price,
            change24h: fallback?.change24h ?? null,
            changePercent24h: fallback ? (fallback.change24h / fallback.price) * 100 : null,
            high24h: null,
            low24h: null,
            volume24h: null,
            provider: "metals.live",
            category: assetClass,
          });
        }
      }
    } else {
      // Forex pairs - use exchangerate.host
      const base = normalized.slice(0, 3);
      const quote = normalized.slice(3);
      const url = `https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = await response.json() as { rates?: Record<string, number> };
        const rate = data?.rates?.[quote];
        if (typeof rate === 'number' && rate > 0) {
          return normalizeData({
            asset: normalized,
            price: rate,
            change24h: fallback?.change24h ?? null,
            changePercent24h: fallback ? (fallback.change24h / fallback.price) * 100 : null,
            high24h: null,
            low24h: null,
            volume24h: null,
            provider: "exchangerate.host",
            category: assetClass,
          });
        }
      }
    }
  } catch {
    // Fall through to fallback
  }
  
  // Return fallback price
  if (fallback) {
    return normalizeData({
      asset: normalized,
      price: fallback.price,
      change24h: fallback.change24h,
      changePercent24h: (fallback.change24h / fallback.price) * 100,
      high24h: null,
      low24h: null,
      volume24h: null,
      provider: "fallback",
      category: assetClass,
    });
  }
  
  throw new Error(`No price data for ${normalized}`);
}

function isGoldForexSymbol(symbol: string): boolean {
  const normalized = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  return GOLD_FOREX_SYMBOLS.has(normalized);
}

// ============================================
// KRAKEN FALLBACK (CRYPTO)
// ============================================

const normalizeKrakenPair = (asset: string) => {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stripped = normalized.replace(/USDT?$/, "");
  if (stripped === "BTC") return "XBTUSD";
  if (stripped === "ETH") return "ETHUSD";
  return `${stripped}USD`;
};

async function fetchKrakenPrice(asset: string): Promise<PriceData> {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const pair = normalizeKrakenPair(normalized);
  const url = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;

  const data = await fetchWithMetrics(
    "kraken",
    () =>
      safeFetch<{
        result?: Record<string, { c?: string[]; o?: string; h?: string[]; l?: string[]; v?: string[] }>;
        error?: string[];
      }>(url, { timeoutMs: 2000 })
  );

  if (data.error?.length) {
    throw new Error(`Kraken: ${data.error.join(", ")}`);
  }

  const resultKey = Object.keys(data.result || {})[0];
  const ticker = resultKey ? data.result?.[resultKey] : null;
  const last = Number(ticker?.c?.[0]);
  if (!Number.isFinite(last)) {
    throw new Error("Invalid Kraken price");
  }
  const open = Number(ticker?.o);
  const changePercent24h = Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null;
  const change24h = Number.isFinite(open) ? last - open : null;
  const high24h = Number(ticker?.h?.[1] ?? ticker?.h?.[0]);
  const low24h = Number(ticker?.l?.[1] ?? ticker?.l?.[0]);
  const volume24h = Number(ticker?.v?.[1]);

  return normalizeData({
    asset: normalized,
    price: last,
    change24h,
    changePercent24h,
    high24h: Number.isFinite(high24h) ? high24h : null,
    low24h: Number.isFinite(low24h) ? low24h : null,
    volume24h: Number.isFinite(volume24h) ? volume24h : null,
    provider: "kraken",
    category: "crypto",
  });
}

// ============================================
// COINCAP FALLBACK (CRYPTO)
// ============================================

async function fetchCoinCapPrice(asset: string): Promise<PriceData> {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const id = getCoinCapId(normalized);
  if (!id) {
    throw new Error(`Unsupported asset for CoinCap: ${asset}`);
  }
  const url = `https://api.coincap.io/v2/assets/${id}`;
  const data = await fetchWithMetrics(
    "coincap",
    () =>
      safeFetch<{
        data?: {
          priceUsd?: string;
          changePercent24Hr?: string;
          volumeUsd24Hr?: string;
        };
        timestamp?: number;
      }>(url, { timeoutMs: 2000 })
  );
  const price = Number(data?.data?.priceUsd);
  if (!Number.isFinite(price)) {
    throw new Error("Invalid CoinCap price");
  }
  const changePercent24h = Number(data?.data?.changePercent24Hr);
  const change24h = Number.isFinite(changePercent24h) ? (price * changePercent24h) / 100 : null;
  const volume24h = Number(data?.data?.volumeUsd24Hr);

  return normalizeData({
    asset: normalized,
    price,
    change24h: Number.isFinite(change24h) ? change24h : null,
    changePercent24h: Number.isFinite(changePercent24h) ? changePercent24h : null,
    high24h: null,
    low24h: null,
    volume24h: Number.isFinite(volume24h) ? volume24h : null,
    provider: "coincap",
    category: "crypto",
  });
}

// ============================================
// COINGECKO FALLBACK (CRYPTO)
// ============================================

const normalizeAsset = (asset: string) => asset.toUpperCase().replace(/[^A-Z0-9]/g, "");

const resolveSupportedSymbol = (asset: string): string | null => {
  if (!asset) return null;
  const idKey = asset.toLowerCase();
  const byId = COIN_BY_ID.get(idKey);
  if (byId) return byId;
  const normalized = normalizeAsset(asset);
  if (!normalized) return null;
  if (SUPPORTED_SYMBOLS.has(normalized)) return normalized;
  const stripped = normalized.replace(/USDT?$/, "").replace(/USD$/, "");
  return SUPPORTED_SYMBOLS.has(stripped) ? stripped : null;
};

const getCoinGeckoId = (asset: string): string | null => {
  const symbol = resolveSupportedSymbol(asset);
  return symbol ? COINGECKO_SYMBOLS[symbol] : null;
};

const getCoinCapId = (asset: string): string | null => {
  const symbol = resolveSupportedSymbol(asset);
  return symbol ? COINCAP_SYMBOLS[symbol] || null : null;
};

async function fetchCoinGeckoPrice(asset: string): Promise<PriceData> {
  const id = getCoinGeckoId(asset);
  if (!id) {
    throw new Error(`Unsupported asset for CoinGecko: ${asset}`);
  }

  const params = new URLSearchParams({
    vs_currency: "usd",
    ids: id,
    order: "market_cap_desc",
    sparkline: "false",
    price_change_percentage: "24h",
  });
  const url = `${COINGECKO_API}/coins/markets?${params.toString()}`;

  const data = await fetchWithMetrics(
    "coingecko",
    () =>
      safeFetch<Array<{
        current_price?: number;
        price_change_24h?: number;
        price_change_percentage_24h?: number;
        high_24h?: number;
        low_24h?: number;
        total_volume?: number;
      }>>(url, { timeoutMs: 2000 })
  );

  const coin = data?.[0];
  if (!coin?.current_price) {
    throw new Error("No CoinGecko price data");
  }

  return normalizeData({
    asset: asset.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    price: coin.current_price,
    change24h: Number.isFinite(coin.price_change_24h) ? coin.price_change_24h ?? null : null,
    changePercent24h: Number.isFinite(coin.price_change_percentage_24h) ? coin.price_change_percentage_24h ?? null : null,
    high24h: Number.isFinite(coin.high_24h) ? coin.high_24h ?? null : null,
    low24h: Number.isFinite(coin.low_24h) ? coin.low_24h ?? null : null,
    volume24h: Number.isFinite(coin.total_volume) ? coin.total_volume ?? null : null,
    provider: "coingecko",
    category: "crypto",
  });
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
    const requestedAsset = getQueryParam(req.query, "asset") ||
                       getQueryParam(req.query, "symbol") ||
                       "BTC";
    const assetParam = resolveSupportedSymbol(requestedAsset);
    if (!assetParam) {
      return res.status(400).json({
        ok: false,
        status: "error",
        error: `Unsupported asset: ${requestedAsset}`,
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
        data: cached,
        cached: true,
      });
    }
    
    // Detect asset class: Gold/Forex vs Crypto
    const isForexOrGold = isGoldForexSymbol(assetParam);
    let result: PriceData | null = null;
    let lastError: Error | null = null;
    
    // Route to appropriate price source
    if (isForexOrGold) {
      // Gold & Forex: Use dedicated forex/metals sources
      try {
        result = await fetchForexPrice(assetParam);
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Forex/Gold failed for ${assetParam}:`, (err as Error).message);
      }
    } else {
      // Crypto: Use multi-source aggregation
      const sourceOrder = getSourceOrder();
      for (const source of sourceOrder) {
        if (source === "binance") {
          try {
            result = await fetchBinancePrice(assetParam);
            break;
          } catch (err) {
            lastError = err as Error;
            const message = (err as Error).message;
            console.log(`[price] Binance failed for ${assetParam}:`, message);
            if (!isRetryableBinanceError(err)) {
              continue;
            }
          }
        }
        if (source === "coincap") {
          try {
            result = await fetchCoinCapPrice(assetParam);
            break;
          } catch (err) {
            lastError = err as Error;
            console.log(`[price] CoinCap failed for ${assetParam}:`, (err as Error).message);
          }
        }
        if (source === "kraken") {
          try {
            result = await fetchKrakenPrice(assetParam);
            break;
          } catch (err) {
            lastError = err as Error;
            console.log(`[price] Kraken failed for ${assetParam}:`, (err as Error).message);
          }
        }
        if (source === "coingecko") {
          try {
            result = await fetchCoinGeckoPrice(assetParam);
            break;
          } catch (err) {
            lastError = err as Error;
            console.log(`[price] CoinGecko failed for ${assetParam}:`, (err as Error).message);
          }
        }
      }
    } // End crypto sources
    
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
    if (error instanceof Error && error.name === "AbortError") {
      return res.status(504).json({
        ok: false,
        status: "timeout",
        error: "Request timed out",
      });
    }
    console.error("[price] handler error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      error: (error as Error)?.message || "Internal server error",
    });
  }
}

