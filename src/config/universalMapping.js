// Copyright (c) 2025 Vision AI Mind. All rights reserved.
// Universal Asset Mapping - Provider Selection & Icon Resolution

import supportedCoins, { GOLD_FOREX_ASSETS, formatMarketId } from "./supportedCoins";

// ============================================
// ASSET CLASS DEFINITIONS
// ============================================

export const ASSET_CLASS = {
  CRYPTO: "crypto",
  COMMODITY: "commodity",
  FOREX: "forex",
};

export const PROVIDER = {
  BINANCE: "BINANCE",
  OANDA: "OANDA",
  FX_IDC: "FX_IDC",
  COINBASE: "COINBASE",
  KRAKEN: "KRAKEN",
  COINGECKO: "coingecko",
  YAHOO: "yahoo",
};

// ============================================
// VOLATILITY PROFILES (for algorithm scaling)
// ============================================

export const VOLATILITY_PROFILE = {
  HIGH: {
    name: "high",
    rsiOversold: 30,
    rsiOverbought: 70,
    atrMultiplier: 1.5,
    stopLossMultiplier: 2.0,
    takeProfitMultiplier: 3.0,
  },
  MEDIUM: {
    name: "medium",
    rsiOversold: 35,
    rsiOverbought: 65,
    atrMultiplier: 1.2,
    stopLossMultiplier: 1.5,
    takeProfitMultiplier: 2.5,
  },
  LOW: {
    name: "low",
    rsiOversold: 40,
    rsiOverbought: 60,
    atrMultiplier: 1.0,
    stopLossMultiplier: 1.0,
    takeProfitMultiplier: 2.0,
  },
};

// ============================================
// SVG ICONS FOR NON-CRYPTO ASSETS
// ============================================

const GOLD_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='goldGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#fbbf24'/>
      <stop offset='50%' stop-color='#f59e0b'/>
      <stop offset='100%' stop-color='#d97706'/>
    </linearGradient>
  </defs>
  <rect x='8' y='28' width='48' height='20' rx='3' fill='url(#goldGrad)' stroke='#b45309' stroke-width='1'/>
  <rect x='12' y='12' width='40' height='18' rx='3' fill='url(#goldGrad)' stroke='#b45309' stroke-width='1'/>
  <text x='32' y='42' text-anchor='middle' font-size='10' font-weight='bold' fill='#1e1b4b'>GOLD</text>
</svg>`;

const SILVER_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='silverGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#e5e7eb'/>
      <stop offset='50%' stop-color='#9ca3af'/>
      <stop offset='100%' stop-color='#6b7280'/>
    </linearGradient>
  </defs>
  <rect x='8' y='28' width='48' height='20' rx='3' fill='url(#silverGrad)' stroke='#4b5563' stroke-width='1'/>
  <rect x='12' y='12' width='40' height='18' rx='3' fill='url(#silverGrad)' stroke='#4b5563' stroke-width='1'/>
  <text x='32' y='42' text-anchor='middle' font-size='9' font-weight='bold' fill='#1f2937'>SILVER</text>
</svg>`;

const EUR_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='eurGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#3b82f6'/>
      <stop offset='100%' stop-color='#1d4ed8'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#eurGrad)'/>
  <text x='32' y='42' text-anchor='middle' font-size='28' font-weight='bold' fill='white'>€</text>
</svg>`;

const GBP_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='gbpGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#6366f1'/>
      <stop offset='100%' stop-color='#4338ca'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#gbpGrad)'/>
  <text x='32' y='42' text-anchor='middle' font-size='28' font-weight='bold' fill='white'>£</text>
</svg>`;

const JPY_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='jpyGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#ef4444'/>
      <stop offset='100%' stop-color='#dc2626'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#jpyGrad)'/>
  <text x='32' y='42' text-anchor='middle' font-size='28' font-weight='bold' fill='white'>¥</text>
</svg>`;

const USD_ICON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='usdGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#22c55e'/>
      <stop offset='100%' stop-color='#16a34a'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#usdGrad)'/>
  <text x='32' y='42' text-anchor='middle' font-size='28' font-weight='bold' fill='white'>$</text>
</svg>`;

