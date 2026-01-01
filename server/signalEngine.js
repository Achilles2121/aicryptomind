/**
 * Protected Signal Engine
 * Vision AI Mind - Elite Trader Dashboard
 * 
 * PROPRIETARY 8-POINT ANALYSIS ALGORITHM
 * This module runs server-side to protect intellectual property.
 * Frontend receives only computed signals, not the formula.
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 * CONFIDENTIAL - Unauthorized distribution prohibited.
 */

import { GOLD_FOREX_ASSETS, getAssetClass, getVolatilityProfile } from "../src/config/supportedCoins.js";

// ============================================
// ALGORITHM PARAMETERS (PROTECTED)
// ============================================

/**
 * Volatility-adjusted RSI thresholds
 * Gold/Forex use tighter bands due to lower volatility
 */
const RSI_PARAMS = {
  crypto: { oversold: 30, overbought: 70, weight: 1.0 },
  commodity: { oversold: 35, overbought: 65, weight: 1.2 },
  forex: { oversold: 40, overbought: 60, weight: 0.8 },
};

/**
 * MACD signal interpretation weights
 */
const MACD_PARAMS = {
  crypto: { histogramWeight: 1.5, crossoverBonus: 2.0 },
  commodity: { histogramWeight: 1.2, crossoverBonus: 1.5 },
  forex: { histogramWeight: 1.0, crossoverBonus: 1.2 },
};

/**
 * ATR-based volatility scaling
 */
const ATR_PARAMS = {
  crypto: { multiplier: 1.5, stopLossFactor: 2.0 },
  commodity: { multiplier: 1.2, stopLossFactor: 1.5 },
  forex: { multiplier: 1.0, stopLossFactor: 1.2 },
};

// ============================================
// MARKET REGIME DETECTION (NEW)
// ============================================

/**
 * Market regime types and their parameter adjustments
 * The algorithm adapts based on current market conditions
 */
const REGIME_MODIFIERS = {
  // Strong uptrend - widen overbought, tighten oversold
  BULL_TREND: {
    rsiOversoldAdjust: -5,    // More aggressive buy signals
    rsiOverboughtAdjust: +10, // Wait longer before selling
    confidenceMultiplier: 1.2,
    trendWeight: 1.5,
  },
  // Strong downtrend - widen oversold, tighten overbought
  BEAR_TREND: {
    rsiOversoldAdjust: +10,   // Wait longer before buying
    rsiOverboughtAdjust: -5,  // More aggressive sell signals
    confidenceMultiplier: 1.2,
    trendWeight: 1.5,
  },
  // Range-bound/Sideways - tighter bands, lower confidence
  RANGE: {
    rsiOversoldAdjust: +5,
    rsiOverboughtAdjust: -5,
    confidenceMultiplier: 0.8,
    trendWeight: 0.5,
  },
  // High volatility - wider bands, higher confidence threshold
  HIGH_VOLATILITY: {
    rsiOversoldAdjust: -10,
    rsiOverboughtAdjust: +10,
    confidenceMultiplier: 0.9,
    trendWeight: 1.0,
  },
  // Low volatility/Consolidation - wait for breakout
  CONSOLIDATION: {
    rsiOversoldAdjust: 0,
    rsiOverboughtAdjust: 0,
    confidenceMultiplier: 0.6,
    trendWeight: 0.3,
  },
};

/**
 * Detect current market regime based on price action and indicators
 * @private
 */
const detectMarketRegime = (data) => {
  const { atr, avgAtr, ema20, ema50, price, priceChange, bollingerUpper, bollingerLower } = data;
  
  // Calculate volatility ratio
  const volatilityRatio = atr && avgAtr ? atr / avgAtr : 1.0;
  
  // Calculate trend strength
  const emaDiff = ema20 && ema50 ? (ema20 - ema50) / ema50 * 100 : 0;
  const priceVsEma = price && ema50 ? (price - ema50) / ema50 * 100 : 0;
  
  // Calculate Bollinger Band squeeze
  const bandWidth = bollingerUpper && bollingerLower && bollingerLower > 0 
    ? (bollingerUpper - bollingerLower) / bollingerLower * 100 
    : 5;
  
  // Regime detection logic
  if (volatilityRatio > 1.5) {
    return { regime: 'HIGH_VOLATILITY', modifier: REGIME_MODIFIERS.HIGH_VOLATILITY };
  }
  
  if (bandWidth < 2 && volatilityRatio < 0.8) {
    return { regime: 'CONSOLIDATION', modifier: REGIME_MODIFIERS.CONSOLIDATION };
  }
  
  if (emaDiff > 2 && priceVsEma > 3) {
    return { regime: 'BULL_TREND', modifier: REGIME_MODIFIERS.BULL_TREND };
  }
  
  if (emaDiff < -2 && priceVsEma < -3) {
    return { regime: 'BEAR_TREND', modifier: REGIME_MODIFIERS.BEAR_TREND };
  }
  
  return { regime: 'RANGE', modifier: REGIME_MODIFIERS.RANGE };
};

