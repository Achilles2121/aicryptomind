/**
 * Subscription Tier System
 * Vision AI Mind - Elite Trader Dashboard
 * 
 * Manages feature access based on subscription level.
 * 
 * TIERS:
 * - BASIC: Free tier - Core features only
 * - PRO: Paid tier - Advanced analytics
 * - ELITE: Premium tier - Full access + AI signals
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

// ============================================
// SUBSCRIPTION TIERS
// ============================================

export const SUBSCRIPTION_TIER = Object.freeze({
  BASIC: "basic",
  PRO: "pro",
  ELITE: "elite",
});

// ============================================
// FEATURE DEFINITIONS
// ============================================

export const FEATURE = Object.freeze({
  // Core Features (BASIC)
  MARKET_HUB: "market_hub",
  PRICE_TICKER: "price_ticker",
  BASIC_CHART: "basic_chart",
  WATCHLIST_5: "watchlist_5",
  
  // Pro Features
  TRADINGVIEW_ADVANCED: "tradingview_advanced",
  MULTI_TIMEFRAME: "multi_timeframe",
  RSI_MACD_INDICATORS: "rsi_macd_indicators",
  VOLUME_ANALYSIS: "volume_analysis",
  SENTIMENT_TRACKER: "sentiment_tracker",
  WATCHLIST_25: "watchlist_25",
  ALERTS_10: "alerts_10",
  PORTFOLIO_TRACKER: "portfolio_tracker",
  GOLD_FOREX_BASIC: "gold_forex_basic",
  
  // Elite Features
  AI_SIGNAL_ENGINE: "ai_signal_engine",
  EIGHT_POINT_ANALYSIS: "eight_point_analysis",
  FIBONACCI_LEVELS: "fibonacci_levels",
  SUPPORT_RESISTANCE: "support_resistance",
  LIQUIDITY_ZONES: "liquidity_zones",
  WHALE_TRACKER: "whale_tracker",
  BACKTEST_ENGINE: "backtest_engine",
  API_ACCESS: "api_access",
  WATCHLIST_UNLIMITED: "watchlist_unlimited",
  ALERTS_UNLIMITED: "alerts_unlimited",
  GOLD_FOREX_ADVANCED: "gold_forex_advanced",
  PRIORITY_SUPPORT: "priority_support",
});

// ============================================
// TIER -> FEATURE MAPPING
// ============================================

const TIER_FEATURES = Object.freeze({
  [SUBSCRIPTION_TIER.BASIC]: new Set([
    FEATURE.MARKET_HUB,
    FEATURE.PRICE_TICKER,
    FEATURE.BASIC_CHART,
    FEATURE.WATCHLIST_5,
  ]),
  
  [SUBSCRIPTION_TIER.PRO]: new Set([
    // Includes all BASIC features
    FEATURE.MARKET_HUB,
    FEATURE.PRICE_TICKER,
    FEATURE.BASIC_CHART,
    FEATURE.WATCHLIST_5,
    // Pro-specific features
    FEATURE.TRADINGVIEW_ADVANCED,
    FEATURE.MULTI_TIMEFRAME,
    FEATURE.RSI_MACD_INDICATORS,
    FEATURE.VOLUME_ANALYSIS,
    FEATURE.SENTIMENT_TRACKER,
    FEATURE.WATCHLIST_25,
    FEATURE.ALERTS_10,
    FEATURE.PORTFOLIO_TRACKER,
    FEATURE.GOLD_FOREX_BASIC,
  ]),
  
  [SUBSCRIPTION_TIER.ELITE]: new Set([
    // Includes all PRO features
    FEATURE.MARKET_HUB,
    FEATURE.PRICE_TICKER,
    FEATURE.BASIC_CHART,
    FEATURE.WATCHLIST_5,
    FEATURE.TRADINGVIEW_ADVANCED,
    FEATURE.MULTI_TIMEFRAME,
    FEATURE.RSI_MACD_INDICATORS,
    FEATURE.VOLUME_ANALYSIS,
    FEATURE.SENTIMENT_TRACKER,
    FEATURE.WATCHLIST_25,
    FEATURE.ALERTS_10,
    FEATURE.PORTFOLIO_TRACKER,
    FEATURE.GOLD_FOREX_BASIC,
    // Elite-specific features
    FEATURE.AI_SIGNAL_ENGINE,
    FEATURE.EIGHT_POINT_ANALYSIS,
    FEATURE.FIBONACCI_LEVELS,
    FEATURE.SUPPORT_RESISTANCE,
    FEATURE.LIQUIDITY_ZONES,
    FEATURE.WHALE_TRACKER,
    FEATURE.BACKTEST_ENGINE,
    FEATURE.API_ACCESS,
    FEATURE.WATCHLIST_UNLIMITED,
    FEATURE.ALERTS_UNLIMITED,
    FEATURE.GOLD_FOREX_ADVANCED,
    FEATURE.PRIORITY_SUPPORT,
  ]),
});

// ============================================
// CARD VISIBILITY CONFIG
// ============================================

/**
 * Maps UI cards to required features
 * Used by FeatureGate component
 */
