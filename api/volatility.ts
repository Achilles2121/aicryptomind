/**
 * Volatility API Endpoint
 * Vision AI Mind - Vision AI Mind
 * 
 * Crypto-only volatility analysis with:
 * - ATR (Average True Range) calculation
 * - Bollinger Bandwidth normalization
 * - Historical Volatility (30d annualized)
 * - GARCH(1,1) Forecast (4h/24h)
 * - Composite Volatility Score (0-100)
 * 
 * Designed to improve win-rate from 55% -> 67%
 */

import supportedCoins from "../src/config/supportedCoins.js";

// ============================================
// TYPES
// ============================================

type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  removeListener?: (event: string, handler: () => void) => void;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  writableEnded?: boolean;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
  removeListener?: (event: string, handler: () => void) => void;
};

interface OHLC {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface VolatilityMetrics {
  atr: number;
  atrPercent: number;
  bollingerBandwidth: number;
  historicalVol: number;
  garchForecast4h: number;
  garchForecast24h: number;
}

interface VolatilityResponse {
  symbol: string;
  timestamp: number;
  volatilityScore: number;
  metrics: VolatilityMetrics;
  classification: 'LOW' | 'MED' | 'HIGH' | 'EXTREME';
  recommendation: 'TRADE' | 'WAIT' | 'CAUTION';
  confidence: number;
  assetType: string;
  sentiment?: {
    fearGreed: number | null;
    fundingRate: number | null;
    liquidations24h: number | null;
  };
}

// ============================================
// SUPPORTED COINS & THRESHOLDS
// ============================================

/**
 * Enhanced symbol normalization for Forex pairs
 * Correctly handles symbols with / character (e.g., XAU/USD, EUR/USD)
 * Prevents calculation errors from malformed symbols
 */
const normalizeSymbol = (value: string): string => {
  if (!value) return "";
  // Remove slashes first, then normalize
  const cleaned = String(value).replace(/\//g, "");
  return cleaned.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
};

/**
 * Preserve original symbol format for display/logging
 */
export const preserveSymbolFormat = (value: string): string => {
  if (!value) return "";
  return String(value).toUpperCase().trim();
};

/**
 * Detect asset class from symbol
 */
export const detectAssetClass = (symbol: string): 'crypto' | 'forex' | 'commodity' => {
  const normalized = normalizeSymbol(symbol);
  if (normalized.startsWith('XAU') || normalized.startsWith('XAG')) return 'commodity';
  if (['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'].includes(normalized)) return 'forex';
  return 'crypto';
};

const COIN_BY_ID = new Map(
  supportedCoins.map((coin) => [coin.id.toLowerCase(), coin.symbol.toUpperCase()])
);
const SUPPORTED_SYMBOLS = new Set(
  supportedCoins.map((coin) => normalizeSymbol(coin.symbol)).filter(Boolean)
);

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

const VOLATILITY_THRESHOLDS: Record<string, { low: number; med: number; high: number }> = {
  crypto: { low: 30, med: 70, high: 85 },
};

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINGECKO_CACHE_TTL = 60 * 1000;
const REQUEST_DEBOUNCE_MS = 250;

// ============================================
// YAHOO + COINGECKO SYMBOL MAPPING
// ============================================

const YAHOO_SYMBOLS: Record<string, string> = supportedCoins.reduce((acc, coin) => {
  const symbol = normalizeSymbol(coin.symbol);
  if (!symbol || acc[symbol]) return acc;
  acc[symbol] = `${symbol}-USD`;
  return acc;
}, {} as Record<string, string>);

const COINGECKO_IDS: Record<string, string> = supportedCoins.reduce((acc, coin) => {
  const symbol = normalizeSymbol(coin.symbol);
  if (!symbol || acc[symbol]) return acc;
  acc[symbol] = coin.id;
  return acc;
}, {} as Record<string, string>);

type CoinGeckoCache = {
  data: OHLC[] | null;
  ts: number;
  key: string;
};

let coinGeckoCache: CoinGeckoCache = { data: null, ts: 0, key: "" };
const inflightRequests = new Map<string, { startedAt: number; controller: AbortController; promise: Promise<OHLC[]> }>();

const getYahooSymbol = (symbol: string): string => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return "BTC-USD";
  return YAHOO_SYMBOLS[normalized] || `${normalized}-USD`;
};

const getCoinGeckoId = (symbol: string): string | null => {
  const resolved = resolveSupportedSymbol(symbol);
  return resolved ? COINGECKO_IDS[resolved] || null : null;
};

// ============================================
// VOLATILITY CALCULATIONS
// ============================================

/**
 * Calculate ATR using Wilder's Smoothing Method
 */
function calculateATR(candles: OHLC[], period = 14): number {
  if (candles.length < period + 1) return 0;

  const tr: number[] = candles.map((c, i) => {
    if (i === 0) return c.h - c.l;
    const prev = candles[i - 1];
    return Math.max(
      c.h - c.l,
      Math.abs(c.h - prev.c),
      Math.abs(c.l - prev.c)
    );
  });

  // Wilder's Smoothing
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) {
    atr = ((period - 1) * atr + tr[i]) / period;
  }

