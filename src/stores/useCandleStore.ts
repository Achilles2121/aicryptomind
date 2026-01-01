/**
 * OHLC Candle Synchronization Store
 * Vision AI Mind - Single Source of Truth for Candle Data
 * 
 * Ensures all components (TradingView, Indicators, Fibonacci, TP/SL)
 * use identical OHLC data synchronized to the same candle close times.
 * 
 * Features:
 * - Real-time candle aggregation from WebSocket ticks
 * - Candle close synchronization with TradingView widget
 * - Multi-timeframe support (1m, 5m, 15m, 1h, 4h, 1d)
 * - Asset class aware (Crypto via Binance, Gold/Forex via REST polling)
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================
// TYPES
// ============================================

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
export type AssetClass = 'crypto' | 'commodity' | 'forex';

export interface OHLC {
  t: number;      // Timestamp (ms) - candle open time
  o: number;      // Open
  h: number;      // High
  l: number;      // Low
  c: number;      // Close
  v: number;      // Volume
  closed: boolean; // Whether this candle is closed (confirmed)
}

export interface CandleBuffer {
  timeframe: Timeframe;
  candles: OHLC[];
  currentCandle: OHLC | null;
  lastUpdated: number;
}

export interface AssetCandleState {
  assetId: string;
  symbol: string;
  assetClass: AssetClass;
  buffers: Record<Timeframe, CandleBuffer>;
  lastTick: { price: number; timestamp: number } | null;
  syncStatus: 'synced' | 'syncing' | 'stale';
}

export interface CandleStoreState {
  assets: Record<string, AssetCandleState>;
  activeAssetId: string | null;
  
  // Actions
  initAsset: (assetId: string, symbol: string, assetClass: AssetClass) => void;
  processTick: (assetId: string, price: number, timestamp: number, volume?: number) => void;
  loadHistoricalCandles: (assetId: string, timeframe: Timeframe, candles: OHLC[]) => void;
  closeCurrentCandle: (assetId: string, timeframe: Timeframe) => void;
  getCandles: (assetId: string, timeframe: Timeframe, limit?: number) => OHLC[];
  getCurrentCandle: (assetId: string, timeframe: Timeframe) => OHLC | null;
  getLatestOHLC: (assetId: string, timeframe: Timeframe) => OHLC | null;
  setActiveAsset: (assetId: string | null) => void;
  clearAsset: (assetId: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

const MAX_CANDLES = 500;
const ALL_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

// ============================================
// HELPERS
// ============================================

/**
 * Calculate candle open timestamp for a given time and timeframe
 * This ensures synchronization with TradingView candle times
 */
const getCandleOpenTime = (timestamp: number, timeframe: Timeframe): number => {
  const intervalMs = TIMEFRAME_MS[timeframe];
  return Math.floor(timestamp / intervalMs) * intervalMs;
};

/**
 * Create empty buffer for a timeframe
 */
const createEmptyBuffer = (timeframe: Timeframe): CandleBuffer => ({
  timeframe,
  candles: [],
  currentCandle: null,
  lastUpdated: 0,
});

/**
 * Create default asset state with all timeframe buffers
 */
const createDefaultAssetState = (
  assetId: string, 
  symbol: string, 
  assetClass: AssetClass
): AssetCandleState => ({
  assetId,
  symbol,
  assetClass,
  buffers: ALL_TIMEFRAMES.reduce((acc, tf) => {
    acc[tf] = createEmptyBuffer(tf);
    return acc;
  }, {} as Record<Timeframe, CandleBuffer>),
  lastTick: null,
  syncStatus: 'syncing',
});

/**
 * Update a single candle with a new tick
 */
const updateCandleWithTick = (
  candle: OHLC | null,
  price: number,
  timestamp: number,
  volume: number,
  timeframe: Timeframe
): OHLC => {
  const candleOpenTime = getCandleOpenTime(timestamp, timeframe);
  
  if (!candle || candle.t !== candleOpenTime) {
    // New candle
    return {
      t: candleOpenTime,
      o: price,
      h: price,
      l: price,
      c: price,
      v: volume,
      closed: false,
    };
  }
  
  // Update existing candle
  return {
    ...candle,
    h: Math.max(candle.h, price),
    l: Math.min(candle.l, price),
    c: price,
    v: candle.v + volume,
    closed: false,
  };
};

// ============================================
// STORE
// ============================================

