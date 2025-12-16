/**
 * Vision AI Mind - Elite Trader Signal Logic V4
 * 
 * Advanced signal generation with:
 * - Market Structure Shift (MSS) Detection
 * - Volume Spread Analysis (VSA)
 * - Smart Money / Liquidity Sweep Detection
 * - Dynamic TP/SL based on ATR & Market Structure
 * 
 * Scoring Weights:
 * - 40% Market Structure (HH/HL/LH/LL patterns)
 * - 20% Volume/VSA (absorption, climax, no-demand)
 * - 20% Smart Money (liquidity sweeps, institutional footprints)
 * - 20% Technical Indicators (RSI, MACD, trend)
 * 
 * (c) Vision AI Mind - Elite Trader
 */

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface OHLCCandle {
  t: number;       // timestamp
  o: number;       // open
  h: number;       // high
  l: number;       // low
  c: number;       // close
  v: number;       // volume
  time?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
}

export interface IndicatorRow extends OHLCCandle {
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  ema9?: number;
  ema21?: number;
  ema50?: number;
  atr?: number;
  atrPct?: number;
  vwap?: number;
  bollUpper?: number;
  bollLower?: number;
  bollMid?: number;
  avgVolume?: number;
  volumeRatio?: number;
}

export type Direction = "long" | "short" | "wait";
export type SetupType = "mss" | "liquidity_sweep" | "vsa_absorption" | "breakout" | "reversion" | "trend";

export interface MarketStructure {
  pattern: "HH" | "HL" | "LH" | "LL" | "neutral";
  bias: "bullish" | "bearish" | "neutral";
  lastSwingHigh: number;
  lastSwingLow: number;
  structureBreak: boolean;
  mssDetected: boolean;
  mssDirection: Direction;
}

export interface VSAResult {
  type: "absorption" | "climax" | "no_demand" | "no_supply" | "neutral";
  strength: number;      // 0-1
  volumeRatio: number;
  spreadRatio: number;
  signal: Direction;
}

export interface LiquiditySweep {
  detected: boolean;
  type: "buy_side" | "sell_side" | "none";
  sweepLevel: number;
  recoveryStrength: number;
  signal: Direction;
}

export interface SignalV4Result {
  action: Direction;
  confidence: number;    // 0-1
  reason: string;
  setup: SetupType | null;
  tp: number | null;
  sl: number | null;
  rrRatio: number | null;
  ultra: boolean;
  meta: {
    marketStructure: MarketStructure;
    vsa: VSAResult;
    liquiditySweep: LiquiditySweep;
    scores: {
      structure: number;
      volume: number;
      smartMoney: number;
      indicators: number;
      total: number;
    };
    regime: string;
    atrPct: number;
    rsi: number | null;
    macdHistogram: number | null;
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const clamp = (val: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, val));

const avg = (arr: number[]): number => 
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

const getNum = (val: unknown, fallback: number = 0): number => 
  typeof val === "number" && Number.isFinite(val) ? val : fallback;

// ============================================
// MARKET STRUCTURE ANALYSIS
// ============================================

/**
 * Find swing highs and lows in price data
 * A swing high is a candle with lower highs on both sides
 * A swing low is a candle with higher lows on both sides
 */
function findSwingPoints(candles: OHLCCandle[], lookback: number = 5): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;
    
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].h >= current.h || candles[i + j].h >= current.h) {
        isSwingHigh = false;
      }
      if (candles[i - j].l <= current.l || candles[i + j].l <= current.l) {
        isSwingLow = false;
      }
    }
    
    if (isSwingHigh) highs.push(current.h);
    if (isSwingLow) lows.push(current.l);
  }
  
  return { highs, lows };
}

/**
 * Analyze Market Structure - Detect HH/HL/LH/LL patterns
 * Market Structure Shift (MSS) = Change from bullish to bearish or vice versa
 */
