/**
 * Yahoo Finance Unified Data Service
 * Vision AI Mind - Elite Trader
 * 
 * Provides OHLC data and current prices for:
 * - Crypto: BTC, ETH, SOL, etc.
 * - Forex: EUR/USD, GBP/USD, USD/JPY, etc.
 * - Indices: S&P 500, DAX, NASDAQ, etc.
 * - Commodities: Gold, Silver, Oil, etc.
 */

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

/**
 * Maps internal asset symbols to Yahoo Finance symbols
 */
export const SYMBOL_MAP: Record<string, string> = {
  // Crypto
  BTC: "BTC-USD",
  BTCUSD: "BTC-USD",
  BTCUSDT: "BTC-USD",
  ETH: "ETH-USD",
  ETHUSD: "ETH-USD",
  ETHUSDT: "ETH-USD",
  SOL: "SOL-USD",
  SOLUSD: "SOL-USD",
  SOLUSDT: "SOL-USD",
  XRP: "XRP-USD",
  XRPUSD: "XRP-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  DOT: "DOT-USD",
  AVAX: "AVAX-USD",
  MATIC: "MATIC-USD",
  LINK: "LINK-USD",
  UNI: "UNI-USD",
  
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
  SPX: "^GSPC",
  SP500: "^GSPC",
  GSPC: "^GSPC",
  DAX: "^GDAXI",
  GDAXI: "^GDAXI",
  NASDAQ: "^IXIC",
  NDX: "^NDX",
  NDX100: "^NDX",
  DJIA: "^DJI",
  DOW: "^DJI",
  FTSE: "^FTSE",
  NIKKEI: "^N225",
  CAC40: "^FCHI",
  
  // Commodities
  XAUUSD: "GC=F",
  GOLD: "GC=F",
  XAU: "GC=F",
  XAGUSD: "SI=F",
  SILVER: "SI=F",
  XAG: "SI=F",
  OIL: "CL=F",
  CRUDE: "CL=F",
  WTI: "CL=F",
  BRENT: "BZ=F",
  NATGAS: "NG=F",
  COPPER: "HG=F",
};

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
const getRangeForInterval = (intervalMinutes: number, limit: number): string => {
  const totalMinutes = intervalMinutes * limit;
  const totalDays = totalMinutes / 1440;
  
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
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalizedAsset in SYMBOL_MAP;
}

/**
 * Gets the Yahoo symbol for an asset
 */
export function getYahooSymbol(asset: string): string {
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return SYMBOL_MAP[normalizedAsset] || asset;
}

/**
 * Asset category detection
 */
export function getAssetCategory(asset: string): "crypto" | "forex" | "index" | "commodity" | "unknown" {
  const normalizedAsset = asset.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  const cryptoAssets = ["BTC", "BTCUSD", "BTCUSDT", "ETH", "ETHUSD", "ETHUSDT", "SOL", "SOLUSD", "XRP", "DOGE", "ADA", "DOT", "AVAX", "MATIC", "LINK", "UNI"];
  const forexAssets = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY"];
  const indexAssets = ["SPX", "SP500", "GSPC", "DAX", "GDAXI", "NASDAQ", "NDX", "NDX100", "DJIA", "DOW", "FTSE", "NIKKEI", "CAC40"];
  const commodityAssets = ["XAUUSD", "GOLD", "XAU", "XAGUSD", "SILVER", "XAG", "OIL", "CRUDE", "WTI", "BRENT", "NATGAS", "COPPER"];
  
  if (cryptoAssets.includes(normalizedAsset)) return "crypto";
  if (forexAssets.includes(normalizedAsset)) return "forex";
  if (indexAssets.includes(normalizedAsset)) return "index";
  if (commodityAssets.includes(normalizedAsset)) return "commodity";
  
  return "unknown";
}
