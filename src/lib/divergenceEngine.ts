/**
 * Vision AI Mind - Divergence Detection Engine
 * 
 * Erkennt bullische und bearische Divergenzen zwischen Preis und Indikatoren.
 * Divergenzen sind starke Umkehrsignale wenn Preis und Indikator gegensätzlich laufen.
 * 
 * Typen:
 * - Regular Bullish: Preis macht tiefere Tiefs, RSI macht höhere Tiefs → Kauf
 * - Regular Bearish: Preis macht höhere Hochs, RSI macht tiefere Hochs → Verkauf
 * - Hidden Bullish: Preis macht höhere Tiefs, RSI macht tiefere Tiefs → Trendfortsetzung Long
 * - Hidden Bearish: Preis macht tiefere Hochs, RSI macht höhere Hochs → Trendfortsetzung Short
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import type { OHLC } from '../stores/useCandleStore';

// ============================================
// TYPES
// ============================================

export type DivergenceType = 'regular_bullish' | 'regular_bearish' | 'hidden_bullish' | 'hidden_bearish' | 'none';

export interface SwingPoint {
  index: number;
  price: number;
  indicator: number;
  type: 'high' | 'low';
  timestamp: number;
}

export interface DivergenceResult {
  type: DivergenceType;
  detected: boolean;
  strength: number; // 0-100
  pricePoints: [number, number]; // [first, second] price levels
  indicatorPoints: [number, number]; // [first, second] indicator levels
  description: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
}

export interface DivergenceAnalysis {
  rsiDivergence: DivergenceResult;
  macdDivergence: DivergenceResult;
  combined: {
    hasDivergence: boolean;
    strongestType: DivergenceType;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    description: string;
  };
}

// ============================================
// SWING POINT DETECTION
// ============================================

/**
 * Find swing highs and lows in price data
 * A swing high/low requires the point to be higher/lower than surrounding bars
 */
function findSwingPoints(
  candles: OHLC[],
  indicators: number[],
  lookback: number = 5
): { highs: SwingPoint[]; lows: SwingPoint[] } {
  const highs: SwingPoint[] = [];
  const lows: SwingPoint[] = [];
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    const indicator = indicators[i];
    
    if (!Number.isFinite(indicator)) continue;
    
    let isSwingHigh = true;
    let isSwingLow = true;
    
    // Check if current bar is higher/lower than all bars in lookback range
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].h >= current.h || candles[i + j].h >= current.h) {
        isSwingHigh = false;
      }
      if (candles[i - j].l <= current.l || candles[i + j].l <= current.l) {
        isSwingLow = false;
      }
    }
    
    if (isSwingHigh) {
      highs.push({
        index: i,
        price: current.h,
        indicator,
        type: 'high',
        timestamp: current.t,
      });
    }
    
    if (isSwingLow) {
      lows.push({
        index: i,
        price: current.l,
        indicator,
        type: 'low',
        timestamp: current.t,
      });
    }
  }
  
  return { highs, lows };
}

// ============================================
// DIVERGENCE DETECTION
// ============================================

/**
 * Detect divergence between price and indicator
 */