export function analyzeMarketStructure(candles: OHLCCandle[], lookback: number = 20): MarketStructure {
  if (candles.length < lookback + 5) {
    return {
      pattern: "neutral",
      bias: "neutral",
      lastSwingHigh: 0,
      lastSwingLow: 0,
      structureBreak: false,
      mssDetected: false,
      mssDirection: "wait",
    };
  }
  
  const recentCandles = candles.slice(-lookback - 5);
  const { highs, lows } = findSwingPoints(recentCandles, 3);
  
  const lastSwingHigh = highs.length ? highs[highs.length - 1] : candles[candles.length - 1].h;
  const lastSwingLow = lows.length ? lows[lows.length - 1] : candles[candles.length - 1].l;
  const prevSwingHigh = highs.length > 1 ? highs[highs.length - 2] : lastSwingHigh;
  const prevSwingLow = lows.length > 1 ? lows[lows.length - 2] : lastSwingLow;
  
  const currentPrice = candles[candles.length - 1].c;
  
  // Determine pattern
  let pattern: MarketStructure["pattern"] = "neutral";
  let bias: MarketStructure["bias"] = "neutral";
  
  if (lastSwingHigh > prevSwingHigh && lastSwingLow > prevSwingLow) {
    pattern = "HH";
    bias = "bullish";
  } else if (lastSwingHigh > prevSwingHigh && lastSwingLow <= prevSwingLow) {
    pattern = "HL";
    bias = "bullish";
  } else if (lastSwingHigh <= prevSwingHigh && lastSwingLow > prevSwingLow) {
    pattern = "LH";
    bias = "bearish";
  } else if (lastSwingHigh < prevSwingHigh && lastSwingLow < prevSwingLow) {
    pattern = "LL";
    bias = "bearish";
  }
  
  // Detect structure break
  const structureBreak = currentPrice > lastSwingHigh || currentPrice < lastSwingLow;
  
  // Market Structure Shift (MSS) - Price breaks structure in opposite direction
  let mssDetected = false;
  let mssDirection: Direction = "wait";
  
  if (bias === "bearish" && currentPrice > lastSwingHigh) {
    mssDetected = true;
    mssDirection = "long";
  } else if (bias === "bullish" && currentPrice < lastSwingLow) {
    mssDetected = true;
    mssDirection = "short";
  }
  
  return {
    pattern,
    bias,
    lastSwingHigh,
    lastSwingLow,
    structureBreak,
    mssDetected,
    mssDirection,
  };
}

// ============================================
// VOLUME SPREAD ANALYSIS (VSA)
// ============================================

/**
 * Volume Spread Analysis - Detect institutional footprints
 * - Absorption: Large volume + small spread = institutions absorbing
 * - Climax: Extreme volume + large spread = exhaustion
 * - No Demand: Small volume + narrow spread up = weak buyers
 * - No Supply: Small volume + narrow spread down = weak sellers
 */
