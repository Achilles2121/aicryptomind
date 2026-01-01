/**
 * Asset Master Configuration
 * Vision AI Mind - Elite Trader Dashboard
 * 
 * SINGLE SOURCE OF TRUTH for all asset routing, symbols, and data sources.
 * This file controls:
 * - TradingView symbol resolution (BINANCE/OANDA/FX)
 * - Price data source routing (WebSocket/REST fallback)
 * - Algorithm parameter adjustment per asset class
 * - Icon and display configuration
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 * PROPRIETARY AND CONFIDENTIAL - Do not distribute.
 */

import supportedCoins, { GOLD_FOREX_ASSETS } from "./supportedCoins.js";

// ============================================
// ASSET CLASS DEFINITIONS
// ============================================

export const ASSET_CLASS = Object.freeze({
  CRYPTO: "crypto",
  COMMODITY: "commodity",
  FOREX: "forex",
  INDEX: "index",
});

export const DATA_PROVIDER = Object.freeze({
  BINANCE: "BINANCE",
  OANDA: "OANDA",
  FX: "FX",
  FX_IDC: "FX_IDC",
  COINBASE: "COINBASE",
  KRAKEN: "KRAKEN",
  TWELVE_DATA: "TWELVE_DATA",
});

export const VOLATILITY_TIER = Object.freeze({
  EXTREME: "extreme",  // Crypto majors during high volatility
  HIGH: "high",        // Most crypto assets
  MEDIUM: "medium",    // Commodities, some forex
  LOW: "low",          // Major forex pairs
  ULTRA_LOW: "ultra_low", // Stablecoins
});

// ============================================
// BINANCE WEBSOCKET CONFIGURATION
// ============================================

export const BINANCE_WS_CONFIG = Object.freeze({
  baseUrl: "wss://stream.binance.com:9443/ws",
  combinedUrl: "wss://stream.binance.com:9443/stream",
  streamSuffix: "@trade",
  tickerSuffix: "@ticker",
  reconnectDelayMs: 1500,
  maxReconnectAttempts: 5,
  heartbeatIntervalMs: 30000,
});

/**
 * Build Binance WebSocket stream name
 * @param {string} symbol - e.g., "BTC", "ETH"
 * @returns {string} - e.g., "btcusdt@trade"
 */
export const getBinanceStreamName = (symbol) => {
  const base = String(symbol).toUpperCase().replace(/USDT?$/, "");
  return `${base.toLowerCase()}usdt${BINANCE_WS_CONFIG.streamSuffix}`;
};

/**
 * Build single asset WebSocket URL
 */
export const getBinanceWsUrl = (symbol) => {
  return `${BINANCE_WS_CONFIG.baseUrl}/${getBinanceStreamName(symbol)}`;
};

/**
 * Build combined stream URL for multiple assets
 * @param {string[]} symbols
 */
export const getBinanceCombinedStreamUrl = (symbols) => {
  const streams = symbols.map(getBinanceStreamName).join("/");
  return `${BINANCE_WS_CONFIG.combinedUrl}?streams=${streams}`;
};

// ============================================
// FOREX/GOLD POLLING CONFIGURATION
// ============================================

export const FOREX_POLLING_CONFIG = Object.freeze({
  intervalMs: 15000, // 15 seconds for TradingView precision
  fallbackIntervalMs: 30000,
  providers: ["twelvedata", "oanda", "internal"],
  endpoints: {
    internal: "/api/price",
  },
});

// ============================================
// PROVIDER ROUTING MAP
// ============================================

/**
 * Primary data source for each asset class
 * Falls back to secondary sources if primary fails
 */
const PROVIDER_ROUTING = {
  [ASSET_CLASS.CRYPTO]: {
    primary: DATA_PROVIDER.BINANCE,
    secondary: [DATA_PROVIDER.COINBASE, DATA_PROVIDER.KRAKEN],
    wsEndpoint: "wss://stream.binance.com:9443/ws",
    restEndpoint: "https://api.binance.com/api/v3",
  },
  [ASSET_CLASS.COMMODITY]: {
    primary: DATA_PROVIDER.OANDA,
    secondary: [DATA_PROVIDER.FX_IDC],
    wsEndpoint: null, // No public WS, use polling
    restEndpoint: null, // Use internal fallback
  },
  [ASSET_CLASS.FOREX]: {
    primary: DATA_PROVIDER.FX,
    secondary: [DATA_PROVIDER.FX_IDC, DATA_PROVIDER.OANDA],
    wsEndpoint: null,
    restEndpoint: null,
  },
};

// ============================================
// ALGORITHM PARAMETERS BY VOLATILITY TIER
// ============================================

