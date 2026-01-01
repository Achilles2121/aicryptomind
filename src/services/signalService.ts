/**
 * Signal Service - Client-side API Integration
 * Vision AI Mind - Elite Trader Dashboard
 *
 * Connects to the protected /api/signal endpoint for server-side
 * 8-Point Analysis computation.
 *
 * Features:
 * - OHLC-based signal requests
 * - Legacy indicator-based fallback
 * - Response caching (5s TTL)
 * - Automatic retry with backoff
 * - Rate limit awareness
 */

import type { OHLC } from "../stores/useCandleStore";

// ============================================
// TYPES
// ============================================

export type SignalDirection = "BUY" | "SELL" | "HOLD";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";
export type AssetClass = "crypto" | "commodity" | "forex";

export interface SignalLevels {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskReward: number;
}

export interface FibonacciLevels {
  level236: number;
  level382: number;
  level500: number;
  level618: number;
  level786: number;
}

export interface SignalIndicators {
  rsi: number;
  macdHistogram: number;
  ema20: number;
  ema50: number;
  atr: number;
  atrPercent: number;
  trendStrength: number;
}

export interface SignalResult {
  symbol: string;
  signal: SignalDirection;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  buyScore: number;
  sellScore: number;
  netScore: number;
  reasons: string[];
  levels: SignalLevels | null;
  fibonacci: FibonacciLevels | null;
  indicators: SignalIndicators;
  params: {
    assetClass: AssetClass;
    rsiPeriod: number;
    macdFast: number;
    macdSlow: number;
    macdSignal: number;
  };
}

export interface SignalResponse {
  success: boolean;
  data?: SignalResult;
  error?: string;
  meta?: {
    requestId: string;
    processingMs: number;
    rateLimit: {
      remaining: number;
      resetAt: number;
    };
    algorithm: "8-point-ohlc" | "legacy-indicator";
  };
}

export interface SignalRequest {
  symbol: string;
  ohlc: OHLC[];
  currentPrice?: number;
  assetClass?: AssetClass;
}

// ============================================
// CACHE
// ============================================

interface CacheEntry {
  data: SignalResult;
  timestamp: number;
}

const signalCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000; // 5 seconds

const getCacheKey = (symbol: string): string => {
  return `signal:${symbol.toUpperCase()}`;
};

const getCachedSignal = (symbol: string): SignalResult | null => {
  const key = getCacheKey(symbol);
  const entry = signalCache.get(key);

  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    signalCache.delete(key);
    return null;
  }

  return entry.data;
};

const setCachedSignal = (symbol: string, data: SignalResult): void => {
  const key = getCacheKey(symbol);
  signalCache.set(key, { data, timestamp: Date.now() });
};

// ============================================
// API CLIENT
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const SIGNAL_ENDPOINT = `${API_BASE_URL}/api/signal`;

/**
 * Sleep utility for retry backoff
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Make API request with error handling
 */
async function makeSignalRequest(
  body: Record<string, unknown>
): Promise<{ response: Response | null; error: Error | null }> {
  try {
    const response = await fetch(SIGNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(globalThis.__API_TOKEN__
          ? { Authorization: `Bearer ${globalThis.__API_TOKEN__}` }
          : {}),
      },
      body: JSON.stringify(body),
    });
    return { response, error: null };
  } catch (err) {
    return { response: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Handle rate limit response
 */
async function handleRateLimit(response: Response): Promise<void> {
  const retryAfter = response.headers.get("Retry-After");
  const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
  console.warn(`[SignalService] Rate limited. Waiting ${waitMs}ms...`);
  await sleep(waitMs);
}

/**
 * Get cached signal response
 */
const getCachedResponse = (symbol: string): SignalResponse | null => {
  const cached = getCachedSignal(symbol);
  if (!cached) return null;
  
  return {
    success: true,
    data: cached,
    meta: {
      requestId: "cache",
      processingMs: 0,
      rateLimit: { remaining: 60, resetAt: Date.now() + 60000 },
      algorithm: "8-point-ohlc",
    },
  };
};

/**
 * Process successful API response
 */
const processSuccessResponse = (
  symbol: string,
  json: SignalResponse,
  response: Response
): SignalResponse => {
  if (!response.ok) {
    return { success: false, error: json.error ?? `HTTP ${response.status}` };
  }
  
  if (json.success && json.data) {
    setCachedSignal(symbol, json.data);
  }
  
  return json;
};

/**
 * Fetch signal from protected backend API
 */
export async function fetchSignal(
  request: SignalRequest,
  options?: { useCache?: boolean; maxRetries?: number }
): Promise<SignalResponse> {
  const { symbol, ohlc, currentPrice, assetClass } = request;
  const { useCache = true, maxRetries = 2 } = options ?? {};

  // Check cache first
  if (useCache) {
    const cachedResponse = getCachedResponse(symbol);
    if (cachedResponse) return cachedResponse;
  }

  // Validate OHLC data
  if (!ohlc || ohlc.length < 30) {
    return { success: false, error: "Insufficient OHLC data (need 30+ candles)" };
  }

  const body = { symbol, ohlc, currentPrice: currentPrice ?? ohlc.at(-1)?.c, assetClass };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { response, error } = await makeSignalRequest(body);

    if (error) {
      console.error(`[SignalService] Attempt ${attempt + 1} failed:`, error.message);
      if (attempt < maxRetries) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      return { success: false, error: error.message };
    }

    if (!response) {
      return { success: false, error: "No response received" };
    }

    if (response.status === 429) {
      await handleRateLimit(response);
      continue;
    }

    const json: SignalResponse = await response.json();
    return processSuccessResponse(symbol, json, response);
  }

  return { success: false, error: "Max retries exceeded" };
}

/**
 * Fetch signal with pre-computed indicators (legacy)
 */
export async function fetchLegacySignal(params: {
  symbol: string;
  rsi: number;
  macdLine: number;
  signalLine: number;
  histogram: number;
  price: number;
  ema20: number;
  ema50: number;
  atr: number;
}): Promise<SignalResponse> {
  try {
    const response = await fetch(SIGNAL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const json = await response.json();
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Clear signal cache for a symbol
 */
export function clearSignalCache(symbol?: string): void {
  if (symbol) {
    signalCache.delete(getCacheKey(symbol));
  } else {
    signalCache.clear();
  }
}

/**
 * Get rate limit status from last request
 */
let lastRateLimitStatus: {
  remaining: number;
  resetAt: number;
} | null = null;

export function getRateLimitStatus(): typeof lastRateLimitStatus {
  return lastRateLimitStatus;
}

// Type augmentation for global API token
declare global {
  var __API_TOKEN__: string | undefined;
}

export default {
  fetchSignal,
  fetchLegacySignal,
  clearSignalCache,
  getRateLimitStatus,
};