export function computeVSA(candles: IndicatorRow[], lookback: number = 20): VSAResult {
  if (candles.length < lookback + 1) {
    return {
      type: "neutral",
      strength: 0,
      volumeRatio: 1,
      spreadRatio: 1,
      signal: "wait",
    };
  }
  
  const recent = candles.slice(-lookback - 1);
  const current = recent[recent.length - 1];
  const historical = recent.slice(0, -1);
  
  // Calculate averages
  const avgVolume = avg(historical.map(c => c.v));
  const avgSpread = avg(historical.map(c => Math.abs(c.h - c.l)));
  
  const currentVolume = current.v;
  const currentSpread = Math.abs(current.h - current.l);
  const isUp = current.c > current.o;
  
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const spreadRatio = avgSpread > 0 ? currentSpread / avgSpread : 1;
  // bodyToSpread reserved for future VSA enhancements
  
  let type: VSAResult["type"] = "neutral";
  let strength = 0;
  let signal: Direction = "wait";
  
  // Absorption: High volume + small spread (price held despite volume)
  if (volumeRatio > 1.5 && spreadRatio < 0.7) {
    type = "absorption";
    strength = clamp((volumeRatio - 1.5) / 1.5 + (0.7 - spreadRatio), 0, 1);
    signal = isUp ? "short" : "long"; // Reversal expected
  }
  
  // Climax: Extreme volume + large spread (exhaustion)
  else if (volumeRatio > 2.0 && spreadRatio > 1.5) {
    type = "climax";
    strength = clamp((volumeRatio - 2) / 2 + (spreadRatio - 1.5) / 1.5, 0, 1);
    signal = isUp ? "short" : "long"; // Reversal expected
  }
  
  // No Demand: Low volume + small up bar
  else if (volumeRatio < 0.6 && spreadRatio < 0.6 && isUp) {
    type = "no_demand";
    strength = clamp((0.6 - volumeRatio) + (0.6 - spreadRatio), 0, 1);
    signal = "short";
  }
  
  // No Supply: Low volume + small down bar
  else if (volumeRatio < 0.6 && spreadRatio < 0.6 && !isUp) {
    type = "no_supply";
    strength = clamp((0.6 - volumeRatio) + (0.6 - spreadRatio), 0, 1);
    signal = "long";
  }
  
  return { type, strength, volumeRatio, spreadRatio, signal };
}

// ============================================
// LIQUIDITY SWEEP DETECTION
// ============================================

/**
 * Detect Liquidity Sweeps (Stop Hunts)
 * - Buy-side sweep: Price spikes above recent highs then reverses
 * - Sell-side sweep: Price dips below recent lows then reverses
 */
export function detectLiquiditySweep(candles: OHLCCandle[], lookback: number = 10): LiquiditySweep {
  if (candles.length < lookback + 2) {
    return {
      detected: false,
      type: "none",
      sweepLevel: 0,
      recoveryStrength: 0,
      signal: "wait",
    };
  }
  
  const current = candles[candles.length - 1];
  const historical = candles.slice(-lookback - 1, -1);
  
  const recentHighs = historical.map(c => c.h);
  const recentLows = historical.map(c => c.l);
  const maxHigh = Math.max(...recentHighs);
  const minLow = Math.min(...recentLows);
  
  const currentRange = current.h - current.l;
  const isGreenCandle = current.c > current.o;
  const isRedCandle = current.c < current.o;
  
  // Sell-side sweep (Stop hunt below lows, then recovery)
  // Price wicks below recent lows but closes back above
  if (current.l < minLow && current.c > minLow && isGreenCandle) {
    const recovery = current.c - current.l;
    const recoveryStrength = currentRange > 0 ? recovery / currentRange : 0;
    
    if (recoveryStrength > 0.6) {
      return {
        detected: true,
        type: "sell_side",
        sweepLevel: minLow,
        recoveryStrength,
        signal: "long",
      };
    }
  }
  
  // Buy-side sweep (Stop hunt above highs, then reversal)
  // Price wicks above recent highs but closes back below
  if (current.h > maxHigh && current.c < maxHigh && isRedCandle) {
    const recovery = current.h - current.c;
    const recoveryStrength = currentRange > 0 ? recovery / currentRange : 0;
    
    if (recoveryStrength > 0.6) {
      return {
        detected: true,
        type: "buy_side",
        sweepLevel: maxHigh,
        recoveryStrength,
        signal: "short",
      };
    }
  }
  
  return {
    detected: false,
    type: "none",
    sweepLevel: 0,
    recoveryStrength: 0,
    signal: "wait",
  };
}

// ============================================
// TECHNICAL INDICATOR SCORING
// ============================================

interface IndicatorScore {
  score: number;       // -1 to 1 (bearish to bullish)
  signal: Direction;
  reasons: string[];
}