const FOREX_DEFAULT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='fxGrad' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#8b5cf6'/>
      <stop offset='100%' stop-color='#6d28d9'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#fxGrad)'/>
  <text x='32' y='40' text-anchor='middle' font-size='14' font-weight='bold' fill='white'>FX</text>
</svg>`;

// Icon mapping
const ASSET_ICONS = {
  XAUUSD: GOLD_ICON_SVG,
  GOLD: GOLD_ICON_SVG,
  XAGUSD: SILVER_ICON_SVG,
  SILVER: SILVER_ICON_SVG,
  EURUSD: EUR_ICON_SVG,
  GBPUSD: GBP_ICON_SVG,
  USDJPY: JPY_ICON_SVG,
  USD: USD_ICON_SVG,
  USDT: USD_ICON_SVG,
  USDC: USD_ICON_SVG,
};

/**
 * Convert SVG to data URL
 */
const svgToDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * Get icon URL for any asset
 * - Crypto: CoinGecko API URLs
 * - Gold/Forex: Local SVG icons
 */
export const getAssetIcon = (symbolOrId, coinGeckoImage = null) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  
  // Check for specific icon
  const specificIcon = ASSET_ICONS[normalized];
  if (specificIcon) {
    return svgToDataUrl(specificIcon);
  }
  
  // Check Gold/Forex assets
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  if (goldForex) {
    if (goldForex.assetClass === "commodity") {
      return svgToDataUrl(GOLD_ICON_SVG);
    }
    return svgToDataUrl(FOREX_DEFAULT_SVG);
  }
  
  // Use CoinGecko image if provided
  if (coinGeckoImage) {
    return coinGeckoImage;
  }
  
  // Fallback: Generate dynamic SVG
  return generateDynamicIcon(normalized);
};

/**
 * Generate dynamic icon for crypto assets without images
 */
const generateDynamicIcon = (symbol) => {
  const label = symbol.slice(0, 4);
  const hash = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs>
      <linearGradient id='gen${hash}' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='hsl(${hue}, 70%, 50%)'/>
        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 70%, 40%)'/>
      </linearGradient>
    </defs>
    <circle cx='32' cy='32' r='28' fill='url(#gen${hash})'/>
    <text x='32' y='40' text-anchor='middle' font-size='14' font-weight='bold' fill='white'>${label}</text>
  </svg>`;
  
  return svgToDataUrl(svg);
};

// ============================================
// UNIVERSAL ASSET CONFIGURATION
// ============================================

/**
 * Universal Asset Config
 * Provides complete configuration for any asset type
 */
export const getUniversalAssetConfig = (symbolOrId) => {
  const normalized = String(symbolOrId || "").toUpperCase();
  
  // Check Gold/Forex first
  const goldForex = GOLD_FOREX_ASSETS.find(
    (a) => a.symbol === normalized || a.id === symbolOrId
  );
  
  if (goldForex) {
    return {
      id: goldForex.id,
      symbol: goldForex.symbol,
      name: goldForex.name,
      assetClass: goldForex.assetClass,
      tradingViewSymbol: goldForex.tradingViewSymbol,
      metatraderSymbol: goldForex.metatraderSymbol,
      provider: goldForex.assetClass === "commodity" ? PROVIDER.OANDA : PROVIDER.FX_IDC,
      dataProvider: PROVIDER.YAHOO, // Yahoo Finance for Gold/Forex data
      isSafeHaven: goldForex.isSafeHaven,
      volatilityProfile: VOLATILITY_PROFILE[goldForex.volatilityProfile.toUpperCase()] || VOLATILITY_PROFILE.LOW,
      icon: getAssetIcon(goldForex.symbol),
    };
  }
  
  // Check crypto
  const base = normalized.replace(/USDT?$/, "").replace(/USD$/, "");
  const crypto = supportedCoins.find(
    (c) => c.symbol.toUpperCase() === base || c.id === symbolOrId
  );
  
  if (crypto) {
    const symbol = crypto.symbol.toUpperCase();
    return {
      id: crypto.id,
      symbol,
      name: crypto.name,
      assetClass: ASSET_CLASS.CRYPTO,
      tradingViewSymbol: `${PROVIDER.BINANCE}:${symbol}USDT`,
      metatraderSymbol: symbol,
      provider: PROVIDER.BINANCE,
      dataProvider: PROVIDER.COINGECKO,
      isSafeHaven: false,
      volatilityProfile: VOLATILITY_PROFILE.HIGH,
      icon: null, // Will be set from CoinGecko
    };
  }
  
  // Unknown asset - default to crypto
  return {
    id: normalized.toLowerCase(),
    symbol: normalized,
    name: normalized,
    assetClass: ASSET_CLASS.CRYPTO,
    tradingViewSymbol: `${PROVIDER.BINANCE}:${normalized}USDT`,
    metatraderSymbol: normalized,
    provider: PROVIDER.BINANCE,
    dataProvider: PROVIDER.COINGECKO,
    isSafeHaven: false,
    volatilityProfile: VOLATILITY_PROFILE.HIGH,
    icon: getAssetIcon(normalized),
  };
};

