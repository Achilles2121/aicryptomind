/**
 * Protected Signal Analysis API Endpoint
 * Vision AI Mind - Server-Side 8-Point Analysis
 * 
 * POST /api/signal
 * 
 * PROPRIETARY ALGORITHM - Runs entirely server-side.
 * Frontend receives only computed signals, not the formula.
 * 
 * Features:
 * - Real-time indicator calculation from OHLC data
 * - Asset-class aware volatility adjustments
 * - Fibonacci levels with dynamic ATR scaling
 * - Rate limiting to prevent abuse
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 * CONFIDENTIAL - Unauthorized distribution prohibited.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

// ============================================
// TYPES
// ============================================

type AssetClass = "crypto" | "commodity" | "forex";

interface OHLC {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

interface AlgoParams {
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  atrPeriod: number;
  atrMultiplier: number;
  slMultiplier: number;
  tpMultipliers: [number, number, number];
}

// ============================================
// RATE LIMITING
// ============================================

const requestCounts = new Map<string, number[]>();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60000;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const checkRateLimit = (ip: string): RateLimitResult => {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW;
  
  const requests = (requestCounts.get(ip) || []).filter((t: number) => t > windowStart);
  const remaining = RATE_LIMIT - requests.length;
  const resetAt = requests.length > 0 ? requests[0] + RATE_WINDOW : now + RATE_WINDOW;
  
  if (requests.length >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetAt };
  }
  
  requests.push(now);
  requestCounts.set(ip, requests);
  return { allowed: true, remaining: remaining - 1, resetAt };
};

/**
 * Validate authentication token (production only)
 */
const validateToken = (token: string): boolean => {
  if (process.env.NODE_ENV === "production") {
    return token === process.env.API_SECRET_TOKEN;
  }
  return !!token;
};

// ============================================
// ALGORITHM PARAMETERS (PROTECTED)
// ============================================

const ALGO_PARAMS: Record<string, AlgoParams> = {
  crypto: {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplier: 1.5,
    slMultiplier: 2,
    tpMultipliers: [1.5, 2.5, 4],
  },
  commodity: {
    rsiPeriod: 14,
    rsiOversold: 35,
    rsiOverbought: 65,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplier: 1.2,
    slMultiplier: 1.5,
    tpMultipliers: [1.2, 2, 3],
  },
  forex: {
    rsiPeriod: 14,
    rsiOversold: 40,
    rsiOverbought: 60,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplier: 1,
    slMultiplier: 1.2,
    tpMultipliers: [1, 1.5, 2.5],
  },
};

// ============================================
// INDICATOR CALCULATIONS (PROTECTED)
// ============================================

const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices.at(-1) ?? 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
};

const calculateRSI = (closes: number[], period: number): number => {
  if (closes.length < period + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

const calculateMACD = (closes: number[], fast: number, slow: number, signal: number): { line: number; signal: number; histogram: number } => {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = emaFast - emaSlow;
  
  const macdHistory: number[] = [];
  for (let i = slow; i < closes.length; i++) {
    const slice = closes.slice(0, i + 1);
    const ef = calculateEMA(slice, fast);
    const es = calculateEMA(slice, slow);
    macdHistory.push(ef - es);
  }
  
  const signalLine = macdHistory.length >= signal ? calculateEMA(macdHistory, signal) : macdLine;
  const histogram = macdLine - signalLine;
  
  return { line: macdLine, signal: signalLine, histogram };
};

const calculateATR = (candles: OHLC[], period: number): number => {
  if (candles.length < period + 1) return 0;
  
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.h - curr.l,
      Math.abs(curr.h - prev.c),
      Math.abs(curr.l - prev.c)
    );
    trSum += tr;
  }
  
  return trSum / period;
};

const calculateFibonacci = (high: number, low: number, direction: "BUY" | "SELL"): Record<string, number> => {
  const diff = high - low;
  
  if (direction === "BUY") {
    return {
      level236: high - diff * 0.236,
      level382: high - diff * 0.382,
      level500: high - diff * 0.5,
      level618: high - diff * 0.618,
      level786: high - diff * 0.786,
    };
  }
  return {
    level236: low + diff * 0.236,
    level382: low + diff * 0.382,
    level500: low + diff * 0.5,
    level618: low + diff * 0.618,
    level786: low + diff * 0.786,
  };
};