function computeIndicatorScore(row: IndicatorRow): IndicatorScore {
  const reasons: string[] = [];
  let totalScore = 0;
  let weights = 0;
  
  // RSI scoring
  const rsi = getNum(row.rsi, 50);
  if (rsi > 0) {
    let rsiScore = 0;
    if (rsi > 70) {
      rsiScore = -0.5 - (rsi - 70) / 60; // Overbought
      reasons.push(`RSI overbought (${rsi.toFixed(1)})`);
    } else if (rsi < 30) {
      rsiScore = 0.5 + (30 - rsi) / 60; // Oversold
      reasons.push(`RSI oversold (${rsi.toFixed(1)})`);
    } else if (rsi > 55) {
      rsiScore = (rsi - 50) / 40;
      reasons.push(`RSI bullish (${rsi.toFixed(1)})`);
    } else if (rsi < 45) {
      rsiScore = (rsi - 50) / 40;
      reasons.push(`RSI bearish (${rsi.toFixed(1)})`);
    }
    totalScore += rsiScore * 0.3;
    weights += 0.3;
  }
  
  // MACD scoring
  const macdHist = getNum(row.macdHistogram, 0);
  if (macdHist !== 0) {
    const macdScore = clamp(macdHist / 100, -1, 1);
    totalScore += macdScore * 0.3;
    weights += 0.3;
    reasons.push(`MACD ${macdHist > 0 ? "bullish" : "bearish"}`);
  }
  
  // EMA trend scoring
  const ema9 = getNum(row.ema9, 0);
  const ema21 = getNum(row.ema21, 0);
  const price = row.c;
  
  if (ema9 && ema21) {
    let emaScore = 0;
    if (price > ema9 && ema9 > ema21) {
      emaScore = 0.7;
      reasons.push("Strong uptrend (EMA aligned)");
    } else if (price < ema9 && ema9 < ema21) {
      emaScore = -0.7;
      reasons.push("Strong downtrend (EMA aligned)");
    } else if (price > ema21) {
      emaScore = 0.3;
    } else if (price < ema21) {
      emaScore = -0.3;
    }
    totalScore += emaScore * 0.25;
    weights += 0.25;
  }
  
  // VWAP scoring
  const vwap = getNum(row.vwap, 0);
  if (vwap > 0) {
    const vwapDiff = (price - vwap) / vwap;
    const vwapScore = clamp(vwapDiff * 10, -1, 1);
    totalScore += vwapScore * 0.15;
    weights += 0.15;
    reasons.push(`Price ${price > vwap ? "above" : "below"} VWAP`);
  }
  
  const finalScore = weights > 0 ? totalScore / weights : 0;
  const signal: Direction = finalScore > 0.2 ? "long" : finalScore < -0.2 ? "short" : "wait";
  
  return { score: clamp(finalScore, -1, 1), signal, reasons };
}

// ============================================
// DYNAMIC TP/SL CALCULATION
// ============================================

interface StopTarget {
  tp: number;
  sl: number;
  rrRatio: number;
}

