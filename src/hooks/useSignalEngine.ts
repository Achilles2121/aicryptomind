/**
 * Signal Engine Integration Hook
 * Vision AI Mind - Complete Trading Signal Pipeline
 * 
 * Combines OHLC loading, candle syncing, and signal computation
 * into a single, easy-to-use hook for dashboard components.
 * 
 * Features:
 * - Automatic OHLC data loading from API
 * - Real-time tick processing
 * - 8-Point Algorithm signal generation
 * - TP/SL/Fibonacci level calculation
 * - Multi-asset class support (crypto, commodity, forex)
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useEffect, useMemo } from 'react';
import { useCandleLoader } from './useCandleLoader';
import { useRealtimeSignal, type RealTimeSignal, type UseRealtimeSignalOptions } from './useRealtimeSignal';
import { usePriceStore } from '../stores/usePriceStore';
import { useCandleStore, type Timeframe } from '../stores/useCandleStore';
import { getAssetClass, getTradingViewSymbol } from '../config/supportedCoins';

// ============================================
// TYPES
// ============================================

export interface UseSignalEngineOptions {
  assetId: string;
  symbol: string;
  enabled?: boolean;
  timeframe?: Timeframe;
  refreshInterval?: number; // ms between OHLC refreshes
  onSignalChange?: (signal: RealTimeSignal) => void;
}

export interface SignalEngineState {
  // Signal data
  signal: RealTimeSignal | null;
  
  // Loading state
  isLoading: boolean;
  error: string | null;
  
  // Price data
  currentPrice: number | null;
  priceChange24h: number | null;
  
  // Asset info
  assetClass: 'crypto' | 'commodity' | 'forex';
  tradingViewSymbol: string;
  
  // Actions
  refresh: () => Promise<void>;
}

// ============================================
// MAIN HOOK
// ============================================

export function useSignalEngine(options: UseSignalEngineOptions): SignalEngineState {
  const {
    assetId,
    symbol,
    enabled = true,
    timeframe = '5m',
    refreshInterval = 60000, // 1 minute default
    onSignalChange,
  } = options;

  // Detect asset class and TradingView symbol
  const assetClass = useMemo(() => getAssetClass(symbol) as 'crypto' | 'commodity' | 'forex', [symbol]);
  const tradingViewSymbol = useMemo(() => getTradingViewSymbol(symbol) || symbol, [symbol]);

  // Load OHLC data
  const {
    isLoading,
    error,
    refresh,
    lastUpdated,
  } = useCandleLoader({
    assetId,
    symbol,
    timeframes: [timeframe, '1h', '4h'], // Load multiple timeframes
    autoLoad: enabled,
    refreshInterval: enabled ? refreshInterval : null,
  });

  // Get real-time signal
  const signal = useRealtimeSignal({
    assetId,
    symbol,
    timeframe,
    enabled: enabled && !isLoading && lastUpdated !== null,
    onSignalChange,
  } as UseRealtimeSignalOptions);

  // Get price data
  const getUnifiedPrice = usePriceStore((s) => s.getUnifiedPrice);
  const processTick = useCandleStore((s) => s.processTick);
  const unifiedPrice = useMemo(() => getUnifiedPrice(assetId), [getUnifiedPrice, assetId]);

  // Sync price ticks to candle store
  useEffect(() => {
    if (!enabled || !unifiedPrice.lastPrice) return;
    
    processTick(assetId, unifiedPrice.lastPrice, unifiedPrice.lastUpdatedAt || Date.now());
  }, [enabled, assetId, unifiedPrice.lastPrice, unifiedPrice.lastUpdatedAt, processTick]);

  return {
    signal,
    isLoading,
    error,
    currentPrice: unifiedPrice.lastPrice,
    priceChange24h: null, // Not available in UnifiedPriceState
    assetClass,
    tradingViewSymbol,
    refresh,
  };
}

export default useSignalEngine;