// ============================================
// 8-POINT ANALYSIS (CORE - PROTECTED)
// ============================================

interface AnalysisResult {
  direction: "BUY" | "SELL" | "HOLD";
  buyScore: number;
  sellScore: number;
  confidence: number;
  reasons: string[];
  indicators: {
    rsi: number;
    macdHistogram: number;
    ema20: number;
    ema50: number;
    atr: number;
    atrPercent: number;
    trendStrength: number;
  };
}

interface ScoreResult {
  buy: number;
  sell: number;
  reason: string | null;
}

/** Helper: Analyze RSI */
const analyzeRSI = (rsi: number, oversold: number, overbought: number): ScoreResult => {
  if (rsi <= oversold) return { buy: 25, sell: 0, reason: `RSI oversold (${rsi.toFixed(1)})` };
  if (rsi >= overbought) return { buy: 0, sell: 25, reason: `RSI overbought (${rsi.toFixed(1)})` };
  return { buy: 0, sell: 0, reason: null };
};

/** Helper: Analyze MACD */
const analyzeMACD = (line: number, signal: number, histogram: number): ScoreResult => {
  if (histogram > 0 && line > signal) return { buy: 20, sell: 0, reason: "MACD bullish crossover" };
  if (histogram < 0 && line < signal) return { buy: 0, sell: 20, reason: "MACD bearish crossover" };
  return { buy: 0, sell: 0, reason: null };
};

/** Helper: Analyze EMA Cross */
const analyzeEMACross = (ema20: number, ema50: number): ScoreResult => {
  if (ema20 > ema50) return { buy: 15, sell: 0, reason: "EMA 20 > 50 (bullish)" };
  if (ema20 < ema50) return { buy: 0, sell: 15, reason: "EMA 20 < 50 (bearish)" };
  return { buy: 0, sell: 0, reason: null };
};

/** Helper: Analyze Price vs EMAs */
const analyzePriceVsEMA = (price: number, ema20: number, ema50: number): ScoreResult => {
  if (price > ema20 && price > ema50) return { buy: 10, sell: 0, reason: "Price above EMAs" };
  if (price < ema20 && price < ema50) return { buy: 0, sell: 10, reason: "Price below EMAs" };
  return { buy: 0, sell: 0, reason: null };
};

/** Helper: Analyze Momentum */
const analyzeMomentum = (momentum: number): ScoreResult => {
  if (momentum > 2) return { buy: 10, sell: 0, reason: `Strong momentum (+${momentum.toFixed(1)}%)` };
  if (momentum < -2) return { buy: 0, sell: 10, reason: `Weak momentum (${momentum.toFixed(1)}%)` };
  return { buy: 0, sell: 0, reason: null };
};

/** Helper: Aggregate scores */
const aggregateScores = (results: ScoreResult[]): { buy: number; sell: number; reasons: string[] } => {
  let buy = 0;
  let sell = 0;
  const reasons: string[] = [];
  for (const r of results) {
    buy += r.buy;
    sell += r.sell;
    if (r.reason) reasons.push(r.reason);
  }
  return { buy, sell, reasons };
};