function computeDynamicStops(
  entry: number,
  direction: Direction,
  atrPct: number,
  marketStructure: MarketStructure,
  vsa: VSAResult
): StopTarget {
  if (direction === "wait") {
    return { tp: 0, sl: 0, rrRatio: 0 };
  }
  
  // Base ATR multipliers
  let slMultiplier = 1.5;
  let tpMultiplier = 2.5;
  
  // Adjust based on market structure
  if (marketStructure.mssDetected) {
    tpMultiplier = 3.0; // MSS signals have higher potential
    slMultiplier = 1.2;
  }
  
  // Adjust based on VSA
  if (vsa.type === "climax") {
    tpMultiplier = 2.0; // Expect quick reversal
    slMultiplier = 1.0;
  } else if (vsa.type === "absorption") {
    tpMultiplier = 2.8;
    slMultiplier = 1.3;
  }
  
  // Adjust for volatility
  if (atrPct > 3) {
    slMultiplier *= 1.2; // Wider stops in high volatility
    tpMultiplier *= 1.1;
  } else if (atrPct < 1) {
    slMultiplier *= 0.8; // Tighter stops in low volatility
    tpMultiplier *= 0.9;
  }
  
  // Use structure levels if available
  const atrValue = entry * (atrPct / 100);
  let sl: number;
  let tp: number;
  
  if (direction === "long") {
    // SL below recent swing low or ATR-based
    sl = marketStructure.lastSwingLow > 0 && marketStructure.lastSwingLow < entry
      ? marketStructure.lastSwingLow * 0.998
      : entry - atrValue * slMultiplier;
    
    // TP at resistance or ATR-based
    tp = marketStructure.lastSwingHigh > entry
      ? marketStructure.lastSwingHigh * 1.002
      : entry + atrValue * tpMultiplier;
  } else {
    // SL above recent swing high or ATR-based
    sl = marketStructure.lastSwingHigh > entry
      ? marketStructure.lastSwingHigh * 1.002
      : entry + atrValue * slMultiplier;
    
    // TP at support or ATR-based
    tp = marketStructure.lastSwingLow > 0 && marketStructure.lastSwingLow < entry
      ? marketStructure.lastSwingLow * 0.998
      : entry - atrValue * tpMultiplier;
  }
  
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  const rrRatio = risk > 0 ? reward / risk : 1;
  
  return { tp, sl, rrRatio };
}

// ============================================
// REGIME DETECTION
// ============================================

function inferRegime(row: IndicatorRow): string {
  const atrPct = getNum(row.atrPct, 2);
  const rsi = getNum(row.rsi, 50);
  
  if (atrPct > 4) return "Volatile";
  if (atrPct < 1) return "Calm";
  if (rsi > 65) return "Bull";
  if (rsi < 35) return "Bear";
  return "Neutral";
}

// ============================================
// MAIN SIGNAL BUILDER - V4 ELITE LOGIC
// ============================================

export interface BuildSignalsV4Input {
  candles: IndicatorRow[];
  structureLookback?: number;
  vsaLookback?: number;
  sweepLookback?: number;
  minConfidence?: number;
}