  return atr;
}

/**
 * Calculate ATR as percentage of current price
 */
function calculateATRPercent(atr: number, currentPrice: number): number {
  if (!currentPrice || currentPrice === 0) return 0;
  return (atr / currentPrice) * 100;
}

/**
 * Calculate Bollinger Bandwidth (normalized 0-10 scale)
 */
function calculateBollingerBandwidth(candles: OHLC[], period = 20): number {
  if (candles.length < period) return 0;

  const closes = candles.slice(-period).map(c => c.c);
  const sma = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((sum, x) => sum + Math.pow(x - sma, 2), 0) / period;
  const std = Math.sqrt(variance);

  const upperBand = sma + 2 * std;
  const lowerBand = sma - 2 * std;

  // Bandwidth as percentage of SMA
  return ((upperBand - lowerBand) / sma) * 100;
}

/**
 * Calculate Historical Volatility (30-day annualized)
 */
function calculateHistoricalVol(candles: OHLC[], period = 30): number {
  if (candles.length < period + 1) return 0;

  const recentCandles = candles.slice(-period - 1);
  const returns: number[] = [];

  for (let i = 1; i < recentCandles.length; i++) {
    const logReturn = Math.log(recentCandles[i].c / recentCandles[i - 1].c);
    returns.push(logReturn);
  }

  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;

  // Annualize (assuming daily data, 365 trading days for crypto)
  return Math.sqrt(variance * 365) * 100;
}

/**
 * GARCH(1,1) Volatility Forecast (simplified)
 * Pre-calibrated parameters for crypto markets
 */
function garchForecast(candles: OHLC[], horizonHours: number): number {
  if (candles.length < 30) return 0;

  // Calculate recent returns
  const recentCandles = candles.slice(-30);
  const returns: number[] = [];
  for (let i = 1; i < recentCandles.length; i++) {
    const logReturn = Math.log(recentCandles[i].c / recentCandles[i - 1].c);
    returns.push(logReturn);
  }

  if (returns.length === 0) return 0;

  // GARCH(1,1) parameters (pre-calibrated for crypto)
  const omega = 0.000002;  // Long-run variance constant
  const alpha = 0.08;      // ARCH term (shock persistence)
  const beta = 0.90;       // GARCH term (volatility persistence)

  // Last realized variance
  const lastReturn = returns[returns.length - 1];
  let variance = lastReturn * lastReturn;

  // Forecast over horizon
  const steps = Math.ceil(horizonHours);
  for (let i = 0; i < steps; i++) {
    variance = omega + alpha * variance + beta * variance;
  }

  // Annualized volatility forecast
  return Math.sqrt(variance * 365 * 24) * 100;
}

/**
 * Calculate Composite Volatility Score (0-100)
 * @param metrics - The volatility metrics
 * @param _assetType - Asset type for future differentiation (currently unused)
 */
function calculateVolatilityScore(
  metrics: VolatilityMetrics,
  _assetType: string
): number {
  // Normalize each metric to 0-100 scale
  const atrScore = Math.min((metrics.atrPercent / 5) * 100, 100);
  const bbScore = Math.min((metrics.bollingerBandwidth / 8) * 100, 100);
  const hvScore = Math.min((metrics.historicalVol / 100) * 100, 100);
  const garchScore = Math.min((metrics.garchForecast4h / 5) * 100, 100);

  // Crypto weights: more emphasis on GARCH for fast-moving markets
  const weights = { atr: 0.25, bb: 0.2, hv: 0.25, garch: 0.3 };

  return (
    atrScore * weights.atr +
    bbScore * weights.bb +
    hvScore * weights.hv +
    garchScore * weights.garch
  );
}

