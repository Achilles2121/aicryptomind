/**
 * /api/market-data.ts - Crypto Market Data API
 *
 * Unified endpoint for supported crypto assets only.
 * Uses Binance for primary data with Yahoo Finance as fallback for crypto tickers.
 *
 * Usage:
 *   GET /api/market-data?symbol=BTC
 *   GET /api/market-data?symbol=BTCUSDT
 *   GET /api/market-data?symbol=bitcoin
 */

import supportedCoins from "../src/config/supportedCoins.js";

// Edge runtime - no @vercel/node types needed

// ============================================================================
// TYPES
// ============================================================================

type VercelRequest = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type AssetType = "crypto";

interface AssetConfig {
  ticker: string;
  type: AssetType;
  updateInterval: number;
  useBinance?: boolean;
  binanceSymbol?: string;
  displayName?: string;
  decimals?: number;
  currency?: string;
}

interface MarketDataResponse {
  ok: boolean;
  status: "ok" | "error" | "cached";
  data?: {
    symbol: string;
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    high24h: number;
    low24h: number;
    volume: number;
    timestamp: number;
    type: AssetType;
    displayName: string;
    provider: "binance" | "yahoo";
  };
  error?: string;
  cached?: boolean;
}

interface CacheEntry {
  data: MarketDataResponse["data"];
  timestamp: number;
  ttl: number;
}

// ============================================================================
// SUPPORTED COIN MAPPING
// ============================================================================

const normalizeSymbol = (value: string): string =>
  String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const COIN_BY_ID = new Map(
  supportedCoins.map((coin) => [coin.id.toLowerCase(), coin.symbol.toUpperCase()])
);

const SYMBOL_MAP: Record<string, AssetConfig> = supportedCoins.reduce((acc, coin) => {
  const symbol = normalizeSymbol(coin.symbol);
  if (!symbol || acc[symbol]) return acc;
  acc[symbol] = {
    ticker: `${symbol}-USD`,
    type: "crypto",
    updateInterval: 1000,
    useBinance: true,
    binanceSymbol: `${symbol}USDT`,
    displayName: coin.name || symbol,
    decimals: 2,
    currency: "$",
  };
  return acc;
}, {} as Record<string, AssetConfig>);

const SUPPORTED_SYMBOLS = new Set(Object.keys(SYMBOL_MAP));

const resolveSupportedSymbol = (value: string): string | null => {
  if (!value) return null;
  const byId = COIN_BY_ID.get(value.toLowerCase());
  if (byId) return byId;
  const normalized = normalizeSymbol(value);
  if (!normalized) return null;
  if (SUPPORTED_SYMBOLS.has(normalized)) return normalized;
  const stripped = normalized.endsWith("USDT")
    ? normalized.slice(0, -4)
    : normalized.endsWith("USD")
    ? normalized.slice(0, -3)
    : normalized;
  return SUPPORTED_SYMBOLS.has(stripped) ? stripped : null;
};

// ============================================================================
// IN-MEMORY CACHE
// ============================================================================

const cache: Record<string, CacheEntry> = {};

function getCacheKey(symbol: string): string {
  return `market_${symbol.toUpperCase().replaceAll(/\s+/g, "_")}`;
}

function getCachedData(symbol: string): CacheEntry | null {
  const key = getCacheKey(symbol);
  const entry = cache[key];

  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    delete cache[key];
    return null;
  }

  return entry;
}

function setCacheData(symbol: string, data: MarketDataResponse["data"], ttl: number): void {
  const key = getCacheKey(symbol);
  cache[key] = {
    data,
    timestamp: Date.now(),
    ttl,
  };
}

// ============================================================================
// BINANCE API (CRYPTO)
// ============================================================================