export function buildSignalsV4(input: BuildSignalsV4Input): SignalV4Result {
  const {
    candles,
    structureLookback = 20,
    vsaLookback = 20,
    sweepLookback = 10,
    minConfidence = 0.55,
  } = input;
  
  const defaultResult: SignalV4Result = {
    action: "wait",
    confidence: 0.5,
    reason: "Insufficient data",
    setup: null,
    tp: null,
    sl: null,
    rrRatio: null,
    ultra: false,
    meta: {
      marketStructure: {
        pattern: "neutral",
        bias: "neutral",
        lastSwingHigh: 0,
        lastSwingLow: 0,
        structureBreak: false,
        mssDetected: false,
        mssDirection: "wait",
      },
      vsa: { type: "neutral", strength: 0, volumeRatio: 1, spreadRatio: 1, signal: "wait" },
      liquiditySweep: { detected: false, type: "none", sweepLevel: 0, recoveryStrength: 0, signal: "wait" },
      scores: { structure: 0, volume: 0, smartMoney: 0, indicators: 0, total: 0 },
      regime: "Unknown",
      atrPct: 0,
      rsi: null,
      macdHistogram: null,
    },
  };
  
  if (!candles || candles.length < Math.max(structureLookback, vsaLookback) + 5) {
    return defaultResult;
  }
  
  const current = candles[candles.length - 1];
  const entry = current.c;
  const atrPct = getNum(current.atrPct, 2);
  const regime = inferRegime(current);
  
  // ========== ANALYSIS ==========
  
  // 1. Market Structure (40% weight)
  const marketStructure = analyzeMarketStructure(candles, structureLookback);
  
  // 2. Volume Spread Analysis (20% weight)
  const vsa = computeVSA(candles, vsaLookback);
  
  // 3. Liquidity Sweep / Smart Money (20% weight)
  const liquiditySweep = detectLiquiditySweep(candles, sweepLookback);
  
  // 4. Technical Indicators (20% weight)
  const indicators = computeIndicatorScore(current);
  
  // ========== SCORING ==========
  
  // Structure score (40%)
  let structureScore = 0;
  let structureDirection: Direction = "wait";
  
  if (marketStructure.mssDetected) {
    structureScore = 0.9;
    structureDirection = marketStructure.mssDirection;
  } else if (marketStructure.structureBreak) {
    structureScore = 0.7;
    structureDirection = marketStructure.bias === "bullish" ? "long" : 
                        marketStructure.bias === "bearish" ? "short" : "wait";
  } else if (marketStructure.bias !== "neutral") {
    structureScore = 0.5;
    structureDirection = marketStructure.bias === "bullish" ? "long" : "short";
  }
  
  // Volume score (20%)
  let volumeScore = 0;
  if (vsa.type !== "neutral") {
    volumeScore = vsa.strength;
  }
  
  // Smart Money score (20%)
  let smartMoneyScore = 0;
  if (liquiditySweep.detected) {
    smartMoneyScore = liquiditySweep.recoveryStrength;
  }
  
  // Indicator score (20%)
  const indicatorScore = (indicators.score + 1) / 2; // Normalize to 0-1
  
  // ========== DIRECTION CONSENSUS ==========
  
  const votes: { direction: Direction; weight: number; source: string }[] = [];
  
  if (structureDirection !== "wait") {
    votes.push({ direction: structureDirection, weight: 0.4, source: "structure" });
  }
  if (vsa.signal !== "wait") {
    votes.push({ direction: vsa.signal, weight: 0.2, source: "vsa" });
  }
  if (liquiditySweep.signal !== "wait") {
    votes.push({ direction: liquiditySweep.signal, weight: 0.2, source: "sweep" });
  }
  if (indicators.signal !== "wait") {
    votes.push({ direction: indicators.signal, weight: 0.2, source: "indicators" });
  }
  
  // Calculate weighted direction
  let longWeight = 0;
  let shortWeight = 0;
  
  for (const vote of votes) {
    if (vote.direction === "long") longWeight += vote.weight;
    if (vote.direction === "short") shortWeight += vote.weight;
  }
  
  // Determine final direction
  let finalDirection: Direction = "wait";
  if (longWeight > shortWeight && longWeight > 0.3) {
    finalDirection = "long";
  } else if (shortWeight > longWeight && shortWeight > 0.3) {
    finalDirection = "short";
  }
  
  // ========== CONFIDENCE CALCULATION ==========
  
  const totalScore = 
    structureScore * 0.4 +
    volumeScore * 0.2 +
    smartMoneyScore * 0.2 +
    indicatorScore * 0.2;
  
  // Direction alignment bonus
  const alignmentBonus = Math.abs(longWeight - shortWeight) > 0.5 ? 0.1 : 0;
  
  // MSS bonus
  const mssBonus = marketStructure.mssDetected ? 0.1 : 0;
  
  // Liquidity sweep bonus
  const sweepBonus = liquiditySweep.detected ? 0.08 : 0;
  
  let confidence = clamp(totalScore + alignmentBonus + mssBonus + sweepBonus, 0.4, 0.95);
  
  // ========== SETUP TYPE DETERMINATION ==========
  
  let setup: SetupType | null = null;
  const reasons: string[] = [];
  
  if (marketStructure.mssDetected) {
    setup = "mss";
    reasons.push("Market Structure Shift detected");
  } else if (liquiditySweep.detected) {
    setup = "liquidity_sweep";
    reasons.push(`${liquiditySweep.type} liquidity sweep`);
  } else if (vsa.type === "absorption" || vsa.type === "climax") {
    setup = "vsa_absorption";
    reasons.push(`VSA ${vsa.type} detected`);
  } else if (marketStructure.structureBreak) {
    setup = "breakout";
    reasons.push("Structure breakout");
  } else if (marketStructure.bias !== "neutral") {
    setup = "trend";
    reasons.push(`${marketStructure.pattern} pattern`);
  }
  
  reasons.push(...indicators.reasons.slice(0, 2));
  
  // ========== FINAL DECISION ==========
  
  if (finalDirection === "wait" || confidence < minConfidence) {
    return {
      action: "wait",
      confidence,
      reason: confidence < minConfidence ? "Low confidence" : "No clear direction",
      setup: null,
      tp: null,
      sl: null,
      rrRatio: null,
      ultra: false,
      meta: {
        marketStructure,
        vsa,
        liquiditySweep,
        scores: {
          structure: structureScore,
          volume: volumeScore,
          smartMoney: smartMoneyScore,
          indicators: indicatorScore,
          total: totalScore,
        },
        regime,
        atrPct,
        rsi: getNum(current.rsi, 0) || null,
        macdHistogram: getNum(current.macdHistogram, 0) || null,
      },
    };
  }
  
  // Calculate stops
  const stops = computeDynamicStops(entry, finalDirection, atrPct, marketStructure, vsa);
  
  // Ultra signal: High confidence + multiple confirmations
  const ultra = confidence > 0.75 && 
                (marketStructure.mssDetected || liquiditySweep.detected) &&
                votes.filter(v => v.direction === finalDirection).length >= 3;
  
  return {
    action: finalDirection,
    confidence,
    reason: reasons.join(" | "),
    setup,
    tp: stops.tp,
    sl: stops.sl,
    rrRatio: stops.rrRatio,
    ultra,
    meta: {
      marketStructure,
      vsa,
      liquiditySweep,
      scores: {
        structure: structureScore,
        volume: volumeScore,
        smartMoney: smartMoneyScore,
        indicators: indicatorScore,
        total: totalScore,
      },
      regime,
      atrPct,
      rsi: getNum(current.rsi, 0) || null,
      macdHistogram: getNum(current.macdHistogram, 0) || null,
    },
  };
}