export const CARD_FEATURE_MAP = Object.freeze({
  // Dashboard Cards
  "price-ticker": FEATURE.PRICE_TICKER,
  "market-hub": FEATURE.MARKET_HUB,
  "basic-chart": FEATURE.BASIC_CHART,
  
  // Pro Cards
  "tradingview-widget": FEATURE.TRADINGVIEW_ADVANCED,
  "rsi-indicator": FEATURE.RSI_MACD_INDICATORS,
  "macd-indicator": FEATURE.RSI_MACD_INDICATORS,
  "volume-profile": FEATURE.VOLUME_ANALYSIS,
  "sentiment-card": FEATURE.SENTIMENT_TRACKER,
  "multi-timeframe": FEATURE.MULTI_TIMEFRAME,
  "portfolio-card": FEATURE.PORTFOLIO_TRACKER,
  "gold-price-card": FEATURE.GOLD_FOREX_BASIC,
  "forex-rates-card": FEATURE.GOLD_FOREX_BASIC,
  
  // Elite Cards
  "ai-signal-card": FEATURE.AI_SIGNAL_ENGINE,
  "eight-point-card": FEATURE.EIGHT_POINT_ANALYSIS,
  "fibonacci-card": FEATURE.FIBONACCI_LEVELS,
  "support-resistance-card": FEATURE.SUPPORT_RESISTANCE,
  "liquidity-zones-card": FEATURE.LIQUIDITY_ZONES,
  "whale-tracker-card": FEATURE.WHALE_TRACKER,
  "backtest-card": FEATURE.BACKTEST_ENGINE,
  "gold-advanced-card": FEATURE.GOLD_FOREX_ADVANCED,
});

// ============================================
// PUBLIC API
// ============================================

/**
 * Check if a tier has access to a feature
 * @param {string} tier - Subscription tier
 * @param {string} feature - Feature ID
 * @returns {boolean}
 */
export const hasFeatureAccess = (tier, feature) => {
  const tierFeatures = TIER_FEATURES[tier];
  if (!tierFeatures) return false;
  return tierFeatures.has(feature);
};

/**
 * Check if a tier can view a specific card
 * @param {string} tier - Subscription tier
 * @param {string} cardId - Card identifier
 * @returns {boolean}
 */
export const canViewCard = (tier, cardId) => {
  const requiredFeature = CARD_FEATURE_MAP[cardId];
  if (!requiredFeature) return true; // Cards without mapping are visible to all
  return hasFeatureAccess(tier, requiredFeature);
};

/**
 * Get all features available for a tier
 * @param {string} tier - Subscription tier
 * @returns {string[]}
 */
export const getTierFeatures = (tier) => {
  const features = TIER_FEATURES[tier];
  return features ? Array.from(features) : [];
};

/**
 * Get the minimum tier required for a feature
 * @param {string} feature - Feature ID
 * @returns {string|null}
 */
export const getMinimumTierForFeature = (feature) => {
  for (const tier of [SUBSCRIPTION_TIER.BASIC, SUBSCRIPTION_TIER.PRO, SUBSCRIPTION_TIER.ELITE]) {
    if (TIER_FEATURES[tier].has(feature)) {
      return tier;
    }
  }
  return null;
};

/**
 * Get tier display info
 * @param {string} tier - Subscription tier
 * @returns {Object}
 */
export const getTierInfo = (tier) => {
  const info = {
    [SUBSCRIPTION_TIER.BASIC]: {
      name: "Basic",
      price: 0,
      priceLabel: "Free",
      color: "slate",
      icon: "👤",
      description: "Essential market data",
      maxAssets: 10,
      maxWatchlist: 5,
      maxAlerts: 0,
    },
    [SUBSCRIPTION_TIER.PRO]: {
      name: "Pro",
      price: 29,
      priceLabel: "$29/mo",
      color: "blue",
      icon: "⚡",
      description: "Advanced analytics & indicators",
      maxAssets: 50,
      maxWatchlist: 25,
      maxAlerts: 10,
    },
    [SUBSCRIPTION_TIER.ELITE]: {
      name: "Elite",
      price: 99,
      priceLabel: "$99/mo",
      color: "amber",
      icon: "👑",
      description: "Full AI-powered trading suite",
      maxAssets: -1, // Unlimited
      maxWatchlist: -1,
      maxAlerts: -1,
    },
  };
  
  return info[tier] || info[SUBSCRIPTION_TIER.BASIC];
};

/**
 * Get upgrade path from current tier
 * @param {string} currentTier - Current subscription tier
 * @returns {Object|null}
 */
export const getUpgradePath = (currentTier) => {
  const paths = {
    [SUBSCRIPTION_TIER.BASIC]: {
      nextTier: SUBSCRIPTION_TIER.PRO,
      savings: "Unlock 15+ features",
      cta: "Upgrade to Pro",
    },
    [SUBSCRIPTION_TIER.PRO]: {
      nextTier: SUBSCRIPTION_TIER.ELITE,
      savings: "Unlock AI Signal Engine",
      cta: "Go Elite",
    },
    [SUBSCRIPTION_TIER.ELITE]: null,
  };
  
  return paths[currentTier] || paths[SUBSCRIPTION_TIER.BASIC];
};

export default {
  SUBSCRIPTION_TIER,
  FEATURE,
  CARD_FEATURE_MAP,
  hasFeatureAccess,
  canViewCard,
  getTierFeatures,
  getMinimumTierForFeature,
  getTierInfo,
  getUpgradePath,
};
