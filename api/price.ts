/**
 * Unified Price API Endpoint
 * Vision AI Mind - Vision AI Mind
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

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINGECKO_SYMBOLS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  DOGE: "dogecoin",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  LTC: "litecoin",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  TRX: "tron",
  STETH: "staked-ether",
  WSTETH: "wrapped-steth",
  WETH: "weth",
  WBTC: "wrapped-bitcoin",
  XMR: "monero",
  HBAR: "hedera-hashgraph",
  DAI: "dai",
  SHIB: "shiba-inu",
  TON: "the-open-network",
  MNT: "mantle",
  SUI: "sui",
  LEO: "leo-token",
  CRO: "crypto-com-chain",
  BGB: "bitget-token",
  XAUT: "tether-gold",
};

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

type SourceKey = "binance" | "coincap" | "kraken" | "coingecko" | "yahoo";

interface SourceMetric {
  avgLatency: number;
  samples: number;
  errorCount: number;
  lastErrorAt: number | null;
}

const sourceMetrics = new Map<SourceKey, SourceMetric>();

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
  
  const data = await fetchWithMetrics("yahoo", () => safeFetch<YahooResponse>(url, { timeoutMs: 2000 }));
  
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
  
  return normalizeData({
    asset: normalized,
    price,
    change24h,
    changePercent24h,
    high24h: meta.regularMarketDayHigh || null,
    low24h: meta.regularMarketDayLow || null,
    volume24h: meta.regularMarketVolume || null,
    provider: "yahoo",
    category: getAssetCategory(normalized),
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

const getCoinGeckoId = (asset: string): string | null => {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stripped = normalized.replace(/USDT?$/, "");
  return COINGECKO_SYMBOLS[normalized] || COINGECKO_SYMBOLS[stripped] || null;
};

const getCoinCapId = (asset: string): string | null => {
  const normalized = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stripped = normalized.replace(/USDT?$/, "");
  return COINCAP_SYMBOLS[normalized] || COINCAP_SYMBOLS[stripped] || null;
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
    const isCrypto = category === "crypto" || Boolean(getCoinGeckoId(assetParam)) || Boolean(getCoinCapId(assetParam));
    let result: PriceData | null = null;
    let lastError: Error | null = null;
    
    // Check if Yahoo supports this asset
    const isYahooSupported = !!YAHOO_SYMBOLS[assetParam];

    if (isCrypto) {
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
    } else if (isYahooSupported) {
      try {
        result = await fetchYahooPrice(assetParam);
      } catch (err) {
        lastError = err as Error;
        console.log(`[price] Yahoo failed for ${assetParam}:`, (err as Error).message);
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

