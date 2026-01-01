/**
 * useMarketData - React Hook for Live Market Data
 * 
 * Fetches real-time price data for supported crypto assets
 * Automatically polls based on crypto update interval
 * Handles visibility changes and intersection observer for performance
 * 
 * @author Vision AI Mind
 * @version 2.0.0
 * 
 * Usage:
 *   const { price, change, changePercent, isLoading, error } = useMarketData('BTC');
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeFixed } from "../lib/safeFixed";

// ============================================================================
// TYPES
// ============================================================================

export type AssetType = 'crypto';
type MarketAbortSignal = AbortSignal;

export interface MarketData {
  /** Current price */
  price: number | null;
  /** Absolute price change (24h) */
  change: number | null;
  /** Percentage price change (24h) */
  changePercent: number | null;
  /** Previous close price */
  previousClose: number | null;
  /** 24h high */
  high24h: number | null;
  /** 24h low */
  low24h: number | null;
  /** 24h volume */
  volume: number | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last successful update timestamp */
  lastUpdate: number | null;
  /** Asset type (crypto) */
  type: AssetType | null;
  /** Data provider (binance, yahoo) */
  provider: string | null;
  /** Display name */
  displayName: string | null;
  /** Yahoo ticker */
  ticker: string | null;
}

interface ApiResponse {
  ok: boolean;
  status: 'ok' | 'cached' | 'error';
  data?: {
    symbol: string;
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    previousClose: number;
    high24h: number;
    low24h: number;
    volume: number;
    timestamp: number;
    type: AssetType;
    displayName: string;
    provider: string;
  };
  error?: string;
  cached?: boolean;
}

// ============================================================================
// UPDATE INTERVALS BY ASSET TYPE
// ============================================================================

const UPDATE_INTERVALS: Record<AssetType, number> = {
  crypto: 2000,     // 2 seconds (Binance is fast)
};

// Default interval if type unknown
const DEFAULT_INTERVAL = 5000;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useMarketData(symbol: string): MarketData {
  // State
  const [data, setData] = useState<MarketData>({
    price: null,
    change: null,
    changePercent: null,
    previousClose: null,
    high24h: null,
    low24h: null,
    volume: null,
    isLoading: true,
    error: null,
    lastUpdate: null,
    type: null,
    provider: null,
    displayName: null,
    ticker: null
  });
  
  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const lastSymbolRef = useRef<string>(symbol);
  
  // Fetch market data
  const fetchData = useCallback(async (abortSignal?: MarketAbortSignal): Promise<void> => {
    // Skip if tab is hidden
    if (!isVisibleRef.current) {
      return;
    }
    
    try {
      const url = `/api/market-data?symbol=${encodeURIComponent(symbol)}`;
      
      const response = await fetch(url, {
        signal: abortSignal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const json: ApiResponse = await response.json();
      
      if (!json.ok || !json.data) {
        throw new Error(json.error || 'Failed to fetch data');
      }
      
      // Update state with new data
      setData({
        price: json.data.price,
        change: json.data.change,
        changePercent: json.data.changePercent,
        previousClose: json.data.previousClose,
        high24h: json.data.high24h,
        low24h: json.data.low24h,
        volume: json.data.volume,
        isLoading: false,
        error: null,
        lastUpdate: json.data.timestamp,
        type: json.data.type,
        provider: json.data.provider,
        displayName: json.data.displayName,
        ticker: json.data.ticker
      });
      
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      // Keep existing data but set error
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [symbol]);
  
  // Setup polling and visibility handling
  useEffect(() => {
    // Cancel previous requests when symbol changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear previous interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Reset loading state when symbol changes
    if (lastSymbolRef.current !== symbol) {
      lastSymbolRef.current = symbol;
      setData(prev => ({
        ...prev,
        isLoading: true,
        error: null
      }));
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    // Initial fetch
    fetchData(abortControllerRef.current.signal);
    
    // Get update interval based on current asset type
    const getInterval = (): number => {
      const type = data.type;
      if (type && UPDATE_INTERVALS[type]) {
        return UPDATE_INTERVALS[type];
      }
      
      // Guess interval from symbol name
      const upperSymbol = symbol.toUpperCase();
      if (upperSymbol) {
        return UPDATE_INTERVALS.crypto;
      }
      
      return DEFAULT_INTERVAL;
    };
    
    // Setup polling interval
    const interval = getInterval();
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) {
        abortControllerRef.current = new AbortController();
        fetchData(abortControllerRef.current.signal);
      }
    }, interval);
    
    // Visibility change handler
    const handleVisibilityChange = (): void => {
      isVisibleRef.current = document.visibilityState === 'visible';
      
      // Fetch immediately when tab becomes visible
      if (isVisibleRef.current) {
        abortControllerRef.current = new AbortController();
        fetchData(abortControllerRef.current.signal);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [symbol, fetchData, data.type]);
  
  return data;
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook for formatted price display
 */
export function useFormattedPrice(symbol: string): {
  formattedPrice: string;
  formattedChange: string;
  isPositive: boolean;
  isLoading: boolean;
} {
  const { price, change, changePercent, isLoading, type } = useMarketData(symbol);
  
  // Format price for crypto
  const formatPrice = (p: number | null, _t: AssetType | null): string => {
    if (p === null) return "--";
    const decimals = p < 1 ? 6 : 2;
    return `$${p.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };
  
  const formattedPrice = formatPrice(price, type);
  const isPositive = (change ?? 0) >= 0;
  const formattedChange = changePercent !== null 
    ? `${isPositive ? '+' : ''}${safeFixed(changePercent, 2)}%`
    : '--';
  
  return {
    formattedPrice,
    formattedChange,
    isPositive,
    isLoading
  };
}

/**
 * Hook for multiple symbols at once
 */
export function useMultipleMarketData(symbols: string[]): Record<string, MarketData> {
  const [allData, setAllData] = useState<Record<string, MarketData>>({});
  
  useEffect(() => {
    const fetchAll = async () => {
      const results: Record<string, MarketData> = {};
      
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const response = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}`);
            const json: ApiResponse = await response.json();
            
            if (json.ok && json.data) {
              results[symbol] = {
                price: json.data.price,
                change: json.data.change,
                changePercent: json.data.changePercent,
                previousClose: json.data.previousClose,
                high24h: json.data.high24h,
                low24h: json.data.low24h,
                volume: json.data.volume,
                isLoading: false,
                error: null,
                lastUpdate: json.data.timestamp,
                type: json.data.type,
                provider: json.data.provider,
                displayName: json.data.displayName,
                ticker: json.data.ticker
              };
            } else {
              results[symbol] = {
                price: null,
                change: null,
                changePercent: null,
                previousClose: null,
                high24h: null,
                low24h: null,
                volume: null,
                isLoading: false,
                error: json.error || 'Failed',
                lastUpdate: null,
                type: null,
                provider: null,
                displayName: null,
                ticker: null
              };
            }
          } catch (error) {
            results[symbol] = {
              price: null,
              change: null,
              changePercent: null,
              previousClose: null,
              high24h: null,
              low24h: null,
              volume: null,
              isLoading: false,
              error: error instanceof Error ? error.message : 'Error',
              lastUpdate: null,
              type: null,
              provider: null,
              displayName: null,
              ticker: null
            };
          }
        })
      );
      
      setAllData(results);
    };
    
    fetchAll();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchAll, 5000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(symbols)]);
  
  return allData;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default useMarketData;