function detectDivergence(
  swingPoints: SwingPoint[],
  type: 'high' | 'low',
  minBars: number = 5,
  maxBars: number = 50
): DivergenceResult {
  const noDivergence: DivergenceResult = {
    type: 'none',
    detected: false,
    strength: 0,
    pricePoints: [0, 0],
    indicatorPoints: [0, 0],
    description: 'Keine Divergenz erkannt',
    signal: 'HOLD',
    confidence: 0,
  };
  
  if (swingPoints.length < 2) return noDivergence;
  
  // Get last two swing points
  const recent = swingPoints[swingPoints.length - 1];
  const previous = swingPoints[swingPoints.length - 2];
  
  // Check distance between points
  const barDistance = recent.index - previous.index;
  if (barDistance < minBars || barDistance > maxBars) return noDivergence;
  
  // Calculate price and indicator changes
  const priceChange = recent.price - previous.price;
  const indicatorChange = recent.indicator - previous.indicator;
  
  // Check for divergence patterns
  if (type === 'low') {
    // Checking lows for bullish divergence
    
    // Regular Bullish: Price lower low, Indicator higher low
    if (priceChange < 0 && indicatorChange > 0) {
      const strength = Math.min(100, Math.abs(indicatorChange) * 2);
      return {
        type: 'regular_bullish',
        detected: true,
        strength,
        pricePoints: [previous.price, recent.price],
        indicatorPoints: [previous.indicator, recent.indicator],
        description: 'Regular Bullish Divergenz: Preis tieferes Tief, Indikator höheres Tief',
        signal: 'BUY',
        confidence: Math.min(0.9, strength / 100),
      };
    }
    
    // Hidden Bullish: Price higher low, Indicator lower low (trend continuation)
    if (priceChange > 0 && indicatorChange < 0) {
      const strength = Math.min(80, Math.abs(indicatorChange) * 1.5);
      return {
        type: 'hidden_bullish',
        detected: true,
        strength,
        pricePoints: [previous.price, recent.price],
        indicatorPoints: [previous.indicator, recent.indicator],
        description: 'Hidden Bullish Divergenz: Trend-Fortsetzung Long',
        signal: 'BUY',
        confidence: Math.min(0.7, strength / 100),
      };
    }
  }
  
  if (type === 'high') {
    // Checking highs for bearish divergence
    
    // Regular Bearish: Price higher high, Indicator lower high
    if (priceChange > 0 && indicatorChange < 0) {
      const strength = Math.min(100, Math.abs(indicatorChange) * 2);
      return {
        type: 'regular_bearish',
        detected: true,
        strength,
        pricePoints: [previous.price, recent.price],
        indicatorPoints: [previous.indicator, recent.indicator],
        description: 'Regular Bearish Divergenz: Preis höheres Hoch, Indikator tieferes Hoch',
        signal: 'SELL',
        confidence: Math.min(0.9, strength / 100),
      };
    }
    
    // Hidden Bearish: Price lower high, Indicator higher high (trend continuation)
    if (priceChange < 0 && indicatorChange > 0) {
      const strength = Math.min(80, Math.abs(indicatorChange) * 1.5);
      return {
        type: 'hidden_bearish',
        detected: true,
        strength,
        pricePoints: [previous.price, recent.price],
        indicatorPoints: [previous.indicator, recent.indicator],
        description: 'Hidden Bearish Divergenz: Trend-Fortsetzung Short',
        signal: 'SELL',
        confidence: Math.min(0.7, strength / 100),
      };
    }
  }
  
  return noDivergence;
}

// ============================================
// INDICATOR CALCULATIONS
// ============================================

/**
 * Calculate RSI values for candle array
 */
export function calculateRSIArray(candles: OHLC[], period: number = 14): number[] {
  const closes = candles.map(c => c.c);
  const rsi: number[] = new Array(closes.length).fill(NaN);
  
  if (closes.length < period + 1) return rsi;
  
  let avgGain = 0;
  let avgLoss = 0;
  
  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  
  // Subsequent values using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  
  return rsi;
}

/**
 * Calculate MACD histogram for candle array
 */