// ============================================
// BATCH SIGNAL ANALYSIS
// ============================================

/**
 * Analyze multiple timeframes and combine signals
 */
export function buildMultiTimeframeSignal(
  ltfCandles: IndicatorRow[],  // Lower timeframe (e.g., 15m)
  htfCandles: IndicatorRow[],  // Higher timeframe (e.g., 4H)
  minConfidence: number = 0.6
): SignalV4Result {
  const ltfSignal = buildSignalsV4({ candles: ltfCandles, minConfidence: 0.5 });
  const htfSignal = buildSignalsV4({ candles: htfCandles, minConfidence: 0.5 });
  
  // HTF must confirm LTF direction
  if (ltfSignal.action !== "wait" && 
      htfSignal.meta.marketStructure.bias !== "neutral") {
    
    const htfBias = htfSignal.meta.marketStructure.bias === "bullish" ? "long" : "short";
    
    if (ltfSignal.action === htfBias) {
      // Aligned - boost confidence
      const boostedConfidence = clamp(ltfSignal.confidence * 1.15, 0.5, 0.95);
      
      if (boostedConfidence >= minConfidence) {
        return {
          ...ltfSignal,
          confidence: boostedConfidence,
          reason: `MTF Aligned: ${ltfSignal.reason}`,
          ultra: ltfSignal.ultra || boostedConfidence > 0.8,
        };
      }
    }
  }
  
  // No alignment - return wait or LTF signal with reduced confidence
  if (ltfSignal.action !== "wait" && ltfSignal.confidence >= minConfidence) {
    return {
      ...ltfSignal,
      confidence: ltfSignal.confidence * 0.9,
      reason: `LTF Only: ${ltfSignal.reason}`,
    };
  }
  
  return {
    ...ltfSignal,
    action: "wait",
    reason: "No MTF alignment",
  };
}

// ============================================
// EXPORTS
// ============================================

export default buildSignalsV4;

// Vision AI Mind – Elite Trader
// (c) Vision AI – All rights reserved.
