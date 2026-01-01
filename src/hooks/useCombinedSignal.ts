/**
 * Vision AI Mind - Combined Signal Hook
 * 
 * Vereint alle Signal-Engines in einem Hook:
 * - 8-Punkte Algorithmus
 * - Multi-Timeframe Confluence
 * - Divergenz-Erkennung
 * - Regime-Erkennung
 * - Signal-Tracking
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useMemo, useCallback } from 'react';
import { useCandleStore, type Timeframe, type OHLC } from '../stores/useCandleStore';
import { usePriceStore } from '../stores/usePriceStore';
import { useMultiTimeframe } from './useMultiTimeframe';
import { useDivergence } from './useDivergence';
import { useSignalTrackingStore, type AssetStats } from '../stores/useSignalTrackingStore';
import type { ConfluenceResult } from '../lib/confluenceEngine';

// ============================================
// TYPES
// ============================================

export interface AlgorithmScore {
  total: number;
  rsi: number;
  macd: number;
  bollinger: number;
  ema: number;
  volume: number;
  support: number;
  fib: number;
  regime: number;
}

export interface RegimeData {
  type: string;
  modifier: number;
  rsiOversold: number;
  rsiOverbought: number;
  signalThreshold: number;
}

export interface CombinedSignalResult {
  // Main signal
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  score: number;
  
  // Levels
  entryPrice: number;
  tp: number | null;
  sl: number | null;
  
  // Sources
  algorithm: AlgorithmScore;
  confluence: ConfluenceResult | null;
  divergence: {
    detected: boolean;
    type: string | null;
    confidence: number;
    direction: 'BULLISH' | 'BEARISH' | 'NONE';
    advice: string;
  };
  regime: RegimeData;
  
  // Recommendation
  recommendation: {
    action: string;
    label: string;
    reason: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  
  // Tracking
  stats: AssetStats | null;
}

// ============================================
// REGIME DETECTION
// ============================================

const REGIME_PARAMS: Record<string, RegimeData> = {
  BULL_TREND: {
    type: 'BULL_TREND',
    modifier: 1.2,
    rsiOversold: 35,
    rsiOverbought: 75,
    signalThreshold: 3,
  },
  BEAR_TREND: {
    type: 'BEAR_TREND',
    modifier: 1.2,
    rsiOversold: 25,
    rsiOverbought: 65,
    signalThreshold: 3,
  },
  RANGE: {
    type: 'RANGE',
    modifier: 1.0,
    rsiOversold: 30,
    rsiOverbought: 70,
    signalThreshold: 5,
  },
  HIGH_VOLATILITY: {
    type: 'HIGH_VOLATILITY',
    modifier: 0.8,
    rsiOversold: 20,
    rsiOverbought: 80,
    signalThreshold: 4,
  },
  CONSOLIDATION: {
    type: 'CONSOLIDATION',
    modifier: 0.7,
    rsiOversold: 35,
    rsiOverbought: 65,
    signalThreshold: 6,
  },
  NEUTRAL: {
    type: 'NEUTRAL',
    modifier: 1.0,
    rsiOversold: 30,
    rsiOverbought: 70,
    signalThreshold: 4,
  },
};

function detectRegime(candles: OHLC[]): string {
  if (!candles || candles.length < 50) return 'NEUTRAL';
  
  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  
  // Calculate EMAs
  const ema20 = calculateEMASimple(closes, 20);
  const ema50 = calculateEMASimple(closes, 50);
  
  // ATR for volatility
  let atrSum = 0;
  for (let i = 1; i < Math.min(15, candles.length); i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atrSum += tr;
  }
  const atr14 = atrSum / 14;
  const avgPrice = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const atrPct = (atr14 / avgPrice) * 100;
  
  // Current values
  const currentClose = closes[closes.length - 1];
  
  // High volatility
  if (atrPct > 5) return 'HIGH_VOLATILITY';
  
  // Trend detection
  if (ema20 > ema50 && currentClose > ema20) {
    return 'BULL_TREND';
  }
  if (ema20 < ema50 && currentClose < ema20) {
    return 'BEAR_TREND';
  }
  
  // Range detection
  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const priceRange = (Math.max(...recentHighs) - Math.min(...recentLows)) / avgPrice * 100;
  
  if (priceRange < 3 && atrPct < 2) return 'CONSOLIDATION';
  if (priceRange < 5) return 'RANGE';
  
  return 'NEUTRAL';
}

// Simple EMA calculation
function calculateEMASimple(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  
  return ema;
}

// RSI calculation
function calculateRSI(closes: number[], period: number = 14): number {
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
}

// MACD calculation
function calculateMACD(closes: number[]): { histogram: number; macd: number; signal: number } {
  if (closes.length < 26) return { histogram: 0, macd: 0, signal: 0 };
  
  const ema12 = calculateEMASimple(closes, 12);
  const ema26 = calculateEMASimple(closes, 26);
  const macd = ema12 - ema26;
  
  // Signal line (simplified - just use recent MACD as approximation)
  const signal = macd * 0.85;
  const histogram = macd - signal;
  
  return { histogram, macd, signal };
}

// ATR calculation
function calculateATR(candles: OHLC[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  
  const trValues: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    );
    trValues.push(tr);
  }
  
  const recentTR = trValues.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

// ============================================
// 8-POINT ALGORITHM
// ============================================

function calculate8PointScore(candles: OHLC[], regime: string): AlgorithmScore {
  if (!candles || candles.length < 50) {
    return { total: 0, rsi: 0, macd: 0, bollinger: 0, ema: 0, volume: 0, support: 0, fib: 0, regime: 0 };
  }
  
  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v || 0);
  const regimeParams = REGIME_PARAMS[regime] || REGIME_PARAMS.NEUTRAL;
  
  // 1. RSI
  const currentRsi = calculateRSI(closes, 14);
  let rsiScore = 0;
  if (currentRsi < regimeParams.rsiOversold) rsiScore = 1;
  else if (currentRsi > regimeParams.rsiOverbought) rsiScore = -1;
  
  // 2. MACD
  const macdResult = calculateMACD(closes);
  let macdScore = 0;
  if (macdResult.histogram > 0 && macdResult.macd > macdResult.signal) macdScore = 1;
  else if (macdResult.histogram < 0 && macdResult.macd < macdResult.signal) macdScore = -1;
  
  // 3. Bollinger Bands
  const period = 20;
  const bbSlice = closes.slice(-period);
  const bbMean = bbSlice.reduce((a, b) => a + b, 0) / period;
  const bbStd = Math.sqrt(bbSlice.reduce((a, b) => a + Math.pow(b - bbMean, 2), 0) / period);
  const bbUpper = bbMean + 2 * bbStd;
  const bbLower = bbMean - 2 * bbStd;
  const currentClose = closes[closes.length - 1];
  
  let bollingerScore = 0;
  if (currentClose <= bbLower) bollingerScore = 1;
  else if (currentClose >= bbUpper) bollingerScore = -1;
  
  // 4. EMA Cross
  const ema9 = calculateEMASimple(closes, 9);
  const ema21 = calculateEMASimple(closes, 21);
  let emaScore = 0;
  if (ema9 > ema21) emaScore = 0.5;
  else if (ema9 < ema21) emaScore = -0.5;
  
  // 5. Volume
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const currentVolume = volumes[volumes.length - 1];
  let volumeScore = 0;
  if (currentVolume > avgVolume * 1.5) {
    volumeScore = currentClose > closes[closes.length - 2] ? 1 : -1;
  }
  
  // 6. Support/Resistance
  const recentLows = lows.slice(-50);
  const recentHighs = highs.slice(-50);
  const nearestSupport = Math.max(...recentLows.filter(l => l < currentClose));
  const nearestResistance = Math.min(...recentHighs.filter(h => h > currentClose));
  
  let supportScore = 0;
  const distToSupport = (currentClose - nearestSupport) / currentClose;
  const distToResistance = (nearestResistance - currentClose) / currentClose;
  if (distToSupport < 0.02) supportScore = 1;
  else if (distToResistance < 0.02) supportScore = -1;
  
  // 7. Fibonacci
  const swingHigh = Math.max(...recentHighs);
  const swingLow = Math.min(...recentLows);
  const fibRange = swingHigh - swingLow;
  const fib618 = swingLow + fibRange * 0.618;
  const fib382 = swingLow + fibRange * 0.382;
  
  let fibScore = 0;
  if (Math.abs(currentClose - fib618) / currentClose < 0.01) fibScore = 0.5;
  if (Math.abs(currentClose - fib382) / currentClose < 0.01) fibScore = 0.5;
  
  // 8. Regime bonus
  let regimeScore = 0;
  if (regime === 'BULL_TREND') regimeScore = 0.5;
  else if (regime === 'BEAR_TREND') regimeScore = -0.5;
  
  // Calculate total (normalize to 0-8)
  const rawTotal = rsiScore + macdScore + bollingerScore + emaScore + volumeScore + supportScore + fibScore + regimeScore;
  const normalizedTotal = Math.max(0, Math.min(8, (rawTotal + 8) / 2));
  
  return {
    total: normalizedTotal,
    rsi: rsiScore,
    macd: macdScore,
    bollinger: bollingerScore,
    ema: emaScore,
    volume: volumeScore,
    support: supportScore,
    fib: fibScore,
    regime: regimeScore,
  };
}

// ============================================
// MAIN HOOK
// ============================================

export function useCombinedSignal(
  assetId: string,
  timeframe: Timeframe = '1h'
): { signal: CombinedSignalResult | null; isLoading: boolean; trackSignal: () => string | null } {
  // Stores
  const getCandles = useCandleStore((state) => state.getCandles);
  const candles = getCandles(assetId, timeframe);
  const assetState = usePriceStore((state) => state.getAssetState(assetId));
  const currentPrice = assetState.livePrice || assetState.restPrice;
  
  // Multi-timeframe confluence
  const mtfState = useMultiTimeframe({ assetId, symbol: assetId.toUpperCase() });
  const confluence = mtfState.confluence;
  
  // Divergence detection
  const divergenceState = useDivergence(assetId, timeframe);
  
  // Signal tracking
  const getAssetStats = useSignalTrackingStore((state) => state.getAssetStats);
  const addSignal = useSignalTrackingStore((state) => state.addSignal);
  const stats = getAssetStats(assetId);
  
  // Calculate combined signal
  const combinedSignal = useMemo((): CombinedSignalResult | null => {
    if (!candles || candles.length < 50) {
      return null;
    }
    
    // Detect regime
    const regime = detectRegime(candles);
    const regimeParams = REGIME_PARAMS[regime] || REGIME_PARAMS.NEUTRAL;
    
    // Calculate 8-point score
    const algorithmScore = calculate8PointScore(candles, regime);
    
    // Determine direction from algorithm
    let direction: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    const threshold = regimeParams.signalThreshold;
    
    if (algorithmScore.total >= threshold + 1) {
      direction = 'BUY';
    } else if (algorithmScore.total <= 8 - threshold - 1) {
      direction = 'SELL';
    }
    
    // Confluence adjustment
    if (confluence) {
      if (confluence.strength === 'ultra' || confluence.strength === 'strong') {
        if (confluence.dominantBias === 'bullish' && direction !== 'SELL') {
          direction = 'BUY';
        } else if (confluence.dominantBias === 'bearish' && direction !== 'BUY') {
          direction = 'SELL';
        }
      } else if (confluence.strength === 'conflicting') {
        direction = 'HOLD';
      }
    }
    
    // Calculate entry, TP, SL
    const entryPrice = currentPrice || candles[candles.length - 1].c;
    const atr = calculateATR(candles);
    
    let tp: number | null = null;
    let sl: number | null = null;
    
    if (direction === 'BUY') {
      tp = entryPrice + atr * 2;
      sl = entryPrice - atr * 1;
    } else if (direction === 'SELL') {
      tp = entryPrice - atr * 2;
      sl = entryPrice + atr * 1;
    }
    
    // Calculate overall confidence
    const algorithmConfidence = (algorithmScore.total / 8) * 100;
    const confluenceConfidence = confluence?.confluenceScore || 50;
    const divergenceBonus = divergenceState.hasDivergence ? divergenceState.combinedScore * 0.2 : 0;
    
    const overallConfidence = (
      algorithmConfidence * 0.5 +
      confluenceConfidence * 0.35 +
      divergenceBonus * 0.15
    );
    
    // Generate recommendation
    const recommendation = {
      action: direction,
      label: '',
      reason: '',
      urgency: 'LOW' as 'HIGH' | 'MEDIUM' | 'LOW',
    };
    
    if (overallConfidence >= 75 && direction !== 'HOLD') {
      recommendation.label = direction === 'BUY' ? '🟢 STRONG BUY' : '🔴 STRONG SELL';
      recommendation.reason = 'High confluence across all indicators';
      recommendation.urgency = 'HIGH';
    } else if (overallConfidence >= 60 && direction !== 'HOLD') {
      recommendation.label = direction === 'BUY' ? '📈 BUY' : '📉 SELL';
      recommendation.reason = 'Moderate signal strength with confirmation';
      recommendation.urgency = 'MEDIUM';
    } else if (divergenceState.hasDivergence && divergenceState.signal) {
      recommendation.label = divergenceState.signal.direction === 'BULLISH' ? '👀 BULLISH DIVERGENCE' : '👀 BEARISH DIVERGENCE';
      recommendation.reason = 'Divergence detected - potential reversal';
      recommendation.urgency = 'MEDIUM';
    } else {
      recommendation.label = '⏳ WAIT';
      recommendation.reason = 'No clear signals - remain patient';
      recommendation.urgency = 'LOW';
    }
    
    return {
      direction,
      confidence: overallConfidence,
      score: algorithmScore.total,
      entryPrice,
      tp,
      sl,
      algorithm: algorithmScore,
      confluence,
      divergence: {
        detected: divergenceState.hasDivergence,
        type: divergenceState.rsiDivergence || divergenceState.macdDivergence || null,
        confidence: divergenceState.combinedScore,
        direction: divergenceState.signal?.direction || 'NONE',
        advice: divergenceState.signal?.tradingAdvice || '',
      },
      regime: regimeParams,
      recommendation,
      stats: stats.totalSignals > 0 ? stats : null,
    };
  }, [candles, confluence, divergenceState, currentPrice, stats]);
  
  // Track signal function
  const trackSignal = useCallback(() => {
    if (!combinedSignal || combinedSignal.direction === 'HOLD') return null;
    
    return addSignal({
      assetId,
      symbol: assetId.toUpperCase(),
      timestamp: Date.now(),
      direction: combinedSignal.direction,
      confidence: combinedSignal.confidence / 100,
      entryPrice: combinedSignal.entryPrice,
      stopLoss: combinedSignal.sl,
      takeProfit1: combinedSignal.tp,
      takeProfit2: null,
      takeProfit3: null,
      sources: {
        rsiScore: combinedSignal.algorithm.rsi * 50 + 50,
        macdScore: combinedSignal.algorithm.macd * 50 + 50,
        confluenceScore: combinedSignal.confluence?.confluenceScore || 0,
        divergenceDetected: combinedSignal.divergence.detected,
        regime: combinedSignal.regime.type,
      },
      timeframe,
      notes: combinedSignal.recommendation.reason,
    });
  }, [combinedSignal, assetId, timeframe, addSignal]);
  
  return {
    signal: combinedSignal,
    isLoading: !candles || candles.length === 0 || mtfState.isLoading,
    trackSignal,
  };
}

export default useCombinedSignal;
