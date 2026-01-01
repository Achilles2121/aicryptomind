/**
 * Vision AI Mind - Multi-Timeframe Confluence Engine
 * 
 * Aggregiert Signale aus mehreren Timeframes für stärkere Handelsentscheidungen.
 * Ein Signal gilt nur als "stark", wenn mehrere Timeframes übereinstimmen.
 * 
 * Confluence Score:
 * - 4/4 TF aligned = ULTRA (100% Konfidenz)
 * - 3/4 TF aligned = STRONG (75% Konfidenz)
 * - 2/4 TF aligned = MODERATE (50% Konfidenz)
 * - 1/4 TF aligned = WEAK (25% Konfidenz)
 * - 0/4 TF aligned = CONFLICTING (0% Konfidenz)
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import type { Timeframe } from '../stores/useCandleStore';

// ============================================
// TYPES
// ============================================

export type SignalBias = 'bullish' | 'bearish' | 'neutral';
export type ConfluenceStrength = 'ultra' | 'strong' | 'moderate' | 'weak' | 'conflicting';

export interface TimeframeSignal {
  timeframe: Timeframe;
  bias: SignalBias;
  rsi: number | null;
  macdHistogram: number | null;
  emaAlignment: 'bullish' | 'bearish' | 'neutral';
  trendStrength: number; // 0-100
  weight: number; // Timeframe weight (higher TF = more weight)
}

export interface ConfluenceResult {
  // Primary signal
  dominantBias: SignalBias;
  confluenceScore: number; // 0-100
  strength: ConfluenceStrength;
  
  // Breakdown
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  alignedTimeframes: Timeframe[];
  conflictingTimeframes: Timeframe[];
  
  // Weighted analysis
  weightedBullish: number;
  weightedBearish: number;
  
  // Individual TF signals
  signals: TimeframeSignal[];
  
  // Trade recommendation
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-1
  reason: string;
}

// ============================================
// TIMEFRAME WEIGHTS
// Higher timeframes carry more weight
// ============================================

const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  '1m': 0.5,
  '5m': 1.0,
  '15m': 1.5,
  '1h': 2.5,
  '4h': 3.5,
  '1d': 5.0,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determine bias from RSI
 */
function getBiasFromRSI(rsi: number | null, profile: 'high' | 'medium' | 'low' = 'high'): SignalBias {
  if (rsi === null) return 'neutral';
  
  const thresholds = {
    high: { oversold: 30, overbought: 70 },
    medium: { oversold: 35, overbought: 65 },
    low: { oversold: 40, overbought: 60 },
  };
  
  const { oversold, overbought } = thresholds[profile];
  
  if (rsi <= oversold) return 'bullish';
  if (rsi >= overbought) return 'bearish';
  return 'neutral';
}

/**
 * Determine bias from MACD
 */
function getBiasFromMACD(histogram: number | null): SignalBias {
  if (histogram === null) return 'neutral';
  if (histogram > 0) return 'bullish';
  if (histogram < 0) return 'bearish';
  return 'neutral';
}

/**
 * Combine biases with voting
 */
function combineSignals(
  rsiBias: SignalBias,
  macdBias: SignalBias,
  emaBias: SignalBias
): SignalBias {
  const votes = { bullish: 0, bearish: 0, neutral: 0 };
  
  votes[rsiBias]++;
  votes[macdBias]++;
  votes[emaBias]++;
  
  if (votes.bullish > votes.bearish && votes.bullish >= votes.neutral) return 'bullish';
  if (votes.bearish > votes.bullish && votes.bearish >= votes.neutral) return 'bearish';
  return 'neutral';
}

// ============================================
// MAIN CONFLUENCE CALCULATOR
// ============================================

/**
 * Calculate multi-timeframe confluence
 * 
 * @param signals - Array of signals from different timeframes
 * @returns ConfluenceResult with aggregated analysis
 */