/**
 * Get TradingView deep link URL
 */
export const getTradingViewDeepLink = (symbolOrId) => {
  const config = getUniversalAssetConfig(symbolOrId);
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(config.tradingViewSymbol)}`;
};

/**
 * Get correct TradingView widget symbol
 */
export const getTradingViewWidgetSymbol = (symbolOrId) => {
  const config = getUniversalAssetConfig(symbolOrId);
  return config.tradingViewSymbol;
};

/**
 * Get algorithm parameters based on asset volatility
 */
export const getAlgorithmParams = (symbolOrId) => {
  const config = getUniversalAssetConfig(symbolOrId);
  const profile = config.volatilityProfile;
  
  return {
    rsiPeriod: 14,
    rsiOversold: profile.rsiOversold,
    rsiOverbought: profile.rsiOverbought,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    atrPeriod: 14,
    atrMultiplier: profile.atrMultiplier,
    stopLossMultiplier: profile.stopLossMultiplier,
    takeProfitMultiplier: profile.takeProfitMultiplier,
    isSafeHaven: config.isSafeHaven,
    assetClass: config.assetClass,
  };
};

/**
 * Check if asset requires alternative data source
 * (Yahoo Finance instead of CoinGecko)
 */
export const requiresAlternativeDataSource = (symbolOrId) => {
  const config = getUniversalAssetConfig(symbolOrId);
  return config.assetClass !== ASSET_CLASS.CRYPTO;
};

/**
 * Get data endpoint for asset
 */
export const getDataEndpoint = (symbolOrId) => {
  const config = getUniversalAssetConfig(symbolOrId);
  
  if (config.assetClass === ASSET_CLASS.CRYPTO) {
    return `/api/coins?ids=${config.id}`;
  }
  
  // Gold/Forex use Yahoo Finance endpoint
  return `/api/price?symbol=${config.symbol}&provider=yahoo`;
};

// ============================================
// EXPORT ALL MAPPINGS
// ============================================

export const CRYPTO_COINS = supportedCoins;
export const GOLD_FOREX = GOLD_FOREX_ASSETS;
export const ALL_ASSETS = [...supportedCoins, ...GOLD_FOREX_ASSETS];

// Pre-computed mapping for fast lookups
export const UNIVERSAL_ASSET_MAP = ALL_ASSETS.reduce((acc, asset) => {
  const symbol = asset.symbol.toUpperCase();
  const config = getUniversalAssetConfig(symbol);
  acc[symbol] = config;
  acc[asset.id] = config;
  if (asset.assetClass === ASSET_CLASS.CRYPTO || !asset.assetClass) {
    acc[formatMarketId(symbol)] = config;
  }
  return acc;
}, {});

export default {
  ASSET_CLASS,
  PROVIDER,
  VOLATILITY_PROFILE,
  getAssetIcon,
  getUniversalAssetConfig,
  getTradingViewDeepLink,
  getTradingViewWidgetSymbol,
  getAlgorithmParams,
  requiresAlternativeDataSource,
  getDataEndpoint,
  UNIVERSAL_ASSET_MAP,
};
