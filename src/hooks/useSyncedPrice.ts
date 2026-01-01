/**
 * Synchronized Price Hook
 * Vision AI Mind - Single Source of Truth for Price Data
 * 
 * Ensures all components (TradingView, Indicators, Fibonacci, TP/SL)
 * use the exact same price data for calculations.
 * 
 * Priority: WebSocket > REST API > Fallback
 */

import { useEffect, useMemo, useRef } from 'react';
import { usePriceStore, type UnifiedPriceState, type AssetClass } from '../stores/usePriceStore';
import { getAssetClass, getTradingViewSymbol, getVolatilityProfile } from '../config/supportedCoins';
import { getAlgorithmParams } from '../config/universalMapping';

export interface SyncedPriceData {
  // Current price (Single Source of Truth)
  lastPrice: number | null;
  lastUpdatedAt: number | null;
  
  // Data source info
  source: 'websocket' | 'rest' | 'fallback';
  provider: string | null;
  latencyMs: number | null;
  
  // Asset metadata
  assetClass: AssetClass;
  tradingViewSymbol: string;
  volatilityProfile: 'high' | 'medium' | 'low';
  
  // Algorithm parameters (adjusted for asset class)
  algorithmParams: ReturnType<typeof getAlgorithmParams>;
  
  // Status
  isLive: boolean;
  hasIntegrityWarning: boolean;
  integrityDelta: number | null;
}

export interface UseSyncedPriceOptions {
  /** Asset ID (e.g., "bitcoin", "gold-xauusd") */
  assetId: string;
  /** Symbol (e.g., "BTC", "XAUUSD") */
  symbol?: string;
  /** Enable WebSocket connection */
  enableWebSocket?: boolean;
  /** Fallback poll interval (ms) */
  pollIntervalMs?: number;
  /** Callback when price updates */
  onPriceUpdate?: (data: SyncedPriceData) => void;
}

/**
 * Hook that provides synchronized price data across all components
 * 
 * @example
 * const { lastPrice, tradingViewSymbol, algorithmParams } = useSyncedPrice({
 *   assetId: 'gold-xauusd',
 *   symbol: 'XAUUSD'
 * });
 * 
 * // Use lastPrice for Fibonacci calculations
 * // Use tradingViewSymbol for chart
 * // Use algorithmParams for indicator thresholds
 */
export function useSyncedPrice(options: UseSyncedPriceOptions): SyncedPriceData {
  const { 
    assetId, 
    symbol,
    enableWebSocket = true,
    onPriceUpdate 
  } = options;
  
  const effectiveSymbol = symbol || assetId;
  
  // Get store methods
  const getUnifiedPrice = usePriceStore((state) => state.getUnifiedPrice);
  const selectPriceAsset = usePriceStore((state) => state.selectPriceAsset);
  const connect = usePriceStore((state) => state.connect);
  const disconnect = usePriceStore((state) => state.disconnect);
  
  // Derive asset metadata
  const assetClass = useMemo(() => {
    const cls = getAssetClass(effectiveSymbol);
    return cls as AssetClass;
  }, [effectiveSymbol]);
  
  const tradingViewSymbol = useMemo(() => {
    return getTradingViewSymbol(effectiveSymbol);
  }, [effectiveSymbol]);
  
  const volatilityProfile = useMemo(() => {
    return getVolatilityProfile(effectiveSymbol) as 'high' | 'medium' | 'low';
  }, [effectiveSymbol]);
  
  const algorithmParams = useMemo(() => {
    return getAlgorithmParams(effectiveSymbol);
  }, [effectiveSymbol]);
  
  // Get unified price (Single Source of Truth)
  const unifiedPrice = getUnifiedPrice(assetId);
  const assetState = selectPriceAsset(assetId);
  
  // Connect to WebSocket for crypto assets
  const prevAssetIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!enableWebSocket) return;
    if (prevAssetIdRef.current === assetId) return;
    
    prevAssetIdRef.current = assetId;
    
    // Only connect WebSocket for crypto (Binance)
    const isCrypto = assetClass === 'crypto';
    const binanceSymbol = isCrypto ? `${effectiveSymbol.toUpperCase()}USDT` : null;
    
    if (isCrypto && binanceSymbol) {
      connect({
        assetId,
        binanceSymbol,
        isCrypto: true,
        assetClass,
        tradingViewSymbol,
        resetOnConnect: true,
      });
    }
    
    return () => {
      disconnect(assetId);
    };
  }, [assetId, assetClass, effectiveSymbol, tradingViewSymbol, enableWebSocket, connect, disconnect]);
  
  // Build synced price data
  const syncedData: SyncedPriceData = useMemo(() => {
    const isLive = assetState.wsStatus === 'live' && unifiedPrice.lastPrice !== null;
    
    return {
      // Price data
      lastPrice: unifiedPrice.lastPrice,
      lastUpdatedAt: unifiedPrice.lastUpdatedAt,
      
      // Source info
      source: unifiedPrice.source,
      provider: unifiedPrice.provider,
      latencyMs: assetState.restLatencyMs,
      
      // Asset metadata
      assetClass,
      tradingViewSymbol,
      volatilityProfile,
      
      // Algorithm params (adjusted for volatility)
      algorithmParams,
      
      // Status
      isLive,
      hasIntegrityWarning: assetState.integrityWarning,
      integrityDelta: assetState.integrityDelta,
    };
  }, [
    unifiedPrice, 
    assetState, 
    assetClass, 
    tradingViewSymbol, 
    volatilityProfile, 
    algorithmParams
  ]);
  
  // Notify on price update
  const lastPriceRef = useRef(syncedData.lastPrice);
  useEffect(() => {
    if (syncedData.lastPrice !== lastPriceRef.current) {
      lastPriceRef.current = syncedData.lastPrice;
      onPriceUpdate?.(syncedData);
    }
  }, [syncedData, onPriceUpdate]);
  
  return syncedData;
}

/**
 * Selector hook for reading unified price from store
 * Use this in components that only need to read price, not manage connections
 */
export function useUnifiedPrice(assetId: string): UnifiedPriceState {
  return usePriceStore((state) => state.getUnifiedPrice(assetId));
}

/**
 * Hook to get algorithm parameters adjusted for asset volatility
 */
export function useAlgorithmParams(symbol: string) {
  return useMemo(() => getAlgorithmParams(symbol), [symbol]);
}

export default useSyncedPrice;