/**
 * RSI, MACD, and ATR parameters adjusted for each volatility tier
 * These ensure indicators are calibrated correctly for:
 * - Crypto (high volatility, wider bands)
 * - Gold (medium volatility)
 * - Forex (low volatility, tighter bands)
 * 
 * PROPRIETARY ALGORITHM - Core trading logic
 */
const ALGORITHM_PARAMS = Object.freeze({
  [VOLATILITY_TIER.EXTREME]: {
    rsiPeriod: 14,
    rsiOversold: 25,
    rsiOverbought: 75,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrMultiplier: 2.0,
    bollingerStdDev: 2.5,
    fibRetracementLevels: [0.236, 0.382, 0.5, 0.618, 0.786],
    stopLossMultiplier: 2.5,
    takeProfitMultiplier: 3.5,
  },
  [VOLATILITY_TIER.HIGH]: {
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrMultiplier: 1.5,
    bollingerStdDev: 2.0,
    fibRetracementLevels: [0.236, 0.382, 0.5, 0.618, 0.786],
    stopLossMultiplier: 2.0,
    takeProfitMultiplier: 3.0,
  },
  [VOLATILITY_TIER.MEDIUM]: {
    rsiPeriod: 14,
    rsiOversold: 35,
    rsiOverbought: 65,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrMultiplier: 1.2,
    bollingerStdDev: 2.0,
    fibRetracementLevels: [0.236, 0.382, 0.5, 0.618],
    stopLossMultiplier: 1.5,
    takeProfitMultiplier: 2.5,
  },
  [VOLATILITY_TIER.LOW]: {
    rsiPeriod: 14,
    rsiOversold: 40,
    rsiOverbought: 60,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrMultiplier: 1.0,
    bollingerStdDev: 1.5,
    fibRetracementLevels: [0.382, 0.5, 0.618],
    stopLossMultiplier: 1.0,
    takeProfitMultiplier: 2.0,
  },
  [VOLATILITY_TIER.ULTRA_LOW]: {
    rsiPeriod: 14,
    rsiOversold: 45,
    rsiOverbought: 55,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrMultiplier: 0.5,
    bollingerStdDev: 1.0,
    fibRetracementLevels: [0.5],
    stopLossMultiplier: 0.5,
    takeProfitMultiplier: 1.0,
  },
});

// ============================================
// TRADINGVIEW SYMBOL MAPPING
// ============================================

/**
 * Maps internal asset IDs to correct TradingView widget symbols
 * This ensures 1:1 precision between chart and indicators
 */
const TV_SYMBOL_OVERRIDES = {
  // Commodities
  XAUUSD: "OANDA:XAUUSD",
  XAGUSD: "OANDA:XAGUSD",
  "gold-xauusd": "OANDA:XAUUSD",
  "silver-xagusd": "OANDA:XAGUSD",
  
  // Forex
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  USDJPY: "FX:USDJPY",
  USDCHF: "FX:USDCHF",
  AUDUSD: "FX:AUDUSD",
  USDCAD: "FX:USDCAD",
  NZDUSD: "FX:NZDUSD",
  "forex-eurusd": "FX:EURUSD",
  "forex-gbpusd": "FX:GBPUSD",
  "forex-usdjpy": "FX:USDJPY",
  
  // Crypto overrides (if needed)
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  bitcoin: "BINANCE:BTCUSDT",
  ethereum: "BINANCE:ETHUSDT",
};

// ============================================
// ASSET MASTER REGISTRY
// ============================================

/**
 * Build complete asset registry from supported coins + gold/forex
 */
const buildAssetRegistry = () => {
  const registry = new Map();
  
  // Add crypto assets
  for (const coin of supportedCoins) {
    const symbol = coin.symbol.toUpperCase();
    const isStable = ["USDT", "USDC", "DAI", "USDS", "PYUSD"].includes(symbol);
    
    registry.set(coin.id, {
      id: coin.id,
      symbol,
      name: coin.name,
      assetClass: ASSET_CLASS.CRYPTO,
      volatilityTier: isStable ? VOLATILITY_TIER.ULTRA_LOW : VOLATILITY_TIER.HIGH,
      provider: DATA_PROVIDER.BINANCE,
      tradingViewSymbol: TV_SYMBOL_OVERRIDES[symbol] || `BINANCE:${symbol}USDT`,
      binanceSymbol: `${symbol}USDT`,
      isSafeHaven: false,
      rank: coin.rank,
    });
    
    // Also index by symbol
    registry.set(symbol, registry.get(coin.id));
  }
  
  // Add gold/forex assets
  for (const asset of GOLD_FOREX_ASSETS) {
    const isCommodity = asset.assetClass === "commodity";
    const volatilityTier = asset.volatilityProfile === "low" 
      ? VOLATILITY_TIER.LOW 
      : asset.volatilityProfile === "medium"
        ? VOLATILITY_TIER.MEDIUM
        : VOLATILITY_TIER.HIGH;
    
    registry.set(asset.id, {
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      assetClass: isCommodity ? ASSET_CLASS.COMMODITY : ASSET_CLASS.FOREX,
      volatilityTier,
      provider: isCommodity ? DATA_PROVIDER.OANDA : DATA_PROVIDER.FX,
      tradingViewSymbol: asset.tradingViewSymbol || TV_SYMBOL_OVERRIDES[asset.symbol],
      binanceSymbol: null, // Not available on Binance
      isSafeHaven: asset.isSafeHaven || false,
      rank: asset.rank,
    });
    
    // Also index by symbol
    registry.set(asset.symbol, registry.get(asset.id));
  }
  
  return registry;
};

