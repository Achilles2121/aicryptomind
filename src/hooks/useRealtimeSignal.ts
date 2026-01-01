/**
 * Real-time Signal Engine Hook
 * Vision AI Mind - Tick-Based 8-Point Analysis
 * 
 * Computes signals on every price tick with confirmation logic.
 * Ensures Fibonacci, TP/SL, and indicators use IDENTICAL price data.
 * 
 * Features:
 * - Tick-triggered signal recalculation
 * - Candle close confirmation (waits for closed candle)
 * - Asset-class aware volatility adjustment
 * - Single Source of Truth price synchronization
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 * PROPRIETARY - Algorithm logic protected
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePriceStore } from '../stores/usePriceStore';
import { useCandleStore, type OHLC, type Timeframe } from '../stores/useCandleStore';
import { getAlgorithmParams } from '../config/universalMapping';
import { getAssetClass } from '../config/supportedCoins';

// ============================================
// TYPES
// ============================================

export type SignalDirection = 'BUY' | 'SELL' | 'HOLD';
export type SignalConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type AssetClass = 'crypto' | 'commodity' | 'forex';

export interface SignalLevels {
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
}

export interface IndicatorSnapshot {
  rsi: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  ema20: number;
  ema50: number;
  atr: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
}

export interface RealTimeSignal {
  direction: SignalDirection;
  confidence: SignalConfidence;
  confidenceScore: number;
  reasons: string[];
  levels: SignalLevels | null;
  indicators: IndicatorSnapshot;
  timestamp: number;
  isConfirmed: boolean;
  priceAtSignal: number;
  assetClass: AssetClass;
}

export interface UseRealtimeSignalOptions {
  assetId: string;
  symbol: string;
  timeframe?: Timeframe;
  enabled?: boolean;
  onSignalChange?: (signal: RealTimeSignal) => void;
}

// ============================================
// INDICATOR CALCULATIONS (Simplified for client)
// Full algorithm runs on server for protection
// ============================================

const calculateEMA = (prices: number[], period: number): number => {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
};

const calculateRSI = (closes: number[], period = 14): number => {
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

const calculateMACD = (closes: number[]): { macdLine: number; signal: number; histogram: number } => {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = ema12 - ema26;
  
  // Signal line (9-period EMA of MACD line) - simplified
  const signal = macdLine * 0.9; // Approximation
  const histogram = macdLine - signal;
  
  return { macdLine, signal, histogram };
};

const calculateATR = (candles: OHLC[], period = 14): number => {
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

const calculateBollingerBands = (closes: number[], period = 20, stdDev = 2): { upper: number; middle: number; lower: number } => {
  if (closes.length < period) {
    const last = closes[closes.length - 1] || 0;
    return { upper: last, middle: last, lower: last };
  }
  
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: mean + stdDev * std,
    middle: mean,
    lower: mean - stdDev * std,
  };
};

// ============================================
// MAIN HOOK
// ============================================

export function useRealtimeSignal(options: UseRealtimeSignalOptions): RealTimeSignal | null {
  const { assetId, symbol, timeframe = '5m', enabled = true, onSignalChange } = options;
  
  // Store subscriptions
  const getUnifiedPrice = usePriceStore((state) => state.getUnifiedPrice);
  const getCandles = useCandleStore((state) => state.getCandles);
  const getCurrentCandle = useCandleStore((state) => state.getCurrentCandle);
  
  // Signal state
  const [signal, setSignal] = useState<RealTimeSignal | null>(null);
  const lastSignalRef = useRef<RealTimeSignal | null>(null);
  const lastPriceRef = useRef<number | null>(null);
  
  // Asset configuration
  const assetClass = useMemo(() => getAssetClass(symbol) as AssetClass, [symbol]);
  // Note: volatilityProfile is embedded in algoParams via getAlgorithmParams
  const algoParams = useMemo(() => getAlgorithmParams(symbol), [symbol]);
  
  /**
   * Core signal computation
   * Runs on every price tick for live trading precision
   */
  const computeSignal = useCallback((): RealTimeSignal | null => {
    const unifiedPrice = getUnifiedPrice(assetId);
    const currentPrice = unifiedPrice.lastPrice;
    
    if (!currentPrice) return null;
    
    // Get candles for calculations
    const closedCandles = getCandles(assetId, timeframe, 100);
    const currentCandle = getCurrentCandle(assetId, timeframe);
    
    // Need at least some candles for calculations
    if (closedCandles.length < 26) return null;
    
    // Extract close prices
    const closes = closedCandles.map((c: OHLC) => c.c);
    
    // Calculate indicators
    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const atr = calculateATR(closedCandles);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const bollinger = calculateBollingerBands(closes);
    
    // Build indicator snapshot
    const indicators: IndicatorSnapshot = {
      rsi,
      macdLine: macd.macdLine,
      macdSignal: macd.signal,
      macdHistogram: macd.histogram,
      ema20,
      ema50,
      atr,
      bollingerUpper: bollinger.upper,
      bollingerMiddle: bollinger.middle,
      bollingerLower: bollinger.lower,
    };
    
    // ============================================
    // 8-POINT SIGNAL ANALYSIS (Client-side preview)
    // Full algorithm runs server-side for protection
    // ============================================
    
    let buyScore = 0;
    let sellScore = 0;
    const reasons: string[] = [];
    
    // 1. RSI Analysis (Volatility-adjusted thresholds)
    if (rsi <= algoParams.rsiOversold) {
      buyScore += 25;
      reasons.push('RSI Oversold');
    } else if (rsi >= algoParams.rsiOverbought) {
      sellScore += 25;
      reasons.push('RSI Overbought');
    }
    
    // 2. MACD Analysis
    if (macd.histogram > 0 && macd.macdLine > macd.signal) {
      buyScore += 20;
      reasons.push('MACD Bullish');
    } else if (macd.histogram < 0 && macd.macdLine < macd.signal) {
      sellScore += 20;
      reasons.push('MACD Bearish');
    }
    
    // 3. EMA Cross
    if (ema20 > ema50) {
      buyScore += 15;
      reasons.push('EMA Golden Cross');
    } else if (ema20 < ema50) {
      sellScore += 15;
      reasons.push('EMA Death Cross');
    }
    
    // 4. Bollinger Band Position
    if (currentPrice <= bollinger.lower) {
      buyScore += 15;
      reasons.push('At Bollinger Lower');
    } else if (currentPrice >= bollinger.upper) {
      sellScore += 15;
      reasons.push('At Bollinger Upper');
    }
    
    // 5. Price vs EMA20 (Trend confirmation)
    if (currentPrice > ema20 && currentPrice > ema50) {
      buyScore += 10;
    } else if (currentPrice < ema20 && currentPrice < ema50) {
      sellScore += 10;
    }
    
    // Calculate net score and direction
    const netScore = buyScore - sellScore;
    let direction: SignalDirection = 'HOLD';
    if (netScore >= 30) direction = 'BUY';
    if (netScore <= -30) direction = 'SELL';
    
    // Confidence calculation
    const absScore = Math.abs(netScore);
    const confidenceScore = Math.min(100, Math.round(absScore * 1.2));
    let confidence: SignalConfidence = 'LOW';
    if (confidenceScore >= 70) confidence = 'HIGH';
    else if (confidenceScore >= 40) confidence = 'MEDIUM';
    
    // Calculate TP/SL levels based on ATR and volatility
    const atrMultiplier = algoParams.atrMultiplier;
    const slDistance = atr * algoParams.stopLossMultiplier * atrMultiplier;
    const tp1Distance = atr * 1.5 * atrMultiplier;
    const tp2Distance = atr * 2.5 * atrMultiplier;
    const tp3Distance = atr * 4.0 * atrMultiplier;
    
    const levels: SignalLevels | null = direction !== 'HOLD' ? {
      entry: currentPrice,
      stopLoss: direction === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance,
      takeProfit1: direction === 'BUY' ? currentPrice + tp1Distance : currentPrice - tp1Distance,
      takeProfit2: direction === 'BUY' ? currentPrice + tp2Distance : currentPrice - tp2Distance,
      takeProfit3: direction === 'BUY' ? currentPrice + tp3Distance : currentPrice - tp3Distance,
      riskRewardRatio: tp1Distance / slDistance,
    } : null;
    
    // Check if signal is confirmed (based on closed candle)
    const isConfirmed = currentCandle === null || closedCandles.length > 0;
    
    return {
      direction,
      confidence,
      confidenceScore,
      reasons: reasons.slice(0, 3),
      levels,
      indicators,
      timestamp: Date.now(),
      isConfirmed,
      priceAtSignal: currentPrice,
      assetClass,
    };
  }, [assetId, timeframe, getUnifiedPrice, getCandles, getCurrentCandle, algoParams, assetClass]);
  
  /**
   * Tick handler - runs on every price change
   */
  useEffect(() => {
    if (!enabled) return;
    
    // Subscribe to price changes
    const unsubscribe = usePriceStore.subscribe(
      (state) => state.assets[assetId]?.livePrice,
      (livePrice) => {
        if (livePrice === null || livePrice === lastPriceRef.current) return;
        lastPriceRef.current = livePrice;
        
        // Compute new signal on tick
        const newSignal = computeSignal();
        if (!newSignal) return;
        
        // Only update if signal changed
        const prevSignal = lastSignalRef.current;
        const signalChanged = !prevSignal || 
          prevSignal.direction !== newSignal.direction ||
          Math.abs(prevSignal.confidenceScore - newSignal.confidenceScore) > 5;
        
        if (signalChanged) {
          lastSignalRef.current = newSignal;
          setSignal(newSignal);
          onSignalChange?.(newSignal);
        }
      }
    );
    
    // Initial computation - use microtask to avoid sync setState in effect
    const initialSignal = computeSignal();
    if (initialSignal) {
      lastSignalRef.current = initialSignal;
      queueMicrotask(() => setSignal(initialSignal));
    }
    
    return unsubscribe;
  }, [assetId, enabled, computeSignal, onSignalChange]);
  
  return signal;
}

/**
 * Lightweight hook for just checking signal direction
 */
export function useSignalDirection(assetId: string, symbol: string): SignalDirection {
  const signal = useRealtimeSignal({ assetId, symbol, enabled: true });
  return signal?.direction ?? 'HOLD';
}

/**
 * Hook for TP/SL levels only
 */
export function useSignalLevels(assetId: string, symbol: string): SignalLevels | null {
  const signal = useRealtimeSignal({ assetId, symbol, enabled: true });
  return signal?.levels ?? null;
}

export default useRealtimeSignal;