// ============================================
// 8-POINT ANALYSIS ALGORITHM (PROPRIETARY)
// ============================================

/**
 * The 8-Point Analysis combines:
 * 1. RSI (Relative Strength Index) - Momentum
 * 2. MACD (Moving Average Convergence Divergence) - Trend
 * 3. Bollinger Bands - Volatility
 * 4. EMA Cross (20/50) - Trend confirmation
 * 5. Volume Profile - Market participation
 * 6. Support/Resistance Levels - Price structure
 * 7. Fibonacci Retracement - Key levels
 * 8. Market Regime Detection - Context
 * 
 * Each point contributes to a weighted score.
 * The final signal is BUY, SELL, or HOLD based on composite score.
 */

/**
 * Calculate RSI contribution to signal
 * @private
 */
const calculateRsiSignal = (rsi, assetClass) => {
  const params = RSI_PARAMS[assetClass] || RSI_PARAMS.crypto;
  return calculateRsiSignalWithParams(rsi, params);
};

/**
 * Calculate RSI signal with custom parameters (for regime-adjusted thresholds)
 * @private
 */
const calculateRsiSignalWithParams = (rsi, params) => {
  if (rsi <= params.oversold) {
    // Oversold = bullish signal
    const strength = (params.oversold - rsi) / params.oversold;
    return { signal: "BUY", score: strength * (params.weight || 1.0) * 100, reason: `RSI oversold (${Math.round(rsi)})` };
  }
  
  if (rsi >= params.overbought) {
    // Overbought = bearish signal
    const strength = (rsi - params.overbought) / (100 - params.overbought);
    return { signal: "SELL", score: strength * (params.weight || 1.0) * 100, reason: `RSI overbought (${Math.round(rsi)})` };
  }
  
  // Neutral zone - but check for divergence potential
  const distanceToOversold = rsi - params.oversold;
  const distanceToOverbought = params.overbought - rsi;
  
  if (distanceToOversold < 10) {
    return { signal: "HOLD", score: 10, reason: `RSI approaching oversold (${Math.round(rsi)})` };
  }
  if (distanceToOverbought < 10) {
    return { signal: "HOLD", score: -10, reason: `RSI approaching overbought (${Math.round(rsi)})` };
  }
  
  return { signal: "HOLD", score: 0, reason: "RSI neutral" };
};

/**
 * Calculate MACD contribution to signal
 * @private
 */
const calculateMacdSignal = (macdLine, signalLine, histogram, assetClass) => {
  const params = MACD_PARAMS[assetClass] || MACD_PARAMS.crypto;
  let score = 0;
  let signal = "HOLD";
  const reasons = [];
  
  // Histogram direction
  if (histogram > 0) {
    score += histogram * params.histogramWeight;
    reasons.push("MACD histogram positive");
  } else if (histogram < 0) {
    score -= Math.abs(histogram) * params.histogramWeight;
    reasons.push("MACD histogram negative");
  }
  
  // MACD/Signal crossover
  const crossover = macdLine - signalLine;
  if (crossover > 0 && histogram > 0) {
    score += params.crossoverBonus;
    signal = "BUY";
    reasons.push("MACD bullish crossover");
  } else if (crossover < 0 && histogram < 0) {
    score -= params.crossoverBonus;
    signal = "SELL";
    reasons.push("MACD bearish crossover");
  }
  
  return { signal, score: Math.max(-100, Math.min(100, score * 10)), reason: reasons.join(", ") };
};

/**
 * Calculate Bollinger Band contribution
 * @private
 */
const calculateBollingerSignal = (price, upper, middle, lower) => {
  const bandWidth = upper - lower;
  if (bandWidth <= 0) return { signal: "HOLD", score: 0, reason: "Invalid bands" };
  
  const position = (price - lower) / bandWidth;
  
  if (position <= 0.1) {
    // Price at lower band = potential bounce
    return { signal: "BUY", score: (0.1 - position) * 500, reason: "Price at lower Bollinger" };
  }
  
  if (position >= 0.9) {
    // Price at upper band = potential reversal
    return { signal: "SELL", score: (position - 0.9) * 500, reason: "Price at upper Bollinger" };
  }
  
  return { signal: "HOLD", score: 0, reason: "Price within Bollinger bands" };
};

/**
 * Calculate EMA crossover signal
 * @private
 */