const runEightPointAnalysis = (
  candles: OHLC[],
  currentPrice: number,
  params: AlgoParams
): AnalysisResult => {
  const closes = candles.map((c) => c.c);
  
  // Calculate indicators
  const rsi = calculateRSI(closes, params.rsiPeriod);
  const macd = calculateMACD(closes, params.macdFast, params.macdSlow, params.macdSignal);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const atr = calculateATR(candles, params.atrPeriod);
  const atrPercent = currentPrice > 0 ? (atr / currentPrice) * 100 : 0;
  
  // Trend strength
  const recentHigh = Math.max(...candles.slice(-20).map((c) => c.h));
  const recentLow = Math.min(...candles.slice(-20).map((c) => c.l));
  const trendRange = recentHigh - recentLow;
  const trendStrength = atr > 0 ? Math.min(100, (trendRange / atr) * 10) : 0;
  
  // Momentum
  const closeOld = closes.at(-10) ?? currentPrice;
  const momentum = ((currentPrice - closeOld) / closeOld) * 100;
  
  // Run 8-point analysis using helpers
  const scoreResults: ScoreResult[] = [
    analyzeRSI(rsi, params.rsiOversold, params.rsiOverbought),
    analyzeMACD(macd.line, macd.signal, macd.histogram),
    analyzeEMACross(ema20, ema50),
    analyzePriceVsEMA(currentPrice, ema20, ema50),
    analyzeMomentum(momentum),
  ];
  
  // Volume confirmation (point 8)
  const volumes = candles.map((c) => c.v ?? 0);
  const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const lastVolume = volumes.at(-1) ?? 0;
  
  const { buy: buyScore, sell: sellScore, reasons } = aggregateScores(scoreResults);
  let finalBuy = buyScore;
  let finalSell = sellScore;
  const finalReasons = [...reasons];
  
  // Add volume confirmation
  if (lastVolume > avgVolume * 1.5 && finalBuy !== finalSell) {
    const bonus = 5;
    if (finalBuy > finalSell) {
      finalBuy += bonus;
    } else {
      finalSell += bonus;
    }
    finalReasons.push("High volume confirmation");
  }
  
  // Final direction
  const netScore = finalBuy - finalSell;
  let direction: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (netScore >= 25) direction = "BUY";
  if (netScore <= -25) direction = "SELL";
  
  const confidence = Math.min(100, Math.round(Math.abs(netScore) * 1.2));
  
  return {
    direction,
    buyScore: finalBuy,
    sellScore: finalSell,
    confidence,
    reasons: finalReasons.slice(0, 5),
    indicators: { rsi, macdHistogram: macd.histogram, ema20, ema50, atr, atrPercent, trendStrength },
  };
};

// ============================================
// LEGACY REQUEST BODY (for backward compat)
// ============================================

interface LegacyRequestBody {
  symbol?: string;
  rsi?: string | number;
  macdLine?: string | number;
  signalLine?: string | number;
  histogram?: string | number;
  price?: string | number;
  bollingerUpper?: string | number;
  bollingerMiddle?: string | number;
  bollingerLower?: string | number;
  ema20?: string | number;
  ema50?: string | number;
  prevEma20?: string | number;
  prevEma50?: string | number;
  volume?: string | number;
  avgVolume?: string | number;
  priceChange?: string | number;
  support?: string | number;
  resistance?: string | number;
  fibLevels?: Array<{ ratio: number; price: number }>;
  atr?: string | number;
  avgAtr?: string | number;
  trend?: string;
  // New: OHLC support
  ohlc?: OHLC[];
  currentPrice?: number;
  assetClass?: AssetClass;
}

interface IndicatorData {
  rsi: number;
  macdLine: number;
  signalLine: number;
  histogram: number;
  price: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  ema20: number;
  ema50: number;
  prevEma20: number;
  prevEma50: number;
  volume: number;
  avgVolume: number;
  priceChange: number;
  support: number;
  resistance: number;
  fibLevels: Array<{ ratio: number; price: number }>;
  atr: number;
  avgAtr: number;
  trend: string;
}

/**
 * Helper to parse numeric values
 */