export function calculateConfluence(signals: TimeframeSignal[]): ConfluenceResult {
  if (!signals.length) {
    return {
      dominantBias: 'neutral',
      confluenceScore: 0,
      strength: 'conflicting',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      alignedTimeframes: [],
      conflictingTimeframes: [],
      weightedBullish: 0,
      weightedBearish: 0,
      signals: [],
      recommendation: 'HOLD',
      confidence: 0,
      reason: 'No signals available',
    };
  }
  
  // Count biases
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let weightedBullish = 0;
  let weightedBearish = 0;
  let totalWeight = 0;
  
  const alignedTimeframes: Timeframe[] = [];
  const conflictingTimeframes: Timeframe[] = [];
  
  for (const signal of signals) {
    totalWeight += signal.weight;
    
    if (signal.bias === 'bullish') {
      bullishCount++;
      weightedBullish += signal.weight * signal.trendStrength;
    } else if (signal.bias === 'bearish') {
      bearishCount++;
      weightedBearish += signal.weight * signal.trendStrength;
    } else {
      neutralCount++;
    }
  }
  
  // Normalize weighted scores
  if (totalWeight > 0) {
    weightedBullish = weightedBullish / totalWeight;
    weightedBearish = weightedBearish / totalWeight;
  }
  
  // Determine dominant bias
  let dominantBias: SignalBias = 'neutral';
  if (bullishCount > bearishCount && bullishCount >= neutralCount) {
    dominantBias = 'bullish';
  } else if (bearishCount > bullishCount && bearishCount >= neutralCount) {
    dominantBias = 'bearish';
  }
  
  // Calculate confluence score (0-100)
  const totalSignals = signals.length;
  const alignedCount = dominantBias === 'bullish' ? bullishCount : 
                       dominantBias === 'bearish' ? bearishCount : neutralCount;
  const confluenceScore = Math.round((alignedCount / totalSignals) * 100);
  
  // Determine aligned/conflicting timeframes
  for (const signal of signals) {
    if (signal.bias === dominantBias || signal.bias === 'neutral') {
      alignedTimeframes.push(signal.timeframe);
    } else {
      conflictingTimeframes.push(signal.timeframe);
    }
  }
  
  // Determine strength
  let strength: ConfluenceStrength;
  if (alignedCount === totalSignals && totalSignals >= 3) {
    strength = 'ultra';
  } else if (alignedCount >= totalSignals * 0.75) {
    strength = 'strong';
  } else if (alignedCount >= totalSignals * 0.5) {
    strength = 'moderate';
  } else if (alignedCount >= totalSignals * 0.25) {
    strength = 'weak';
  } else {
    strength = 'conflicting';
  }
  
  // Generate recommendation
  let recommendation: ConfluenceResult['recommendation'];
  let confidence: number;
  let reason: string;
  
  if (strength === 'ultra' && dominantBias === 'bullish') {
    recommendation = 'STRONG_BUY';
    confidence = 0.95;
    reason = `Ultra-Konfluenz: Alle ${totalSignals} Timeframes bullish`;
  } else if (strength === 'ultra' && dominantBias === 'bearish') {
    recommendation = 'STRONG_SELL';
    confidence = 0.95;
    reason = `Ultra-Konfluenz: Alle ${totalSignals} Timeframes bearish`;
  } else if (strength === 'strong' && dominantBias === 'bullish') {
    recommendation = 'BUY';
    confidence = 0.75;
    reason = `Starke Konfluenz: ${alignedCount}/${totalSignals} Timeframes bullish`;
  } else if (strength === 'strong' && dominantBias === 'bearish') {
    recommendation = 'SELL';
    confidence = 0.75;
    reason = `Starke Konfluenz: ${alignedCount}/${totalSignals} Timeframes bearish`;
  } else if (strength === 'moderate') {
    recommendation = dominantBias === 'bullish' ? 'BUY' : dominantBias === 'bearish' ? 'SELL' : 'HOLD';
    confidence = 0.55;
    reason = `Moderate Konfluenz: ${alignedCount}/${totalSignals} aligned`;
  } else {
    recommendation = 'HOLD';
    confidence = 0.3;
    reason = `Schwache/Konflikt-Konfluenz: ${conflictingTimeframes.length} TFs widersprechen`;
  }
  
  return {
    dominantBias,
    confluenceScore,
    strength,
    bullishCount,
    bearishCount,
    neutralCount,
    alignedTimeframes,
    conflictingTimeframes,
    weightedBullish,
    weightedBearish,
    signals,
    recommendation,
    confidence,
    reason,
  };
}

/**
 * Create a timeframe signal from indicator data
 */
export function createTimeframeSignal(
  timeframe: Timeframe,
  rsi: number | null,
  macdHistogram: number | null,
  ema20: number | null,
  ema50: number | null,
  currentPrice: number | null,
  volatilityProfile: 'high' | 'medium' | 'low' = 'high'
): TimeframeSignal {
  const rsiBias = getBiasFromRSI(rsi, volatilityProfile);
  const macdBias = getBiasFromMACD(macdHistogram);
  
  // EMA alignment
  let emaAlignment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ema20 !== null && ema50 !== null && currentPrice !== null) {
    if (currentPrice > ema20 && ema20 > ema50) {
      emaAlignment = 'bullish';
    } else if (currentPrice < ema20 && ema20 < ema50) {
      emaAlignment = 'bearish';
    }
  }
  
  // Combined bias
  const bias = combineSignals(rsiBias, macdBias, emaAlignment);
  
  // Trend strength (0-100)
  let trendStrength = 50; // neutral
  if (rsi !== null) {
    if (bias === 'bullish') {
      trendStrength = Math.min(100, 50 + (50 - rsi)); // Lower RSI = stronger bullish
    } else if (bias === 'bearish') {
      trendStrength = Math.min(100, 50 + (rsi - 50)); // Higher RSI = stronger bearish
    }
  }
  
  return {
    timeframe,
    bias,
    rsi,
    macdHistogram,
    emaAlignment,
    trendStrength,
    weight: TIMEFRAME_WEIGHTS[timeframe] || 1.0,
  };
}

/**
 * Get timeframe display label
 */
export function getTimeframeLabel(tf: Timeframe): string {
  const labels: Record<Timeframe, string> = {
    '1m': '1 Min',
    '5m': '5 Min',
    '15m': '15 Min',
    '1h': '1 Std',
    '4h': '4 Std',
    '1d': '1 Tag',
  };
  return labels[tf] || tf;
}

export default {
  calculateConfluence,
  createTimeframeSignal,
  getTimeframeLabel,
  TIMEFRAME_WEIGHTS,
};
