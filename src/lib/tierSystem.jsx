// Copyright (c) 2025 Vision AI Mind. All rights reserved.
// Tier-based Card Visibility System
// Provides clean gating for Basic, Pro, and Elite features

import React, { createContext, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import { Lock, Crown, Zap, Star, ArrowRight } from "lucide-react";

/**
 * Tier hierarchy: basic < pro < elite
 */
export const TIERS = {
  basic: { level: 0, label: "Basic", icon: Star, color: "text-slate-400", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30" },
  pro: { level: 1, label: "Pro", icon: Zap, color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30" },
  elite: { level: 2, label: "Elite", icon: Crown, color: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30" },
};

export const TIER_ORDER = ["basic", "pro", "elite"];

/**
 * Check if user has access to a feature
 */
export const hasAccess = (userTier, requiredTier, isTrialActive = false) => {
  const userLevel = TIERS[userTier]?.level ?? 0;
  const requiredLevel = TIERS[requiredTier]?.level ?? 0;
  
  // Trial gives Pro access
  if (isTrialActive && requiredLevel <= TIERS.pro.level) {
    return true;
  }
  
  return userLevel >= requiredLevel;
};

/**
 * Card Configuration - Define which tier each card requires
 * This is the single source of truth for all card visibility
 */
export const CARD_TIER_CONFIG = {
  // ═══════════════════════════════════════════════════════════════
  // BASIC TIER - Free for all users
  // ═══════════════════════════════════════════════════════════════
  livePrice: { tier: "basic", label: "Live Preis" },
  fearGreed: { tier: "basic", label: "Fear & Greed Index" },
  indicators: { tier: "basic", label: "Basis-Indikatoren" },
  reliability: { tier: "basic", label: "System Status" },
  tradingViewChart: { tier: "basic", label: "TradingView Chart" },
  quickTips: { tier: "basic", label: "Quick Tips" },
  systemStatus: { tier: "basic", label: "System Status" },
  
  // ═══════════════════════════════════════════════════════════════
  // PRO TIER - Premium features
  // ═══════════════════════════════════════════════════════════════
  proSignal: { tier: "pro", label: "Pro Signal" },
  cryptoBubbles: { tier: "pro", label: "Crypto Bubbles" },
  aiPredictor: { tier: "pro", label: "AI Predictor" },
  backtestLocal: { tier: "pro", label: "Backtest (Local)" },
  riskScore: { tier: "pro", label: "Risk Score" },
  fibLevels: { tier: "pro", label: "Fibonacci Levels" },
  tradeLevels: { tier: "pro", label: "Trade Levels (TP/SL)" },
  manualControls: { tier: "pro", label: "Manual Controls" },
  derivativesRisk: { tier: "pro", label: "Derivatives Risk" },
  fundingRates: { tier: "pro", label: "Funding Rates" },
  correlationMatrix: { tier: "pro", label: "Correlation Matrix" },
  socialSentiment: { tier: "pro", label: "Social Sentiment" },
  whaleActivity: { tier: "pro", label: "Whale Activity" },
  
  // ═══════════════════════════════════════════════════════════════
  // ELITE TIER - Exclusive features
  // ═══════════════════════════════════════════════════════════════
  aiSignal: { tier: "elite", label: "AI Signal (Heuristik)" },
  volatilityGauge: { tier: "elite", label: "Volatility Gauge" },
  volatilityAlerts: { tier: "elite", label: "Volatility Alerts" },
  backtestDashboard: { tier: "elite", label: "Backtest Dashboard" },
  etfFlows: { tier: "elite", label: "ETF Flows" },
  etfHoldings: { tier: "elite", label: "ETF Holdings" },
  etfCorrelation: { tier: "elite", label: "ETF Correlation" },
  etfProviderQuality: { tier: "elite", label: "ETF Provider Quality" },
  multiTpSl: { tier: "elite", label: "Multi TP/SL Engine" },
  advancedBacktest: { tier: "elite", label: "Advanced Backtest" },
  onChainMetrics: { tier: "elite", label: "On-Chain Metrics" },
  liquidityHeatmap: { tier: "elite", label: "Liquidity Heatmap" },
  orderBlocks: { tier: "elite", label: "Order Blocks (SMC)" },
  cryptoEduChat: { tier: "elite", label: "Crypto Edu Chat" },
};

/**
 * Get tier badge component
 */
export const TierBadge = ({ tier, size = "sm", showLabel = true }) => {
  const config = TIERS[tier] || TIERS.basic;
  const Icon = config.icon;
  
  const sizeClasses = {
    xs: "px-1.5 py-0.5 text-[10px]",
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${config.bgColor} ${config.color} border ${config.borderColor} ${sizeClasses[size]}`}>
      <Icon className={size === "xs" ? "w-2.5 h-2.5" : size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

TierBadge.propTypes = {
  tier: PropTypes.oneOf(["basic", "pro", "elite"]).isRequired,
  size: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
  showLabel: PropTypes.bool,
};

/**
 * TierGate - Completely hides content if user doesn't have access
 * Use this when you want to hide cards entirely (not show a locked version)
 */
export const TierGate = ({ 
  requiredTier, 
  userTier = "basic", 
  isTrialActive = false,
  children,
  fallback = null,
}) => {
  const canAccess = hasAccess(userTier, requiredTier, isTrialActive);
  
  if (canAccess) {
    return children;
  }
  
  return fallback;
};

TierGate.propTypes = {
  requiredTier: PropTypes.oneOf(["basic", "pro", "elite"]).isRequired,
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
};

/**
 * TierLock - Shows a locked placeholder instead of the content
 * Use this when you want to show users what they're missing
 */
export const TierLock = ({ 
  requiredTier, 
  userTier = "basic", 
  isTrialActive = false,
  cardTitle = "",
  cardDescription = "",
  showUpgradeButton = true,
  onUpgrade = null,
  children,
}) => {
  const canAccess = hasAccess(userTier, requiredTier, isTrialActive);
  const tierConfig = TIERS[requiredTier] || TIERS.pro;
  
  if (canAccess) {
    return children;
  }
  
  return (
    <div className="relative rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 via-slate-800/50 to-slate-900/90 overflow-hidden">
      {/* Locked Content Placeholder */}
      <div className="p-6 flex flex-col items-center justify-center min-h-[200px] text-center space-y-4">
        {/* Lock Icon with Tier Color */}
        <div className={`p-4 rounded-full ${tierConfig.bgColor} border ${tierConfig.borderColor}`}>
          <Lock className={`w-8 h-8 ${tierConfig.color}`} />
        </div>
        
        {/* Title */}
        {cardTitle && (
          <h3 className="text-lg font-semibold text-white">{cardTitle}</h3>
        )}
        
        {/* Description */}
        <p className="text-sm text-slate-400 max-w-xs">
          {cardDescription || `Diese Funktion erfordert ${tierConfig.label}.`}
        </p>
        
        {/* Tier Badge */}
        <TierBadge tier={requiredTier} size="md" />
        
        {/* Upgrade Button */}
        {showUpgradeButton && (
          <button
            onClick={onUpgrade}
            className={`mt-2 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${tierConfig.bgColor} ${tierConfig.color} border ${tierConfig.borderColor} hover:scale-105`}
          >
            <span>Upgrade auf {tierConfig.label}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Decorative gradient border */}
      <div className={`absolute inset-0 rounded-xl pointer-events-none border-2 ${tierConfig.borderColor} opacity-30`} />
    </div>
  );
};

TierLock.propTypes = {
  requiredTier: PropTypes.oneOf(["basic", "pro", "elite"]).isRequired,
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  cardTitle: PropTypes.string,
  cardDescription: PropTypes.string,
  showUpgradeButton: PropTypes.bool,
  onUpgrade: PropTypes.func,
  children: PropTypes.node.isRequired,
};

/**
 * TierOverlay - Shows content with a lock overlay (similar to current Paywall)
 * Use this when you want to tease the content but lock interaction
 */
export const TierOverlay = ({ 
  requiredTier, 
  userTier = "basic", 
  isTrialActive = false,
  trialEndText = "",
  lockText = "",
  children,
}) => {
  const canAccess = hasAccess(userTier, requiredTier, isTrialActive);
  const tierConfig = TIERS[requiredTier] || TIERS.pro;
  
  if (canAccess) {
    return children;
  }
  
  const defaultLockText = `${tierConfig.label} erforderlich`;
  
  return (
    <div className="relative">
      {/* Blurred content */}
      <div className="pointer-events-none select-none">
        <div className="absolute inset-0 rounded-xl bg-slate-950/80 backdrop-blur-sm z-10" />
        <div className="absolute inset-0 rounded-xl border-2 border-dashed border-slate-600/50 z-10" />
        <div className="relative opacity-30 blur-[2px]">{children}</div>
      </div>
      
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 space-y-3">
        <div className={`p-3 rounded-full ${tierConfig.bgColor} border ${tierConfig.borderColor}`}>
          <Lock className={`w-6 h-6 ${tierConfig.color}`} />
        </div>
        <div className={`px-4 py-2 rounded-lg ${tierConfig.bgColor} border ${tierConfig.borderColor}`}>
          <span className={`text-sm font-medium ${tierConfig.color}`}>
            {lockText || defaultLockText}
          </span>
        </div>
        {trialEndText && (
          <span className="text-xs text-amber-400">{trialEndText}</span>
        )}
      </div>
    </div>
  );
};

TierOverlay.propTypes = {
  requiredTier: PropTypes.oneOf(["basic", "pro", "elite"]).isRequired,
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  trialEndText: PropTypes.string,
  lockText: PropTypes.string,
  children: PropTypes.node.isRequired,
};

/**
 * Feature List Context - For dashboard-level feature visibility management
 */
const FeatureVisibilityContext = createContext({
  userTier: "basic",
  isTrialActive: false,
  visibleCards: [],
  lockedCards: [],
  hiddenCards: [],
});

export const FeatureVisibilityProvider = ({ userTier = "basic", isTrialActive = false, children }) => {
  const value = useMemo(() => {
    const visibleCards = [];
    const lockedCards = [];
    const hiddenCards = [];
    
    Object.entries(CARD_TIER_CONFIG).forEach(([cardId, config]) => {
      const canAccess = hasAccess(userTier, config.tier, isTrialActive);
      
      if (canAccess) {
        visibleCards.push(cardId);
      } else if (config.tier === "pro") {
        // Pro cards show as locked (to encourage upgrade)
        lockedCards.push(cardId);
      } else {
        // Elite cards are completely hidden for basic users (cleaner UI)
        if (userTier === "basic") {
          hiddenCards.push(cardId);
        } else {
          lockedCards.push(cardId);
        }
      }
    });
    
    return {
      userTier,
      isTrialActive,
      visibleCards,
      lockedCards,
      hiddenCards,
    };
  }, [userTier, isTrialActive]);
  
  return (
    <FeatureVisibilityContext.Provider value={value}>
      {children}
    </FeatureVisibilityContext.Provider>
  );
};

FeatureVisibilityProvider.propTypes = {
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

export const useFeatureVisibility = () => useContext(FeatureVisibilityContext);

/**
 * Quick check hook for card visibility
 */
export const useCardAccess = (cardId) => {
  const { userTier, isTrialActive, visibleCards, lockedCards } = useFeatureVisibility();
  const config = CARD_TIER_CONFIG[cardId];
  
  return {
    canAccess: visibleCards.includes(cardId),
    isLocked: lockedCards.includes(cardId),
    requiredTier: config?.tier || "basic",
    userTier,
    isTrialActive,
  };
};

/**
 * Upgrade CTA Component
 */
export const UpgradeCTA = ({ targetTier = "pro", variant = "banner", onUpgrade }) => {
  const tierConfig = TIERS[targetTier] || TIERS.pro;
  const Icon = tierConfig.icon;
  
  if (variant === "banner") {
    return (
      <div className={`rounded-xl p-4 ${tierConfig.bgColor} border ${tierConfig.borderColor}`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Icon className={`w-6 h-6 ${tierConfig.color}`} />
            <div>
              <h4 className={`font-semibold ${tierConfig.color}`}>
                Upgrade auf {tierConfig.label}
              </h4>
              <p className="text-sm text-slate-400">
                {targetTier === "pro" 
                  ? "Schalte erweiterte Signale, Backtesting und mehr frei."
                  : "Erhalte Zugang zu allen Elite-Features inkl. AI Signals & ETF Analyse."
                }
              </p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all hover:scale-105 ${
              targetTier === "elite" 
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-white"
            }`}
          >
            <span>Jetzt upgraden</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
  
  // Compact variant
  return (
    <button
      onClick={onUpgrade}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 ${tierConfig.bgColor} ${tierConfig.color} border ${tierConfig.borderColor}`}
    >
      <Icon className="w-4 h-4" />
      <span>{tierConfig.label}</span>
    </button>
  );
};

UpgradeCTA.propTypes = {
  targetTier: PropTypes.oneOf(["pro", "elite"]),
  variant: PropTypes.oneOf(["banner", "compact"]),
  onUpgrade: PropTypes.func,
};

export default {
  TIERS,
  TIER_ORDER,
  CARD_TIER_CONFIG,
  hasAccess,
  TierBadge,
  TierGate,
  TierLock,
  TierOverlay,
  FeatureVisibilityProvider,
  useFeatureVisibility,
  useCardAccess,
  UpgradeCTA,
};