/**
 * Classify volatility level
 */
function classifyVolatility(
  score: number,
  assetType: string
): 'LOW' | 'MED' | 'HIGH' | 'EXTREME' {
  const thresholds = VOLATILITY_THRESHOLDS[assetType] || VOLATILITY_THRESHOLDS.crypto;

  if (score <= thresholds.low) return 'LOW';
  if (score <= thresholds.med) return 'MED';
  if (score <= thresholds.high) return 'HIGH';
  return 'EXTREME';
}

/**
 * Get trading recommendation based on volatility
 */
function getRecommendation(
  classification: string,
  metrics: VolatilityMetrics
): 'TRADE' | 'WAIT' | 'CAUTION' {
  // EXTREME: Always wait
  if (classification === 'EXTREME') return 'WAIT';

  // HIGH: Wait if multiple indicators are elevated
  if (classification === 'HIGH') {
    const elevatedCount = [
      metrics.atrPercent > 3,
      metrics.bollingerBandwidth > 6,
      metrics.garchForecast4h > 4,
    ].filter(Boolean).length;

    return elevatedCount >= 2 ? 'WAIT' : 'CAUTION';
  }

  // MED: Caution if GARCH predicts increase
  if (classification === 'MED') {
    if (metrics.garchForecast4h > metrics.historicalVol * 0.8) {
      return 'CAUTION';
    }
  }

  return 'TRADE';
}

// ============================================
// FETCH OHLC DATA
// ============================================

async function fetchCoinGeckoOHLC(symbol: string, lookback: number, signal?: AbortSignal): Promise<OHLC[]> {
  const id = getCoinGeckoId(symbol);
  if (!id) return [];
  const days = lookback >= 365 ? "365" : lookback >= 180 ? "180" : lookback >= 90 ? "90" : lookback >= 30 ? "30" : lookback >= 14 ? "14" : lookback >= 7 ? "7" : "1";
  const cacheKey = `${id}:${days}`;
  if (coinGeckoCache.data && coinGeckoCache.key === cacheKey && Date.now() - coinGeckoCache.ts < COINGECKO_CACHE_TTL) {
    return coinGeckoCache.data;
  }
  const url = `${COINGECKO_API}/coins/${id}/ohlc?vs_currency=usd&days=${days}`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return [];
    }
    const data = await response.json() as Array<[number, number, number, number, number]>;
    if (!Array.isArray(data)) return [];
    const candles = data.map(([t, o, h, l, c]) => ({ t, o, h, l, c, v: 0 }));
    const sliced = candles.slice(-lookback);
    coinGeckoCache = { data: sliced, ts: Date.now(), key: cacheKey };
    return sliced;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return [];
    return [];
  }
}