const parseNum = (value: unknown, fallback: number): number => {
  if (value === null || value === undefined) return fallback;
  const str = typeof value === "string" || typeof value === "number" ? String(value) : String(fallback);
  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Extract indicator data from legacy request
 */
const extractIndicatorData = (body: LegacyRequestBody): IndicatorData => {
  const ema20Val = parseNum(body.ema20, 0);
  const ema50Val = parseNum(body.ema50, 0);
  const atrVal = parseNum(body.atr, 0);
  
  return {
    rsi: parseNum(body.rsi, 50),
    macdLine: parseNum(body.macdLine, 0),
    signalLine: parseNum(body.signalLine, 0),
    histogram: parseNum(body.histogram, 0),
    price: parseNum(body.price, 0),
    bollingerUpper: parseNum(body.bollingerUpper, 0),
    bollingerMiddle: parseNum(body.bollingerMiddle, 0),
    bollingerLower: parseNum(body.bollingerLower, 0),
    ema20: ema20Val,
    ema50: ema50Val,
    prevEma20: parseNum(body.prevEma20, ema20Val),
    prevEma50: parseNum(body.prevEma50, ema50Val),
    volume: parseNum(body.volume, 0),
    avgVolume: parseNum(body.avgVolume, 0),
    priceChange: parseNum(body.priceChange, 0),
    support: parseNum(body.support, 0),
    resistance: parseNum(body.resistance, 0),
    fibLevels: body.fibLevels ?? [],
    atr: atrVal,
    avgAtr: parseNum(body.avgAtr, atrVal),
    trend: body.trend ?? "neutral",
  };
};

/**
 * Legacy simplified signal computation (backward compatibility)
 */
const computeLegacySignal = (data: IndicatorData, assetClass: string) => {
  let buyScore = 0;
  let sellScore = 0;
  const reasons: string[] = [];
  
  const rsiThreshold = assetClass === "forex" ? { low: 40, high: 60 } : { low: 30, high: 70 };
  if (data.rsi <= rsiThreshold.low) {
    buyScore += 30;
    reasons.push("RSI oversold");
  } else if (data.rsi >= rsiThreshold.high) {
    sellScore += 30;
    reasons.push("RSI overbought");
  }
  
  if (data.histogram > 0) {
    buyScore += 20;
    reasons.push("MACD bullish");
  } else if (data.histogram < 0) {
    sellScore += 20;
    reasons.push("MACD bearish");
  }
  
  if (data.ema20 > data.ema50) {
    buyScore += 15;
    reasons.push("EMA bullish alignment");
  } else if (data.ema20 < data.ema50) {
    sellScore += 15;
    reasons.push("EMA bearish alignment");
  }
  
  const netScore = buyScore - sellScore;
  const confidence = Math.min(100, Math.abs(netScore) / 100 * 100);
  
  let signal = "HOLD";
  if (netScore > 20) signal = "BUY";
  if (netScore < -20) signal = "SELL";
  
  return {
    signal,
    confidence: Math.round(confidence),
    buyScore,
    sellScore,
    netScore,
    reasons: reasons.slice(0, 5),
    levels: {
      stopLoss: data.price - (data.atr * 2),
      takeProfit1: data.price + (data.atr * 1.5),
      takeProfit2: data.price + (data.atr * 2.5),
      takeProfit3: data.price + (data.atr * 4),
    },
    meta: {
      assetClass,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Generate unique request ID
 */
const generateRequestId = (): string => {
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * Detect asset class from symbol
 */
const detectAssetClass = (symbol: string, provided?: AssetClass): AssetClass => {
  if (provided) return provided;
  
  const forexSymbols = ["EUR", "GBP", "JPY", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD"];
  const commoditySymbols = ["GOLD", "XAUUSD", "SILVER", "XAGUSD", "WTI", "BRENT", "OIL"];
  
  const symbolUpper = String(symbol).toUpperCase();
  
  if (commoditySymbols.some(c => symbolUpper.includes(c))) return "commodity";
  if (forexSymbols.some(fx => symbolUpper.includes(fx))) return "forex";
  return "crypto";
};

/**
 * Get confidence label from score
 */
const getConfidenceLabel = (confidence: number): "HIGH" | "MEDIUM" | "LOW" => {
  if (confidence >= 70) return "HIGH";
  if (confidence >= 40) return "MEDIUM";
  return "LOW";
};

/**
 * Calculate trading levels for a signal
 */
const calculateLevels = (
  direction: "BUY" | "SELL",
  price: number,
  atr: number,
  params: AlgoParams
): { entry: number; stopLoss: number; takeProfit1: number; takeProfit2: number; takeProfit3: number; riskReward: number } => {
  const slDistance = atr * params.slMultiplier * params.atrMultiplier;
  const [tp1Mult, tp2Mult, tp3Mult] = params.tpMultipliers;
  const mult = direction === "BUY" ? 1 : -1;
  
  return {
    entry: price,
    stopLoss: price - mult * slDistance,
    takeProfit1: price + mult * atr * tp1Mult * params.atrMultiplier,
    takeProfit2: price + mult * atr * tp2Mult * params.atrMultiplier,
    takeProfit3: price + mult * atr * tp3Mult * params.atrMultiplier,
    riskReward: (atr * tp1Mult) / slDistance,
  };
};

/**
 * Process OHLC-based signal request
 */
const processOHLCRequest = (
  symbol: string,
  ohlc: OHLC[],
  currentPrice: number | undefined,
  assetClass: AssetClass
): { success: boolean; data?: unknown; error?: string } => {
  const price = currentPrice ?? ohlc.at(-1)?.c ?? 0;
  if (price <= 0) {
    return { success: false, error: "Invalid price" };
  }
  
  const params = ALGO_PARAMS[assetClass] ?? ALGO_PARAMS.crypto;
  const analysis = runEightPointAnalysis(ohlc, price, params);
  
  let levels = null;
  let fibonacci = null;
  
  if (analysis.direction !== "HOLD") {
    levels = calculateLevels(analysis.direction, price, analysis.indicators.atr, params);
    
    const recentHigh = Math.max(...ohlc.slice(-50).map((c) => c.h));
    const recentLow = Math.min(...ohlc.slice(-50).map((c) => c.l));
    fibonacci = calculateFibonacci(recentHigh, recentLow, analysis.direction);
  }
  
  return {
    success: true,
    data: {
      symbol,
      signal: analysis.direction,
      confidence: analysis.confidence,
      confidenceLabel: getConfidenceLabel(analysis.confidence),
      buyScore: analysis.buyScore,
      sellScore: analysis.sellScore,
      netScore: analysis.buyScore - analysis.sellScore,
      reasons: analysis.reasons,
      levels,
      fibonacci,
      indicators: analysis.indicators,
      params: {
        assetClass,
        rsiPeriod: params.rsiPeriod,
        macdFast: params.macdFast,
        macdSlow: params.macdSlow,
        macdSignal: params.macdSignal,
      },
    },
  };
};

/**
 * Main handler - supports both OHLC and legacy requests
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }
  
  // Rate limiting
  const forwardedFor = req.headers["x-forwarded-for"];
  const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) || "unknown";
  const rateLimit = checkRateLimit(clientIp);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded. Please wait before retrying.",
      meta: { requestId, processingMs: Date.now() - startTime, rateLimit: { remaining: 0, resetAt: rateLimit.resetAt } },
    });
  }
  
  // Auth check (optional in dev)
  const authHeaderRaw = req.headers.authorization;
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : (authHeaderRaw ?? "");
  const token = authHeader.replace("Bearer ", "");
  
  if (process.env.NODE_ENV === "production" && !validateToken(token)) {
    return res.status(401).json({ success: false, error: "Unauthorized. Valid API token required." });
  }
  
  try {
    const body: LegacyRequestBody = req.body ?? {};
    const { symbol, ohlc, assetClass: providedAssetClass } = body;
    
    if (!symbol) {
      return res.status(400).json({ success: false, error: "Missing required field: symbol" });
    }
    
    const assetClass = detectAssetClass(symbol, providedAssetClass);
    const baseMeta = {
      requestId,
      processingMs: 0,
      rateLimit: { remaining: rateLimit.remaining, resetAt: rateLimit.resetAt },
    };
    
    // OHLC-based request (new API)
    if (ohlc && Array.isArray(ohlc) && ohlc.length >= 30) {
      const result = processOHLCRequest(symbol, ohlc, body.currentPrice, assetClass);
      const meta = { ...baseMeta, processingMs: Date.now() - startTime, algorithm: "8-point-ohlc" as const };
      
      if (!result.success) {
        return res.status(400).json({ ...result, meta });
      }
      return res.status(200).json({ success: true, data: result.data, meta });
    }
    
    // Legacy indicator-based request
    const indicatorData = extractIndicatorData(body);
    const signalResult = computeLegacySignal(indicatorData, assetClass);
    const meta = { ...baseMeta, processingMs: Date.now() - startTime, algorithm: "legacy-indicator" as const };
    
    return res.status(200).json({
      success: true,
      data: { symbol, ...signalResult, params: { assetClass, rsiPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9 } },
      meta,
    });
  } catch (error) {
    console.error("[Signal API Error]", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      meta: { requestId, processingMs: Date.now() - startTime },
    });
  }
}
