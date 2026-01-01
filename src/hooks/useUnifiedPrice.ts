/**
 * Unified Price Hook
 * Vision AI Mind - Single Source of Truth for Price Display
 * 
 * Ensures ALL components use the SAME price data.
 * Eliminates price discrepancies between TradingView, Fibonacci, TP/SL.
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useMemo } from 'react';
import { usePriceStore, type UnifiedPriceState } from '../stores/usePriceStore';

export interface UseUnifiedPriceReturn extends UnifiedPriceState {
  /** Formatted price string with USD symbol */
  formatted: string;
  /** Price change direction: 'up', 'down', or 'neutral' */
  direction: 'up' | 'down' | 'neutral';
  /** Whether price data is available */
  hasPrice: boolean;
  /** Whether data is from live WebSocket */
  isLive: boolean;
  /** Staleness indicator (>30s since last update) */
  isStale: boolean;
}

/**
 * Hook to get unified price for any asset
 * This is the SINGLE SOURCE OF TRUTH - use this everywhere
 * 
 * @param assetId - The asset identifier (e.g., "BTCUSD", "gold-xauusd")
 * @param fallbackPrice - Optional fallback if no price available
 */
export function useUnifiedPrice(
  assetId: string | null | undefined,
  fallbackPrice?: number | null
): UseUnifiedPriceReturn {
  const getUnifiedPrice = usePriceStore((s) => s.getUnifiedPrice);
  const getAssetState = usePriceStore((s) => s.getAssetState);
  
  return useMemo(() => {
    if (!assetId) {
      return {
        lastPrice: fallbackPrice ?? null,
        lastUpdatedAt: null,
        source: 'fallback' as const,
        provider: null,
        formatted: fallbackPrice ? formatPrice(fallbackPrice) : '--',
        direction: 'neutral' as const,
        hasPrice: fallbackPrice !== null && fallbackPrice !== undefined,
        isLive: false,
        isStale: true,
      };
    }
    
    const unified = getUnifiedPrice(assetId);
    const assetState = getAssetState(assetId);
    
    const price = unified.lastPrice ?? fallbackPrice ?? null;
    const hasPrice = price !== null;
    const isLive = unified.source === 'websocket';
    // Staleness is based on whether we have a recent update timestamp
    // The component using this can compute actual staleness if needed
    const isStale = !unified.lastUpdatedAt;
    
    // Determine direction from recent trades or REST change
    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (assetState.trades.length >= 2) {
      const latest = assetState.trades[0]?.price;
      const previous = assetState.trades[1]?.price;
      if (latest && previous) {
        direction = latest > previous ? 'up' : latest < previous ? 'down' : 'neutral';
      }
    } else if (assetState.restChange24h !== null) {
      direction = assetState.restChange24h > 0 ? 'up' : assetState.restChange24h < 0 ? 'down' : 'neutral';
    }
    
    return {
      lastPrice: price,
      lastUpdatedAt: unified.lastUpdatedAt,
      source: unified.source,
      provider: unified.provider,
      formatted: hasPrice ? formatPrice(price!) : '--',
      direction,
      hasPrice,
      isLive,
      isStale,
    };
  }, [assetId, fallbackPrice, getUnifiedPrice, getAssetState]);
}

/**
 * Format price with appropriate precision
 */
function formatPrice(price: number): string {
  if (price >= 10000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 100) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  }
  // For very small prices (meme coins)
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 })}`;
}

/**
 * Hook for selected asset price (uses store's selected asset)
 */
export function useSelectedAssetPrice(fallbackPrice?: number | null): UseUnifiedPriceReturn {
  const selectedAssetId = usePriceStore((s) => s.selectedAssetId);
  return useUnifiedPrice(selectedAssetId, fallbackPrice);
}

export default useUnifiedPrice;