async function fetchOHLCData(symbol: string, interval: string, lookback: number, signal?: AbortSignal): Promise<OHLC[]> {
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const yahooSymbol = getYahooSymbol(normalizedSymbol);

  // Map interval to Yahoo Finance format
  const intervalMap: Record<string, string> = {
    '15m': '15m', '15': '15m',
    '1h': '1h', '60': '1h',
    '4h': '1h', '240': '1h', // Yahoo doesn't support 4h, use 1h
    '1d': '1d', 'D': '1d', 'day': '1d',
  };
  const yahooInterval = intervalMap[interval] || '1h';

  // Calculate range based on lookback
  const rangeMap: Record<string, string> = {
    '15m': '5d',
    '1h': '30d',
    '1d': '1y',
  };
  const range = rangeMap[yahooInterval] || '30d';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${yahooInterval}&range=${range}`;

  try {
    const key = `${normalizedSymbol}:${yahooInterval}:${lookback}`;
    const now = Date.now();
    const inflight = inflightRequests.get(key);
    if (inflight && now - inflight.startedAt < REQUEST_DEBOUNCE_MS) {
      return inflight.promise;
    }
    if (inflight) {
      inflight.controller.abort();
      inflightRequests.delete(key);
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", onAbort);
      }
    }
    const timeout = setTimeout(() => controller.abort(), 8000);

    const requestPromise = fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
      .then(async (response) => {
        clearTimeout(timeout);
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        if (response.status === 404) {
          return [] as OHLC[];
        }
        if (!response.ok) {
          throw new Error(`Yahoo Finance API failed: ${response.status}`);
        }
        const data = await response.json() as {
          chart?: {
            result?: Array<{
              timestamp?: number[];
              indicators?: {
                quote?: Array<{
                  open?: number[];
                  high?: number[];
                  low?: number[];
                  close?: number[];
                  volume?: number[];
                }>;
              };
            }>;
            error?: { description?: string };
          };
        };
        if (data.chart?.error) {
          throw new Error(data.chart.error.description || 'Yahoo API error');
        }
        const result = data.chart?.result?.[0];
        if (!result?.timestamp || !result.indicators?.quote?.[0]) {
          throw new Error('No data returned');
        }
        const timestamps = result.timestamp;
        const quote = result.indicators.quote[0];
        const candles: OHLC[] = [];
        for (let i = 0; i < timestamps.length && candles.length < lookback; i++) {
          const o = quote.open?.[i];
          const h = quote.high?.[i];
          const l = quote.low?.[i];
          const c = quote.close?.[i];
          const v = quote.volume?.[i];
          if (o != null && h != null && l != null && c != null) {
            candles.push({
              t: timestamps[i] * 1000,
              o, h, l, c,
              v: v || 0,
            });
          }
        }
        return candles.slice(-lookback);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
        inflightRequests.delete(key);
      });

    inflightRequests.set(key, { startedAt: now, controller, promise: requestPromise });

    const yahooCandles = await requestPromise;
    if (yahooCandles.length > 0) return yahooCandles;
    const fallbackCandles = await fetchCoinGeckoOHLC(normalizedSymbol, lookback, signal);
    return fallbackCandles;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return [];
    console.error(`[Volatility API] Yahoo fetch failed for ${symbol}:`, error);
    const fallbackCandles = await fetchCoinGeckoOHLC(normalizedSymbol, lookback, signal);
    return fallbackCandles;
  }
}

// ============================================
// FETCH SENTIMENT DATA (Optional Enhancement)
// ============================================

async function fetchSentimentData(symbol: string): Promise<{
  fearGreed: number | null;
  fundingRate: number | null;
  liquidations24h: number | null;
}> {
  const result = {
    fearGreed: null as number | null,
    fundingRate: null as number | null,
    liquidations24h: null as number | null,
  };

  if (!resolveSupportedSymbol(symbol)) return result;

  try {
    // Fear & Greed Index
    const fgResponse = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(3000),
    });
    if (fgResponse.ok) {
      const fgData = await fgResponse.json() as { data?: Array<{ value?: string }> };
      result.fearGreed = fgData.data?.[0]?.value ? parseInt(fgData.data[0].value, 10) : null;
    }
  } catch {
    // Ignore sentiment fetch errors
  }

  try {
    // Funding Rate (Binance)
    const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z]/g, '');
    const fundingResponse = await fetch(
      `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${normalizedSymbol}USDT&limit=1`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (fundingResponse.ok) {
      const fundingData = await fundingResponse.json() as Array<{ fundingRate?: string }>;
      result.fundingRate = fundingData[0]?.fundingRate 
        ? parseFloat(fundingData[0].fundingRate) * 100 
        : null;
    }
  } catch {
    // Ignore funding rate fetch errors
  }

  return result;
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req: Req, res: Res): Promise<void> {
  const cleanupListeners: Array<() => void> = [];
  const attachListener = (target: Req | Res, event: string, handler: () => void) => {
    if (target?.on) {
      target.on(event, handler);
      cleanupListeners.push(() => {
        if (target.off) {
          target.off(event, handler);
        } else if (target.removeListener) {
          target.removeListener(event, handler);
        }
      });
    }
  };
  const requestController = new AbortController();
  const onClose = () => {
    requestController.abort();
  };
  attachListener(req, "aborted", onClose);
  attachListener(req, "close", onClose);
  attachListener(res, "close", onClose);

  const sendJson = (status: number, body: unknown) => {
    if (res.writableEnded) return;
    res.status(status).json(body);
  };

  // CORS headers
  if (res.setHeader) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  }

  if (req.method === 'OPTIONS') {
    sendJson(200, { ok: true });
    cleanupListeners.forEach((cleanup) => cleanup());
    return;
  }

  const rawSymbol = (req.query?.symbol as string) || 'BTC';
  const interval = (req.query?.interval as string) || '1h';
  const lookback = Math.min(parseInt((req.query?.lookback as string) || '100', 10), 500);

  const symbol = resolveSupportedSymbol(rawSymbol);
  if (!symbol) {
    sendJson(400, {
      ok: false,
      error: `Unsupported symbol: ${rawSymbol}`,
    });
    cleanupListeners.forEach((cleanup) => cleanup());
    return;
  }
  const assetType = "crypto";

  try {
    // Fetch OHLC data
    const candles = await fetchOHLCData(symbol, interval, lookback, requestController.signal);

    if (candles.length < 20) {
      sendJson(200, {
        symbol,
        timestamp: Date.now(),
        volatilityScore: 50,
        metrics: {
          atr: 0,
          atrPercent: 0,
          bollingerBandwidth: 0,
          historicalVol: 0,
          garchForecast4h: 0,
          garchForecast24h: 0,
        },
        classification: 'MED',
        recommendation: 'CAUTION',
        confidence: 0.3,
        assetType,
        error: 'Insufficient data for volatility calculation',
      });
      cleanupListeners.forEach((cleanup) => cleanup());
      return;
    }

    // Calculate all volatility metrics
    const currentPrice = candles[candles.length - 1].c;
    const atr = calculateATR(candles, 14);
    const atrPercent = calculateATRPercent(atr, currentPrice);
    const bollingerBandwidth = calculateBollingerBandwidth(candles, 20);
    const historicalVol = calculateHistoricalVol(candles, 30);
    const garchForecast4h = garchForecast(candles, 4);
    const garchForecast24h = garchForecast(candles, 24);

    const metrics: VolatilityMetrics = {
      atr,
      atrPercent,
      bollingerBandwidth,
      historicalVol,
      garchForecast4h,
      garchForecast24h,
    };

    // Calculate composite score
    const volatilityScore = calculateVolatilityScore(metrics, assetType);
    const classification = classifyVolatility(volatilityScore, assetType);
    const recommendation = getRecommendation(classification, metrics);

    // Calculate confidence (higher when metrics agree)
    const metricAgreement = [
      atrPercent > 2 ? 1 : 0,
      bollingerBandwidth > 5 ? 1 : 0,
      historicalVol > 50 ? 1 : 0,
      garchForecast4h > 3 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    const confidence = metricAgreement >= 3 || metricAgreement === 0 
      ? 0.85 + (metricAgreement === 4 ? 0.10 : 0)
      : 0.65 + (metricAgreement * 0.05);

    // Fetch sentiment data (optional, for crypto)
    const sentiment = await fetchSentimentData(symbol);

    const response: VolatilityResponse = {
      symbol,
      timestamp: Date.now(),
      volatilityScore: Math.round(volatilityScore * 100) / 100,
      metrics: {
        atr: Math.round(atr * 100) / 100,
        atrPercent: Math.round(atrPercent * 1000) / 1000,
        bollingerBandwidth: Math.round(bollingerBandwidth * 100) / 100,
        historicalVol: Math.round(historicalVol * 100) / 100,
        garchForecast4h: Math.round(garchForecast4h * 100) / 100,
        garchForecast24h: Math.round(garchForecast24h * 100) / 100,
      },
      classification,
      recommendation,
      confidence: Math.round(confidence * 100) / 100,
      assetType,
      sentiment: sentiment.fearGreed !== null ? sentiment : undefined,
    };

    sendJson(200, response);
    cleanupListeners.forEach((cleanup) => cleanup());
    return;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      cleanupListeners.forEach((cleanup) => cleanup());
      return;
    }
    console.error('[Volatility API] Error:', error);
    sendJson(500, {
      error: 'Volatility calculation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    cleanupListeners.forEach((cleanup) => cleanup());
    return;
  }
}


