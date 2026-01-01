/**
 * OHLC Candle Loader Hook
 * Vision AI Mind - Fetch & Sync Historical Candles
 * 
 * Loads OHLC data from /api/ohlc and syncs to useCandleStore.
 * Ensures TradingView data flows into the algorithm calculations.
 * 
 * Features:
 * - Automatic historical data fetch on mount
 * - Multi-timeframe loading
 * - Asset class aware (crypto via Binance, commodity/forex via REST)
 * - Refresh capability for live trading
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCandleStore, type Timeframe, type OHLC, type AssetClass } from '../stores/useCandleStore';
import { getAssetClass } from '../config/supportedCoins';

// ============================================
// TYPES
// ============================================

interface UseCandleLoaderOptions {
  assetId: string;
  symbol: string;
  timeframes?: Timeframe[];
  autoLoad?: boolean;
  refreshInterval?: number | null; // null = no auto-refresh
}

interface CandleLoaderState {
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  loadedTimeframes: Timeframe[];
}

interface UseCandleLoaderReturn extends CandleLoaderState {
  refresh: () => Promise<void>;
  loadTimeframe: (tf: Timeframe) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const TIMEFRAME_INTERVAL_MAP: Record<Timeframe, number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
  '4h': 240,
  '1d': 1440,
};

const DEFAULT_TIMEFRAMES: Timeframe[] = ['5m', '1h'];
const DEFAULT_CANDLE_LIMIT = 200;

// ============================================
// HELPERS
// ============================================

/**
 * Parse OHLC response to standard format
 */
const parseOhlcResponse = (data: unknown): OHLC[] => {
  // Handle array response
  if (Array.isArray(data)) {
    return data.map((candle) => ({
      t: candle.t || candle.time || candle.timestamp || candle[0] || 0,
      o: Number(candle.o || candle.open || candle[1] || 0),
      h: Number(candle.h || candle.high || candle[2] || 0),
      l: Number(candle.l || candle.low || candle[3] || 0),
      c: Number(candle.c || candle.close || candle[4] || 0),
      v: Number(candle.v || candle.volume || candle[5] || 0),
      closed: true,
    }));
  }

  // Handle envelope response { ok: true, data: [...] }
  const envelope = data as { ok?: boolean; data?: unknown[]; candles?: unknown[] };
  const candleArray = envelope.data || envelope.candles;
  
  if (Array.isArray(candleArray)) {
    return parseOhlcResponse(candleArray);
  }

  return [];
};

/**
 * Normalize symbol for API request
 */
const normalizeSymbolForApi = (symbol: string, assetClass: AssetClass): string => {
  // For crypto, strip trailing T if present (BTCUSDT -> BTCUSD)
  if (assetClass === 'crypto') {
    return symbol.replace(/USDT?$/, 'USD');
  }
  
  // For commodity/forex, use symbol as-is or map from internal ID
  if (symbol.startsWith('gold-')) return 'XAUUSD';
  if (symbol.startsWith('silver-')) return 'XAGUSD';
  if (symbol.startsWith('forex-eurusd')) return 'EURUSD';
  if (symbol.startsWith('forex-gbpusd')) return 'GBPUSD';
  if (symbol.startsWith('forex-usdjpy')) return 'USDJPY';
  
  return symbol;
};

// ============================================
// MAIN HOOK
// ============================================

export function useCandleLoader(options: UseCandleLoaderOptions): UseCandleLoaderReturn {
  const {
    assetId,
    symbol,
    timeframes = DEFAULT_TIMEFRAMES,
    autoLoad = true,
    refreshInterval = null,
  } = options;

  // Store actions
  const initAsset = useCandleStore((s) => s.initAsset);
  const loadHistoricalCandles = useCandleStore((s) => s.loadHistoricalCandles);

  // Local state
  const [state, setState] = useState<CandleLoaderState>({
    isLoading: false,
    error: null,
    lastUpdated: null,
    loadedTimeframes: [],
  });

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Asset class detection
  const assetClass = getAssetClass(symbol) as AssetClass;

  /**
   * Load candles for a specific timeframe
   */
  const loadTimeframe = useCallback(async (tf: Timeframe): Promise<void> => {
    const interval = TIMEFRAME_INTERVAL_MAP[tf];
    const apiSymbol = normalizeSymbolForApi(symbol, assetClass);
    const url = `/api/ohlc?asset=${encodeURIComponent(apiSymbol)}&interval=${interval}&limit=${DEFAULT_CANDLE_LIMIT}`;

    try {
      const response = await fetch(url, {
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const candles = parseOhlcResponse(data);

      if (candles.length > 0) {
        // Sort by timestamp descending (newest first)
        candles.sort((a, b) => b.t - a.t);
        loadHistoricalCandles(assetId, tf, candles);
        
        setState((prev) => ({
          ...prev,
          loadedTimeframes: prev.loadedTimeframes.includes(tf)
            ? prev.loadedTimeframes
            : [...prev.loadedTimeframes, tf],
        }));
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.warn(`[CandleLoader] Failed to load ${tf} for ${symbol}:`, err);
      throw err;
    }
  }, [assetId, symbol, assetClass, loadHistoricalCandles]);

  /**
   * Load all configured timeframes
   */
  const loadAllTimeframes = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Initialize asset in store
    initAsset(assetId, symbol, assetClass);

    try {
      // Load timeframes in parallel
      await Promise.all(timeframes.map(loadTimeframe));
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdated: Date.now(),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: (err as Error).message || 'Failed to load candles',
      }));
    }
  }, [assetId, symbol, assetClass, timeframes, initAsset, loadTimeframe]);

  /**
   * Refresh candle data
   */
  const refresh = useCallback(async (): Promise<void> => {
    await loadAllTimeframes();
  }, [loadAllTimeframes]);

  // Auto-load on mount
  useEffect(() => {
    if (!autoLoad) return;

    abortControllerRef.current = new AbortController();
    loadAllTimeframes();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [autoLoad, assetId, symbol, loadAllTimeframes]); // Re-load when asset changes

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    refreshTimerRef.current = setInterval(() => {
      loadAllTimeframes();
    }, refreshInterval);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshInterval, loadAllTimeframes]);

  return {
    ...state,
    refresh,
    loadTimeframe,
  };
}

export default useCandleLoader;