async function fetchBinanceData(binanceSymbol: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high24h: number;
  low24h: number;
  volume: number;
} | null> {
  try {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "VisionAIMind/2.0",
      },
    });

    if (!response.ok) {
      console.error(`[Binance] Error ${response.status} for ${binanceSymbol}`);
      return null;
    }

    const data = await response.json();

    return {
      price: Number.parseFloat(data.lastPrice) || 0,
      change: Number.parseFloat(data.priceChange) || 0,
      changePercent: Number.parseFloat(data.priceChangePercent) || 0,
      previousClose: Number.parseFloat(data.prevClosePrice) || 0,
      high24h: Number.parseFloat(data.highPrice) || 0,
      low24h: Number.parseFloat(data.lowPrice) || 0,
      volume: Number.parseFloat(data.volume) || 0,
    };
  } catch (error) {
    console.error(`[Binance] Fetch error for ${binanceSymbol}:`, error);
    return null;
  }
}

// ============================================================================
// YAHOO FINANCE API (CRYPTO FALLBACK)
// ============================================================================

async function fetchYahooData(ticker: string): Promise<{
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high24h: number;
  low24h: number;
  volume: number;
} | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`[Yahoo] Error ${response.status} for ${ticker}`);
      return null;
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      console.error(`[Yahoo] No result for ${ticker}`);
      return null;
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;

    const change = price - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    let high24h = meta.regularMarketDayHigh ?? 0;
    let low24h = meta.regularMarketDayLow ?? 0;
    let volume = meta.regularMarketVolume ?? 0;

    if (quote && (!high24h || !low24h)) {
      const highs = (quote.high || []).filter((h: number | null) => h !== null);
      const lows = (quote.low || []).filter((l: number | null) => l !== null);
      if (highs.length) high24h = Math.max(...highs);
      if (lows.length) low24h = Math.min(...lows);
    }

    return {
      price,
      change,
      changePercent,
      previousClose,
      high24h,
      low24h,
      volume,
    };
  } catch (error) {
    console.error(`[Yahoo] Fetch error for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=5");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({
      ok: false,
      status: "error",
      error: "Method not allowed",
    });
    return;
  }

  const symbolParam = (req.query?.symbol as string) || "";
  const symbol = resolveSupportedSymbol(symbolParam);

  if (!symbol) {
    res.status(400).json({
      ok: false,
      status: "error",
      error: `Unsupported symbol: ${symbolParam}`,
    });
    return;
  }

  const config = SYMBOL_MAP[symbol];
  if (!config) {
    res.status(404).json({
      ok: false,
      status: "error",
      error: `Unsupported symbol: ${symbol}`,
    });
    return;
  }

  const cached = getCachedData(symbol);
  if (cached) {
    res.status(200).json({
      ok: true,
      status: "cached",
      data: cached.data,
      cached: true,
    });
    return;
  }

  let marketData: {
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    high24h: number;
    low24h: number;
    volume: number;
  } | null = null;

  let provider: "binance" | "yahoo" = "yahoo";

  if (config.useBinance && config.binanceSymbol) {
    provider = "binance";
    marketData = await fetchBinanceData(config.binanceSymbol);

    if (!marketData) {
      provider = "yahoo";
      marketData = await fetchYahooData(config.ticker);
    }
  } else {
    marketData = await fetchYahooData(config.ticker);
  }

  if (!marketData) {
    const staleKey = getCacheKey(symbol);
    const staleEntry = cache[staleKey];

    if (staleEntry) {
      res.status(200).json({
        ok: true,
        status: "cached",
        data: staleEntry.data,
        cached: true,
      });
      return;
    }

    res.status(503).json({
      ok: false,
      status: "error",
      error: `Failed to fetch data for ${symbol}. Please try again.`,
    });
    return;
  }

  const responseData: MarketDataResponse["data"] = {
    symbol,
    ticker: config.ticker,
    price: marketData.price,
    change: marketData.change,
    changePercent: marketData.changePercent,
    previousClose: marketData.previousClose,
    high24h: marketData.high24h,
    low24h: marketData.low24h,
    volume: marketData.volume,
    timestamp: Date.now(),
    type: config.type,
    displayName: config.displayName || symbol,
    provider,
  };

  const ttl = config.updateInterval || 1000;
  setCacheData(symbol, responseData, ttl);

  res.status(200).json({
    ok: true,
    status: "ok",
    data: responseData,
    cached: false,
  });
}