const calculateEmaCrossSignal = (ema20, ema50, prevEma20, prevEma50) => {
  const currentDiff = ema20 - ema50;
  const prevDiff = prevEma20 - prevEma50;
  
  // Golden cross (bullish)
  if (currentDiff > 0 && prevDiff <= 0) {
    return { signal: "BUY", score: 80, reason: "EMA golden cross" };
  }
  
  // Death cross (bearish)
  if (currentDiff < 0 && prevDiff >= 0) {
    return { signal: "SELL", score: 80, reason: "EMA death cross" };
  }
  
  // Trend continuation
  if (currentDiff > 0) {
    return { signal: "BUY", score: 20, reason: "EMA bullish alignment" };
  }
  
  if (currentDiff < 0) {
    return { signal: "SELL", score: 20, reason: "EMA bearish alignment" };
  }
  
  return { signal: "HOLD", score: 0, reason: "EMA neutral" };
};

/**
 * Calculate volume profile signal
 * @private
 */
const calculateVolumeSignal = (currentVolume, avgVolume, priceChange) => {
  if (!avgVolume || avgVolume <= 0) {
    return { signal: "HOLD", score: 0, reason: "No volume data" };
  }
  
  const volumeRatio = currentVolume / avgVolume;
  
  // High volume with price increase = bullish confirmation
  if (volumeRatio > 1.5 && priceChange > 0) {
    return { signal: "BUY", score: 60, reason: "High volume bullish" };
  }
  
  // High volume with price decrease = bearish confirmation
  if (volumeRatio > 1.5 && priceChange < 0) {
    return { signal: "SELL", score: 60, reason: "High volume bearish" };
  }
  
  // Low volume = weak signal
  if (volumeRatio < 0.5) {
    return { signal: "HOLD", score: -20, reason: "Low volume caution" };
  }
  
  return { signal: "HOLD", score: 0, reason: "Normal volume" };
};

/**
 * Calculate support/resistance proximity signal
 * @private
 */
const calculateSRSignal = (price, support, resistance) => {
  if (!support || !resistance || resistance <= support) {
    return { signal: "HOLD", score: 0, reason: "No S/R levels" };
  }
  
  const range = resistance - support;
  const positionInRange = (price - support) / range;
  
  // Near support (bottom 20%)
  if (positionInRange <= 0.2) {
    return { signal: "BUY", score: 50, reason: "Near support level" };
  }
  
  // Near resistance (top 20%)
  if (positionInRange >= 0.8) {
    return { signal: "SELL", score: 50, reason: "Near resistance level" };
  }
  
  return { signal: "HOLD", score: 0, reason: "Mid-range" };
};

/**
 * Calculate Fibonacci retracement signal
 * @private
 */
const calculateFibSignal = (price, fibLevels) => {
  if (!fibLevels || fibLevels.length === 0) {
    return { signal: "HOLD", score: 0, reason: "No Fib levels" };
  }
  
  // Check proximity to key Fib levels (0.382, 0.5, 0.618)
  const keyLevels = fibLevels.filter(f => 
    f.ratio === 0.382 || f.ratio === 0.5 || f.ratio === 0.618
  );
  
  for (const level of keyLevels) {
    const distance = Math.abs(price - level.price) / level.price;
    if (distance < 0.005) { // Within 0.5%
      if (level.ratio === 0.618) {
        return { signal: "BUY", score: 70, reason: "At 61.8% Fib (golden zone)" };
      }
      return { signal: "HOLD", score: 30, reason: `At ${level.ratio * 100}% Fib level` };
    }
  }
  
  return { signal: "HOLD", score: 0, reason: "Not near Fib levels" };
};

/**
 * Calculate market regime signal
 * @private
 */
const calculateRegimeSignal = (atr, avgAtr, trend) => {
  const volatilityRatio = atr / avgAtr;
  
  // High volatility trending market = strong signals
  if (volatilityRatio > 1.5 && trend !== "neutral") {
    return { 
      signal: trend === "up" ? "BUY" : "SELL", 
      score: 40, 
      reason: `High volatility ${trend} trend` 
    };
  }
  
  // Low volatility = range-bound, weaker signals
  if (volatilityRatio < 0.7) {
    return { signal: "HOLD", score: -30, reason: "Low volatility regime" };
  }
  
  return { signal: "HOLD", score: 0, reason: "Normal regime" };
};

// ============================================
// MAIN SIGNAL COMPUTATION (EXPORTED)
// ============================================

/**
 * Compute the 8-Point Analysis Signal
 * This is the main entry point for signal generation.
 * 
 * @param {Object} data - Market data containing indicators
 * @param {string} assetClass - Asset class (crypto, commodity, forex)
 * @returns {Object} Signal result with direction, confidence, and breakdown
 */