const ASSET_REGISTRY = buildAssetRegistry();

// ============================================
// PUBLIC API
// ============================================

/**
 * Get complete asset configuration by ID or symbol
 * @param {string} identifier - Asset ID or symbol (e.g., "bitcoin", "BTC", "XAUUSD")
 * @returns {Object|null} Asset configuration or null if not found
 */
export const getAssetConfig = (identifier) => {
  if (!identifier) return null;
  
  const normalized = String(identifier).toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Try exact match first
  if (ASSET_REGISTRY.has(identifier)) {
    return ASSET_REGISTRY.get(identifier);
  }
  
  // Try normalized symbol
  if (ASSET_REGISTRY.has(normalized)) {
    return ASSET_REGISTRY.get(normalized);
  }
  
  // Try with USD suffix removed
  const withoutUsd = normalized.replace(/USD$/, "");
  if (ASSET_REGISTRY.has(withoutUsd)) {
    return ASSET_REGISTRY.get(withoutUsd);
  }
  
  // Try lowercase (for coingecko IDs)
  const lowercase = String(identifier).toLowerCase();
  if (ASSET_REGISTRY.has(lowercase)) {
    return ASSET_REGISTRY.get(lowercase);
  }
  
  return null;
};

/**
 * Get TradingView symbol for an asset
 * Ensures 1:1 precision between chart and indicators
 * @param {string} identifier - Asset ID or symbol
 * @returns {string} TradingView symbol (e.g., "BINANCE:BTCUSDT", "OANDA:XAUUSD")
 */
export const getTradingViewSymbol = (identifier) => {
  const config = getAssetConfig(identifier);
  if (config?.tradingViewSymbol) {
    return config.tradingViewSymbol;
  }
  
  // Check overrides directly
  const normalized = String(identifier).toUpperCase();
  if (TV_SYMBOL_OVERRIDES[normalized]) {
    return TV_SYMBOL_OVERRIDES[normalized];
  }
  
  // Default to Binance for unknown assets
  const symbol = normalized.replace(/USD$/, "").replace(/USDT$/, "");
  return `BINANCE:${symbol}USDT`;
};

/**
 * Get algorithm parameters for an asset
 * Adjusts indicators based on volatility tier
 * @param {string} identifier - Asset ID or symbol
 * @returns {Object} Algorithm parameters
 */
export const getAlgorithmParams = (identifier) => {
  const config = getAssetConfig(identifier);
  const tier = config?.volatilityTier || VOLATILITY_TIER.HIGH;
  return ALGORITHM_PARAMS[tier] || ALGORITHM_PARAMS[VOLATILITY_TIER.HIGH];
};

/**
 * Get asset class for routing decisions
 * @param {string} identifier - Asset ID or symbol
 * @returns {string} Asset class (crypto, commodity, forex)
 */
export const getAssetClass = (identifier) => {
  const config = getAssetConfig(identifier);
  return config?.assetClass || ASSET_CLASS.CRYPTO;
};

/**
 * Get data provider configuration for an asset
 * @param {string} identifier - Asset ID or symbol
 * @returns {Object} Provider routing configuration
 */
export const getProviderConfig = (identifier) => {
  const assetClass = getAssetClass(identifier);
  return PROVIDER_ROUTING[assetClass] || PROVIDER_ROUTING[ASSET_CLASS.CRYPTO];
};

/**
 * Check if asset requires alternative data source (not Binance)
 * @param {string} identifier - Asset ID or symbol
 * @returns {boolean} True if asset needs non-Binance data source
 */
export const requiresAlternativeSource = (identifier) => {
  const config = getAssetConfig(identifier);
  return config?.assetClass !== ASSET_CLASS.CRYPTO;
};

