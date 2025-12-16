// Copyright (c) 2025 Vision AI Mind. All rights reserved.

/**
 * TradingView Symbol Mapping
 * Maps our internal asset IDs to TradingView symbols
 * 
 * NOTE: This file is kept for backwards compatibility.
 * For new code, use: import { getTVSymbolForAsset } from '../config/assets';
 */

import { ASSETS, getAssetById, getTVSymbolForAsset as getConfigTVSymbol } from '../config/assets';

// Build lookup tables from central config
const buildSymbolMap = (assets) => {
  const map = {};
  assets.forEach(asset => {
    map[asset.id] = asset.tvSymbol;
    if (asset.base) map[asset.base] = asset.tvSymbol;
  });
  return map;
};

// Crypto symbols (from central config)
const CRYPTO_SYMBOLS = buildSymbolMap(ASSETS.crypto);

// Forex symbols (from central config)
const FOREX_SYMBOLS = buildSymbolMap(ASSETS.forex);

// Index symbols (from central config)  
const INDEX_SYMBOLS = buildSymbolMap(ASSETS.indices);

// Commodity symbols (from central config)
const COMMODITY_SYMBOLS = buildSymbolMap(ASSETS.commodities);

// Combined lookup
const ALL_SYMBOLS = {
  ...CRYPTO_SYMBOLS,
  ...FOREX_SYMBOLS,
  ...INDEX_SYMBOLS,
  ...COMMODITY_SYMBOLS,
};

/**
 * Get TradingView symbol from internal asset ID
 * Uses central config as primary source, fallback to local maps
 * @param {string} assetId - Internal asset ID (e.g., "BTC", "EURUSD", "SPX")
 * @param {string} assetClass - Optional asset class hint
 * @returns {string} TradingView symbol
 */
export function getTradingViewSymbol(assetId, assetClass) {
  if (!assetId) return "BINANCE:BTCUSDT";
  
  // First try central config (most reliable)
  const configSymbol = getConfigTVSymbol(assetId);
  if (configSymbol && configSymbol !== "BINANCE:BTCUSDT") {
    return configSymbol;
  }
  
  // Try direct asset lookup
  const asset = getAssetById(assetId);
  if (asset?.tvSymbol) {
    return asset.tvSymbol;
  }
  
  const normalized = assetId.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  
  // Direct lookup from combined map
  if (ALL_SYMBOLS[normalized]) {
    return ALL_SYMBOLS[normalized];
  }
  
  // Try with common suffixes removed
  const withoutSuffix = normalized.replace(/(USD|USDT|EUR|GBP)$/, "");
  if (ALL_SYMBOLS[withoutSuffix]) {
    return ALL_SYMBOLS[withoutSuffix];
  }
  
  // Fallback based on asset class
  if (assetClass === "crypto") {
    return `BINANCE:${normalized}USDT`;
  }
  if (assetClass === "fx" || assetClass === "forex") {
    return `FX:${normalized}`;
  }
  if (assetClass === "index") {
    return `TVC:${normalized}`;
  }
  if (assetClass === "commodity") {
    return `TVC:${normalized}`;
  }
  
  // Default to Binance for unknown
  return `BINANCE:${normalized}USDT`;
}

/**
 * Get interval string for TradingView
 * @param {number|string} minutes - Interval in minutes
 * @returns {string} TradingView interval
 */
export function getTradingViewInterval(minutes) {
  const mins = Number(minutes) || 60;
  
  if (mins >= 1440) return "D"; // Daily
  if (mins >= 240) return "240"; // 4H
  if (mins >= 60) return "60"; // 1H
  if (mins >= 15) return "15"; // 15M
  if (mins >= 5) return "5"; // 5M
  return "1"; // 1M
}

/**
 * Get ticker symbols for TradingView Ticker Tape
 * Uses central config for up-to-date asset data
 * @param {string} assetClass - Filter by asset class (optional)
 * @returns {Array} Array of ticker objects
 */
export function getTickerSymbols(assetClass) {
  // Build tickers from central config
  const buildTickers = (assets, limit = 5) => 
    assets.slice(0, limit).map(a => ({ proName: a.tvSymbol, title: a.label }));
  
  const cryptoTickers = buildTickers(ASSETS.crypto, 5);
  const forexTickers = buildTickers(ASSETS.forex, 3);
  const indexTickers = buildTickers(ASSETS.indices, 3);
  const commodityTickers = buildTickers(ASSETS.commodities, 3);
  
  if (assetClass === "crypto") return cryptoTickers;
  if (assetClass === "fx" || assetClass === "forex") return forexTickers;
  if (assetClass === "index" || assetClass === "indices") return indexTickers;
  if (assetClass === "commodity" || assetClass === "commodities") return commodityTickers;
  
  // Return mixed selection
  return [
    ...cryptoTickers.slice(0, 3),
    ...forexTickers.slice(0, 1),
    ...commodityTickers.slice(0, 1),
    ...indexTickers.slice(0, 1),
  ];
}

// Re-export from config for convenience
export { getAssetById, getTVSymbolForAsset as getAssetTVSymbol } from '../config/assets';

export default {
  getTradingViewSymbol,
  getTradingViewInterval,
  getTickerSymbols,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  INDEX_SYMBOLS,
  COMMODITY_SYMBOLS,
};