export const compute8PointSignal = (data, assetClass = "crypto") => {
  const {
    rsi,
    macdLine,
    signalLine,
    histogram,
    price,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    ema20,
    ema50,
    prevEma20,
    prevEma50,
    volume,
    avgVolume,
    priceChange,
    support,
    resistance,
    fibLevels,
    atr,
    avgAtr,
    trend,
  } = data;
  
  // NEW: Detect market regime and get dynamic modifiers
  const { regime, modifier } = detectMarketRegime(data);
  
  // Adjust RSI thresholds based on regime
  const adjustedRsiParams = {
    ...RSI_PARAMS[assetClass],
    oversold: (RSI_PARAMS[assetClass]?.oversold || 30) + modifier.rsiOversoldAdjust,
    overbought: (RSI_PARAMS[assetClass]?.overbought || 70) + modifier.rsiOverboughtAdjust,
  };
  
  // Calculate all 8 points with regime-adjusted parameters
  const points = [
    calculateRsiSignalWithParams(rsi, adjustedRsiParams),
    calculateMacdSignal(macdLine, signalLine, histogram, assetClass),
    calculateBollingerSignal(price, bollingerUpper, bollingerMiddle, bollingerLower),
    calculateEmaCrossSignal(ema20, ema50, prevEma20, prevEma50),
    calculateVolumeSignal(volume, avgVolume, priceChange),
    calculateSRSignal(price, support, resistance),
    calculateFibSignal(price, fibLevels),
    calculateRegimeSignal(atr, avgAtr, trend),
  ];
  
  // Aggregate scores
  let buyScore = 0;
  let sellScore = 0;
  const reasons = [];
  
  for (const point of points) {
    if (point.signal === "BUY") {
      buyScore += point.score;
      reasons.push(`+${point.reason}`);
    } else if (point.signal === "SELL") {
      sellScore += Math.abs(point.score);
      reasons.push(`-${point.reason}`);
    }
  }
  
  // Determine final signal
  const netScore = buyScore - sellScore;
  const maxPossibleScore = 500; // Theoretical maximum
  // Apply regime confidence multiplier
  const baseConfidence = Math.min(100, Math.abs(netScore) / maxPossibleScore * 100);
  const confidence = Math.min(100, baseConfidence * modifier.confidenceMultiplier);
  
  let finalSignal = "HOLD";
  // Adjust threshold based on regime (range-bound needs stronger signals)
  const signalThreshold = regime === 'RANGE' || regime === 'CONSOLIDATION' ? 70 : 50;
  if (netScore > signalThreshold) finalSignal = "BUY";
  if (netScore < -signalThreshold) finalSignal = "SELL";
  
  // Calculate TP/SL based on ATR and asset class
  const atrParams = ATR_PARAMS[assetClass] || ATR_PARAMS.crypto;
  const effectiveAtr = (atr || 0) * atrParams.multiplier;
  
  const stopLoss = finalSignal === "BUY" 
    ? price - (effectiveAtr * atrParams.stopLossFactor)
    : finalSignal === "SELL"
      ? price + (effectiveAtr * atrParams.stopLossFactor)
      : null;
  
  const takeProfit1 = finalSignal === "BUY"
    ? price + (effectiveAtr * 1.5)
    : finalSignal === "SELL"
      ? price - (effectiveAtr * 1.5)
      : null;
  
  const takeProfit2 = finalSignal === "BUY"
    ? price + (effectiveAtr * 2.5)
    : finalSignal === "SELL"
      ? price - (effectiveAtr * 2.5)
      : null;
  
  const takeProfit3 = finalSignal === "BUY"
    ? price + (effectiveAtr * 4.0)
    : finalSignal === "SELL"
      ? price - (effectiveAtr * 4.0)
      : null;
  
  return {
    signal: finalSignal,
    confidence: Math.round(confidence),
    buyScore: Math.round(buyScore),
    sellScore: Math.round(sellScore),
    netScore: Math.round(netScore),
    reasons: reasons.slice(0, 5), // Top 5 reasons
    levels: {
      stopLoss,
      takeProfit1,
      takeProfit2,
      takeProfit3,
    },
    meta: {
      assetClass,
      regime, // NEW: Current market regime
      regimeModifier: modifier.confidenceMultiplier, // NEW: How regime affected confidence
      atrMultiplier: atrParams.multiplier,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Get algorithm parameters for a specific asset (for frontend display)
 * @param {string} symbol - Asset symbol
 * @returns {Object} Sanitized parameters (no proprietary weights)
 */
export const getPublicParams = (symbol) => {
  const assetClass = getAssetClass(symbol);
  const volatility = getVolatilityProfile(symbol);
  
  return {
    assetClass,
    volatility,
    // Only expose non-sensitive parameters
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    emaPeriods: [20, 50],
    fibLevels: [0.236, 0.382, 0.5, 0.618, 0.786],
  };
};

export default {
  compute8PointSignal,
  getPublicParams,
};