export function calculateMACDArray(
  candles: OHLC[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): number[] {
  const closes = candles.map(c => c.c);
  const histogram: number[] = new Array(closes.length).fill(NaN);
  
  if (closes.length < slowPeriod + signalPeriod) return histogram;
  
  // Calculate EMAs
  const ema = (data: number[], period: number): number[] => {
    const result: number[] = new Array(data.length).fill(NaN);
    const multiplier = 2 / (period + 1);
    
    // Initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i];
    }
    result[period - 1] = sum / period;
    
    // EMA
    for (let i = period; i < data.length; i++) {
      result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    }
    
    return result;
  };
  
  const emaFast = ema(closes, fastPeriod);
  const emaSlow = ema(closes, slowPeriod);
  
  // MACD Line
  const macdLine: number[] = new Array(closes.length).fill(NaN);
  for (let i = slowPeriod - 1; i < closes.length; i++) {
    if (Number.isFinite(emaFast[i]) && Number.isFinite(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }
  
  // Signal Line (EMA of MACD)
  const validMacd = macdLine.filter(v => Number.isFinite(v));
  if (validMacd.length < signalPeriod) return histogram;
  
  const signalLine = ema(
    macdLine.slice(slowPeriod - 1).map(v => Number.isFinite(v) ? v : 0),
    signalPeriod
  );
  
  // Histogram
  for (let i = 0; i < signalLine.length; i++) {
    const macdIdx = slowPeriod - 1 + i;
    if (Number.isFinite(macdLine[macdIdx]) && Number.isFinite(signalLine[i])) {
      histogram[macdIdx] = macdLine[macdIdx] - signalLine[i];
    }
  }
  
  return histogram;
}

// ============================================
// MAIN DIVERGENCE ANALYSIS
// ============================================

/**
 * Perform complete divergence analysis on candle data
 */
export function analyzeDivergences(
  candles: OHLC[],
  options: {
    rsiPeriod?: number;
    swingLookback?: number;
    minBars?: number;
    maxBars?: number;
  } = {}
): DivergenceAnalysis {
  const {
    rsiPeriod = 14,
    swingLookback = 5,
    minBars = 5,
    maxBars = 50,
  } = options;
  
  const noDivergence: DivergenceResult = {
    type: 'none',
    detected: false,
    strength: 0,
    pricePoints: [0, 0],
    indicatorPoints: [0, 0],
    description: 'Keine Divergenz',
    signal: 'HOLD',
    confidence: 0,
  };
  
  if (candles.length < rsiPeriod + swingLookback * 2) {
    return {
      rsiDivergence: noDivergence,
      macdDivergence: noDivergence,
      combined: {
        hasDivergence: false,
        strongestType: 'none',
        signal: 'HOLD',
        confidence: 0,
        description: 'Nicht genug Daten für Divergenz-Analyse',
      },
    };
  }
  
  // Calculate indicators
  const rsiValues = calculateRSIArray(candles, rsiPeriod);
  const macdValues = calculateMACDArray(candles);
  
  // Find swing points for RSI
  const rsiSwings = findSwingPoints(candles, rsiValues, swingLookback);
  const macdSwings = findSwingPoints(candles, macdValues, swingLookback);
  
  // Detect RSI divergence (check both highs and lows)
  const rsiHighDiv = detectDivergence(rsiSwings.highs, 'high', minBars, maxBars);
  const rsiLowDiv = detectDivergence(rsiSwings.lows, 'low', minBars, maxBars);
  const rsiDivergence = rsiHighDiv.detected ? rsiHighDiv : rsiLowDiv.detected ? rsiLowDiv : noDivergence;
  
  // Detect MACD divergence
  const macdHighDiv = detectDivergence(macdSwings.highs, 'high', minBars, maxBars);
  const macdLowDiv = detectDivergence(macdSwings.lows, 'low', minBars, maxBars);
  const macdDivergence = macdHighDiv.detected ? macdHighDiv : macdLowDiv.detected ? macdLowDiv : noDivergence;
  
  // Combine results
  const hasDivergence = rsiDivergence.detected || macdDivergence.detected;
  const strongestDiv = rsiDivergence.strength >= macdDivergence.strength ? rsiDivergence : macdDivergence;
  
  // If both show same direction, increase confidence
  let combinedConfidence = strongestDiv.confidence;
  let combinedDescription = strongestDiv.description;
  
  if (rsiDivergence.detected && macdDivergence.detected) {
    if (rsiDivergence.signal === macdDivergence.signal) {
      combinedConfidence = Math.min(0.95, combinedConfidence * 1.3);
      combinedDescription = `Doppelte Divergenz (RSI + MACD): ${strongestDiv.description}`;
    } else {
      // Conflicting divergences - reduce confidence
      combinedConfidence = combinedConfidence * 0.5;
      combinedDescription = 'Widersprüchliche Divergenzen - Vorsicht';
    }
  }
  
  return {
    rsiDivergence,
    macdDivergence,
    combined: {
      hasDivergence,
      strongestType: strongestDiv.type,
      signal: strongestDiv.signal,
      confidence: combinedConfidence,
      description: combinedDescription,
    },
  };
}

/**
 * Get divergence display color
 */
export function getDivergenceColor(type: DivergenceType): string {
  switch (type) {
    case 'regular_bullish':
    case 'hidden_bullish':
      return 'text-emerald-400';
    case 'regular_bearish':
    case 'hidden_bearish':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get divergence icon name
 */
export function getDivergenceIcon(type: DivergenceType): 'up' | 'down' | 'neutral' {
  switch (type) {
    case 'regular_bullish':
    case 'hidden_bullish':
      return 'up';
    case 'regular_bearish':
    case 'hidden_bearish':
      return 'down';
    default:
      return 'neutral';
  }
}

export default {
  analyzeDivergences,
  calculateRSIArray,
  calculateMACDArray,
  getDivergenceColor,
  getDivergenceIcon,
};