export const useCandleStore = create<CandleStoreState>()(
  subscribeWithSelector((set, get) => ({
    assets: {},
    activeAssetId: null,
    
    setActiveAsset: (assetId) => set({ activeAssetId: assetId }),
    
    initAsset: (assetId, symbol, assetClass) => {
      const existing = get().assets[assetId];
      if (existing) return; // Already initialized
      
      set((state) => ({
        assets: {
          ...state.assets,
          [assetId]: createDefaultAssetState(assetId, symbol, assetClass),
        },
      }));
    },
    
    /**
     * Process a real-time price tick
     * Updates all timeframe candles simultaneously
     * This is the SINGLE SOURCE OF TRUTH for live candle data
     */
    processTick: (assetId, price, timestamp, volume = 0) => {
      set((state) => {
        const asset = state.assets[assetId];
        if (!asset) return state;
        
        const now = timestamp || Date.now();
        const updatedBuffers = { ...asset.buffers };
        
        // Update all timeframe buffers
        for (const tf of ALL_TIMEFRAMES) {
          const buffer = updatedBuffers[tf];
          const currentCandleOpen = getCandleOpenTime(now, tf);
          const prevCandle = buffer.currentCandle;
          
          // Check if we need to close the previous candle
          if (prevCandle && prevCandle.t !== currentCandleOpen) {
            // Close the previous candle and add to history
            const closedCandle = { ...prevCandle, closed: true };
            const updatedCandles = [closedCandle, ...buffer.candles].slice(0, MAX_CANDLES);
            
            updatedBuffers[tf] = {
              ...buffer,
              candles: updatedCandles,
              currentCandle: {
                t: currentCandleOpen,
                o: price,
                h: price,
                l: price,
                c: price,
                v: volume,
                closed: false,
              },
              lastUpdated: now,
            };
          } else {
            // Update current candle
            updatedBuffers[tf] = {
              ...buffer,
              currentCandle: updateCandleWithTick(prevCandle, price, now, volume, tf),
              lastUpdated: now,
            };
          }
        }
        
        return {
          assets: {
            ...state.assets,
            [assetId]: {
              ...asset,
              buffers: updatedBuffers,
              lastTick: { price, timestamp: now },
              syncStatus: 'synced',
            },
          },
        };
      });
    },
    
    /**
     * Load historical candles (from API or cache)
     * Used for initial load and reconnection scenarios
     */
    loadHistoricalCandles: (assetId, timeframe, candles) => {
      set((state) => {
        const asset = state.assets[assetId];
        if (!asset) return state;
        
        // Mark all loaded candles as closed
        const closedCandles = candles.map((c) => ({ ...c, closed: true }));
        
        return {
          assets: {
            ...state.assets,
            [assetId]: {
              ...asset,
              buffers: {
                ...asset.buffers,
                [timeframe]: {
                  ...asset.buffers[timeframe],
                  candles: closedCandles.slice(0, MAX_CANDLES),
                  lastUpdated: Date.now(),
                },
              },
              syncStatus: 'synced',
            },
          },
        };
      });
    },
    
    /**
     * Manually close the current candle
     * Used for synchronization with external candle close events
     */
    closeCurrentCandle: (assetId, timeframe) => {
      set((state) => {
        const asset = state.assets[assetId];
        if (!asset) return state;
        
        const buffer = asset.buffers[timeframe];
        if (!buffer.currentCandle) return state;
        
        const closedCandle = { ...buffer.currentCandle, closed: true };
        const updatedCandles = [closedCandle, ...buffer.candles].slice(0, MAX_CANDLES);
        
        return {
          assets: {
            ...state.assets,
            [assetId]: {
              ...asset,
              buffers: {
                ...asset.buffers,
                [timeframe]: {
                  ...buffer,
                  candles: updatedCandles,
                  currentCandle: null,
                  lastUpdated: Date.now(),
                },
              },
            },
          },
        };
      });
    },
    
    /**
     * Get closed candles for a timeframe
     * Returns only confirmed/closed candles for indicator calculations
     */
    getCandles: (assetId, timeframe, limit = 100) => {
      const asset = get().assets[assetId];
      if (!asset) return [];
      
      const buffer = asset.buffers[timeframe];
      return buffer.candles.slice(0, limit);
    },
    
    /**
     * Get the current (unclosed) candle
     */
    getCurrentCandle: (assetId, timeframe) => {
      const asset = get().assets[assetId];
      if (!asset) return null;
      
      return asset.buffers[timeframe].currentCandle;
    },
    
    /**
     * Get the latest OHLC (current or most recent closed)
     * This is the PRIMARY ACCESSOR for indicator calculations
     */
    getLatestOHLC: (assetId, timeframe) => {
      const asset = get().assets[assetId];
      if (!asset) return null;
      
      const buffer = asset.buffers[timeframe];
      
      // Return current candle if available, otherwise most recent closed
      if (buffer.currentCandle) return buffer.currentCandle;
      return buffer.candles[0] || null;
    },
    
    clearAsset: (assetId) => {
      set((state) => {
        const { [assetId]: removed, ...remaining } = state.assets;
        return { assets: remaining };
      });
    },
  }))
);

// ============================================
// SELECTORS (Performance optimized)
// ============================================

/**
 * Selector for current candle of active asset
 */
export const selectActiveCurrentCandle = (timeframe: Timeframe) => 
  (state: CandleStoreState) => {
    const assetId = state.activeAssetId;
    if (!assetId) return null;
    return state.assets[assetId]?.buffers[timeframe]?.currentCandle ?? null;
  };

/**
 * Selector for closed candles of active asset
 */
export const selectActiveCandles = (timeframe: Timeframe, limit = 100) => 
  (state: CandleStoreState) => {
    const assetId = state.activeAssetId;
    if (!assetId) return [];
    return state.assets[assetId]?.buffers[timeframe]?.candles.slice(0, limit) ?? [];
  };

/**
 * Selector for last tick price
 */
export const selectLastTick = (assetId: string) => 
  (state: CandleStoreState) => state.assets[assetId]?.lastTick ?? null;

/**
 * Selector for sync status
 */
export const selectSyncStatus = (assetId: string) => 
  (state: CandleStoreState) => state.assets[assetId]?.syncStatus ?? 'stale';

export default useCandleStore;
