/**
 * Vision AI Mind - Multi-Timeframe Signal Hook
 * 
 * Combines signals from multiple timeframes for stronger trade decisions.
 * Uses the Confluence Engine to weight and aggregate signals.
 * 
 * Features:
 * - 4 Timeframes: 15m, 1h, 4h, 1D
 * - Weighted scoring (higher TF = more weight)
 * - Confluence detection for ultra signals
 * - Real-time updates via candle store
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useMemo, useCallback } from 'react';
import { useCandleStore, type Timeframe, type OHLC } from '../stores/useCandleStore';
import { usePriceStore } from '../stores/usePriceStore';
import { 
  calculateConfluence, 
  createTimeframeSignal,
  type ConfluenceResult,
  type TimeframeSignal,
} from '../lib/confluenceEngine';
import { getVolatilityProfile } from '../config/supportedCoins';

// ============================================
// TYPES
// ============================================

export interface UseMultiTimeframeOptions {
  assetId: string;
  symbol: string;
  enabled?: boolean;
}

export interface MultiTimeframeState {
  confluence: ConfluenceResult | null;
  isLoading: boolean;
  hasAllTimeframes: boolean;
  availableTimeframes: Timeframe[];
  refresh: () => void;
}

// Timeframes to analyze
const ANALYSIS_TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', '1d'];

// ============================================
// INDICATOR CALCULATIONS
// ============================================

/**
 * Calculate RSI from closes
 */
function calculateRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate EMA
 */
function calculateEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  
  const multiplier = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate MACD
 */
function calculateMACD(closes: number[]): { histogram: number | null } {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  if (ema12 === null || ema26 === null) return { histogram: null };
  
  const macdLine = ema12 - ema26;
  
  // Simplified - just return if bullish or bearish
  return { histogram: macdLine };
}

// ============================================
// MAIN HOOK
// ============================================

export function useMultiTimeframe(options: UseMultiTimeframeOptions): MultiTimeframeState {
  const { assetId, symbol, enabled = true } = options;
  
  // Get candle store functions
  const getCandles = useCandleStore((s) => s.getCandles);
  
  // Get current price
  const getUnifiedPrice = usePriceStore((s) => s.getUnifiedPrice);
  const currentPrice = getUnifiedPrice(assetId)?.lastPrice ?? null;
  
  // Get volatility profile for this asset
  const volatilityProfile = useMemo(() => {
    const profile = getVolatilityProfile(symbol);
    if (profile === 'high') return 'high';
    if (profile === 'medium') return 'medium';
    return 'low';
  }, [symbol]) as 'high' | 'medium' | 'low';
  
  // Check which timeframes have data
  const availableTimeframes = useMemo(() => {
    return ANALYSIS_TIMEFRAMES.filter(tf => getCandles(assetId, tf, 26).length >= 26);
  }, [assetId, getCandles]);
  
  const hasAllTimeframes = availableTimeframes.length === ANALYSIS_TIMEFRAMES.length;
  const isLoading = !enabled || availableTimeframes.length === 0;
  
  // Calculate signals for each timeframe
  const signals = useMemo((): TimeframeSignal[] => {
    if (!enabled || !currentPrice) return [];
    
    return availableTimeframes.map(tf => {
      const candles = getCandles(assetId, tf, 50);
      if (candles.length < 26) {
        return createTimeframeSignal(tf, null, null, null, null, currentPrice, volatilityProfile);
      }
      
      const closes = candles.map((c: OHLC) => c.c);
      
      const rsi = calculateRSI(closes);
      const macd = calculateMACD(closes);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      
      return createTimeframeSignal(
        tf,
        rsi,
        macd.histogram,
        ema20,
        ema50,
        currentPrice,
        volatilityProfile
      );
    });
  }, [assetId, enabled, currentPrice, availableTimeframes, getCandles, volatilityProfile]);
  
  // Calculate confluence
  const confluence = useMemo((): ConfluenceResult | null => {
    if (signals.length === 0) return null;
    return calculateConfluence(signals);
  }, [signals]);
  
  // Refresh function (triggers candle reload)
  const refresh = useCallback(() => {
    // This would trigger a reload in the candle loader
    // For now, it's a placeholder - the actual refresh happens via useCandleLoader
    console.log('[useMultiTimeframe] Refresh requested for', assetId);
  }, [assetId]);
  
  return {
    confluence,
    isLoading,
    hasAllTimeframes,
    availableTimeframes,
    refresh,
  };
}

/**
 * Get confluence strength label in German
 */
export function getConfluenceLabel(strength: ConfluenceResult['strength'] | undefined): string {
  switch (strength) {
    case 'ultra': return 'Ultra-Konfluenz';
    case 'strong': return 'Starke Konfluenz';
    case 'moderate': return 'Moderate Konfluenz';
    case 'weak': return 'Schwache Konfluenz';
    case 'conflicting': return 'Widersprüchlich';
    default: return 'Analysiere...';
  }
}

/**
 * Get confluence color class
 */
export function getConfluenceColor(strength: ConfluenceResult['strength'] | undefined): string {
  switch (strength) {
    case 'ultra': return 'text-violet-400';
    case 'strong': return 'text-emerald-400';
    case 'moderate': return 'text-yellow-400';
    case 'weak': return 'text-orange-400';
    case 'conflicting': return 'text-red-400';
    default: return 'text-slate-400';
  }
}

export default useMultiTimeframe;