/**
 * Check if asset is a safe haven (Gold, JPY, CHF)
 * @param {string} identifier - Asset ID or symbol
 * @returns {boolean} True if safe haven asset
 */
export const isSafeHaven = (identifier) => {
  const config = getAssetConfig(identifier);
  return config?.isSafeHaven || false;
};

/**
 * Get Binance WebSocket symbol (only for crypto)
 * @param {string} identifier - Asset ID or symbol
 * @returns {string|null} Binance symbol or null for non-crypto
 */
export const getBinanceSymbol = (identifier) => {
  const config = getAssetConfig(identifier);
  return config?.binanceSymbol || null;
};

/**
 * Get all assets of a specific class
 * @param {string} assetClass - Asset class to filter by
 * @returns {Array} Array of asset configurations
 */
export const getAssetsByClass = (assetClass) => {
  const results = [];
  const seen = new Set();
  
  for (const [key, config] of ASSET_REGISTRY.entries()) {
    if (config.assetClass === assetClass && !seen.has(config.id)) {
      seen.add(config.id);
      results.push(config);
    }
  }
  
  return results.sort((a, b) => (a.rank || 999) - (b.rank || 999));
};

/**
 * Get all tradeable assets
 * @returns {Array} Array of all asset configurations
 */
export const getAllAssets = () => {
  const results = [];
  const seen = new Set();
  
  for (const [, config] of ASSET_REGISTRY.entries()) {
    if (!seen.has(config.id)) {
      seen.add(config.id);
      results.push(config);
    }
  }
  
  return results.sort((a, b) => (a.rank || 999) - (b.rank || 999));
};

// ============================================
// ICON SYSTEM
// ============================================

// SVG icons for commodities and forex
const ASSET_ICONS = {
  XAUUSD: `<svg viewBox="0 0 32 32" fill="none"><defs><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="50%" stop-color="#FFA500"/><stop offset="100%" stop-color="#B8860B"/></linearGradient></defs><rect x="4" y="8" width="24" height="16" rx="2" fill="url(#gold)"/><rect x="8" y="12" width="16" height="8" rx="1" fill="#FFF8DC" opacity="0.3"/></svg>`,
  XAGUSD: `<svg viewBox="0 0 32 32" fill="none"><defs><linearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8E8E8"/><stop offset="50%" stop-color="#C0C0C0"/><stop offset="100%" stop-color="#A8A8A8"/></linearGradient></defs><rect x="4" y="8" width="24" height="16" rx="2" fill="url(#silver)"/><rect x="8" y="12" width="16" height="8" rx="1" fill="#FFFFFF" opacity="0.3"/></svg>`,
  EURUSD: `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#003399"/><text x="16" y="21" font-size="14" font-weight="bold" fill="#FFCC00" text-anchor="middle">€</text></svg>`,
  GBPUSD: `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#012169"/><text x="16" y="21" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">£</text></svg>`,
  USDJPY: `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#FFFFFF" stroke="#BC002D" stroke-width="2"/><circle cx="16" cy="16" r="6" fill="#BC002D"/></svg>`,
  USD: `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" fill="#22C55E"/><text x="16" y="21" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">$</text></svg>`,
};

/**
 * Get icon for an asset (SVG string or URL)
 * @param {string} identifier - Asset ID or symbol
 * @param {string} coinGeckoImage - Optional CoinGecko image URL for crypto
 * @returns {string} SVG string or image URL
 */
export const getAssetIcon = (identifier, coinGeckoImage = null) => {
  const normalized = String(identifier).toUpperCase();
  
  // Check for predefined SVG icons (commodities/forex)
  if (ASSET_ICONS[normalized]) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(ASSET_ICONS[normalized])}`;
  }
  
  // Use CoinGecko image for crypto if available
  if (coinGeckoImage) {
    return coinGeckoImage;
  }
  
  // Fallback to CoinGecko CDN
  const config = getAssetConfig(identifier);
  if (config?.id) {
    return `https://assets.coingecko.com/coins/images/1/small/${config.id}.png`;
  }
  
  // Ultimate fallback
  return `data:image/svg+xml;utf8,${encodeURIComponent(ASSET_ICONS.USD)}`;
};

// ============================================
// EXPORTS
// ============================================

export default {
  ASSET_CLASS,
  DATA_PROVIDER,
  VOLATILITY_TIER,
  getAssetConfig,
  getTradingViewSymbol,
  getAlgorithmParams,
  getAssetClass,
  getProviderConfig,
  requiresAlternativeSource,
  isSafeHaven,
  getBinanceSymbol,
  getAssetsByClass,
  getAllAssets,
  getAssetIcon,
};
