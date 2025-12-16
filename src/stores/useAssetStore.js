// Copyright (c) 2025 Vision AI Mind. All rights reserved.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { 
  ASSETS, 
  getAssetById, 
  getTVSymbolForAsset,
  getAssetClass,
  getAllAssets,
} from "../config/assets";

/**
 * Asset Store State
 */
const useAssetStore = create(
  persist(
    (set, get) => ({
      // Current selected asset ID
      selectedAssetId: "BTCUSD",
      
      // Current asset class filter
      selectedAssetClass: "crypto",
      
      // Chart timeframe (in minutes)
      timeframe: 60, // 1 hour default
      
      // Available timeframes
      availableTimeframes: [1, 5, 15, 30, 60, 240, 1440, 10080],
      
      /**
       * Get the full current asset object
       */
      getCurrentAsset: () => {
        const state = get();
        return getAssetById(state.selectedAssetId) || ASSETS.crypto[0];
      },
      
      /**
       * Get TradingView symbol for current asset
       */
      getTVSymbol: () => {
        const state = get();
        return getTVSymbolForAsset(state.selectedAssetId);
      },
      
      /**
       * Get Yahoo symbol for current asset
       */
      getYahooSymbol: () => {
        const asset = get().getCurrentAsset();
        return asset?.symbol || "BTC-USD";
      },
      
      /**
       * Get display label for current asset
       */
      getDisplayLabel: () => {
        const asset = get().getCurrentAsset();
        return asset?.label || "Bitcoin";
      },
      
      /**
       * Select an asset by ID
       */
      selectAsset: (assetId) => {
        const asset = getAssetById(assetId);
        if (asset) {
          const assetClass = getAssetClass(assetId);
          set({ 
            selectedAssetId: asset.id,
            selectedAssetClass: assetClass,
          });
          console.log("[AssetStore] Asset selected:", asset.label, "| TV:", asset.tvSymbol);
        } else {
          console.warn("[AssetStore] Unknown asset ID:", assetId);
        }
      },
      
      /**
       * Select asset class (for filtering UI)
       */
      selectAssetClass: (assetClass) => {
        set({ selectedAssetClass: assetClass });
        // Auto-select first asset in class if current doesn't match
        const currentAsset = get().getCurrentAsset();
        if (getAssetClass(currentAsset.id) !== assetClass) {
          const firstInClass = ASSETS[assetClass]?.[0];
          if (firstInClass) {
            set({ selectedAssetId: firstInClass.id });
          }
        }
      },
      
      /**
       * Set chart timeframe
       */
      setTimeframe: (minutes) => {
        set({ timeframe: minutes });
        console.log("[AssetStore] Timeframe changed to:", minutes, "min");
      },
      
      /**
       * Get assets for current class
       */
      getAssetsForCurrentClass: () => {
        const state = get();
        return ASSETS[state.selectedAssetClass] || [];
      },
      
      /**
       * Search assets by query
       */
      searchAssets: (query) => {
        if (!query || query.length < 1) return getAllAssets().slice(0, 10);
        const q = query.toLowerCase();
        return getAllAssets().filter(
          (a) => 
            a.id.toLowerCase().includes(q) ||
            a.label.toLowerCase().includes(q) ||
            a.symbol.toLowerCase().includes(q)
        ).slice(0, 20);
      },
      
      /**
       * Convert timeframe to TradingView interval format
       */
      getTVInterval: () => {
        const { timeframe } = get();
        const map = {
          1: "1",
          5: "5",
          15: "15",
          30: "30",
          60: "60",
          240: "240",
          1440: "D",
          10080: "W",
        };
        return map[timeframe] || "60";
      },
      
      /**
       * Get formatted timeframe label
       */
      getTimeframeLabel: () => {
        const { timeframe } = get();
        const labels = {
          1: "1m",
          5: "5m",
          15: "15m",
          30: "30m",
          60: "1h",
          240: "4h",
          1440: "1D",
          10080: "1W",
        };
        return labels[timeframe] || "1h";
      },
    }),
    {
      name: "asset-store",
      partialize: (state) => ({
        selectedAssetId: state.selectedAssetId,
        selectedAssetClass: state.selectedAssetClass,
        timeframe: state.timeframe,
      }),
    }
  )
);

export default useAssetStore;
