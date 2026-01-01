/**
 * Feature Gate Component
 * Vision AI Mind - Elite Trader Dashboard
 * 
 * Conditionally renders content based on subscription tier.
 * Shows upgrade prompt for locked features.
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import React, { useContext } from "react";
import PropTypes from "prop-types";
import { Lock, Crown, Zap, ArrowRight } from "lucide-react";
import { SubscriptionContext } from "../context/SubscriptionContext";
import { 
  SUBSCRIPTION_TIER, 
  FEATURE, 
  hasFeatureAccess, 
  getMinimumTierForFeature,
  getTierInfo,
  CARD_FEATURE_MAP,
} from "../config/subscriptionTiers";

// ============================================
// UPGRADE PROMPT COMPONENT
// ============================================

const UpgradePrompt = ({ requiredTier, feature, compact = false }) => {
  const tierInfo = getTierInfo(requiredTier);
  const subscription = useContext(SubscriptionContext);
  
  const handleUpgrade = () => {
    // In production: open payment modal
    console.log("[FeatureGate] Upgrade clicked:", requiredTier);
    if (subscription?.handleUpgrade) {
      subscription.handleUpgrade(requiredTier);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleUpgrade}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
                   bg-gradient-to-r from-amber-500/20 to-orange-500/20 
                   border border-amber-500/30 text-amber-300
                   hover:from-amber-500/30 hover:to-orange-500/30 transition-all"
      >
        <Lock className="w-3 h-3" />
        <span>Unlock with {tierInfo.name}</span>
      </button>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700/50 p-6">
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-slate-900/60 z-10" />
      
      {/* Content */}
      <div className="relative z-20 flex flex-col items-center justify-center text-center py-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                        bg-gradient-to-br ${
                          requiredTier === SUBSCRIPTION_TIER.ELITE
                            ? "from-amber-500/20 to-orange-500/20 border-amber-500/30"
                            : "from-blue-500/20 to-cyan-500/20 border-blue-500/30"
                        } border`}>
          {requiredTier === SUBSCRIPTION_TIER.ELITE ? (
            <Crown className="w-8 h-8 text-amber-400" />
          ) : (
            <Zap className="w-8 h-8 text-blue-400" />
          )}
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">
          {tierInfo.name} Feature
        </h3>
        
        <p className="text-sm text-slate-400 mb-4 max-w-xs">
          Upgrade to {tierInfo.name} to unlock this feature and {
            requiredTier === SUBSCRIPTION_TIER.ELITE
              ? "access the full AI-powered trading suite"
              : "get advanced analytics"
          }.
        </p>
        
        <button
          onClick={handleUpgrade}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium
                     transition-all transform hover:scale-105
                     ${
                       requiredTier === SUBSCRIPTION_TIER.ELITE
                         ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400"
                         : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400"
                     }`}
        >
          <span>Upgrade to {tierInfo.name}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
        
        <p className="text-xs text-slate-500 mt-3">
          Starting at {tierInfo.priceLabel}
        </p>
      </div>
    </div>
  );
};

UpgradePrompt.propTypes = {
  requiredTier: PropTypes.string.isRequired,
  feature: PropTypes.string,
  compact: PropTypes.bool,
};

// ============================================
// FEATURE GATE COMPONENT
// ============================================

/**
 * Conditionally renders children based on subscription tier
 * 
 * @param {string} feature - Feature ID from FEATURE enum
 * @param {string} cardId - Card ID for automatic feature lookup
 * @param {boolean} showUpgrade - Show upgrade prompt for locked features
 * @param {boolean} blur - Blur locked content instead of hiding
 * @param {React.ReactNode} children - Content to gate
 * @param {React.ReactNode} fallback - Custom fallback for locked state
 */
const FeatureGate = ({
  feature,
  cardId,
  showUpgrade = true,
  blur = false,
  compact = false,
  children,
  fallback = null,
}) => {
  const subscription = useContext(SubscriptionContext);
  
  // Determine user's current tier
  const userTier = subscription?.plan || subscription?.tier || SUBSCRIPTION_TIER.BASIC;
  
  // Resolve feature from cardId if not provided
  const resolvedFeature = feature || (cardId ? CARD_FEATURE_MAP[cardId] : null);
  
  // If no feature restriction, show content
  if (!resolvedFeature) {
    return <>{children}</>;
  }
  
  // Check access
  const hasAccess = hasFeatureAccess(userTier, resolvedFeature);
  
  // If user has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Get required tier for upgrade prompt
  const requiredTier = getMinimumTierForFeature(resolvedFeature);
  
  // Custom fallback takes priority
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // Blur mode: show content with blur overlay
  if (blur) {
    return (
      <div className="relative">
        <div className="filter blur-sm pointer-events-none select-none">
          {children}
        </div>
        {showUpgrade && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
            <UpgradePrompt requiredTier={requiredTier} feature={resolvedFeature} compact={compact} />
          </div>
        )}
      </div>
    );
  }
  
  // Default: show upgrade prompt
  if (showUpgrade) {
    return <UpgradePrompt requiredTier={requiredTier} feature={resolvedFeature} compact={compact} />;
  }
  
  // Hide completely
  return null;
};

FeatureGate.propTypes = {
  feature: PropTypes.string,
  cardId: PropTypes.string,
  showUpgrade: PropTypes.bool,
  blur: PropTypes.bool,
  compact: PropTypes.bool,
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
};

// ============================================
// HOC VERSION
// ============================================

/**
 * Higher-order component for feature gating
 */
export const withFeatureGate = (WrappedComponent, feature, options = {}) => {
  const GatedComponent = (props) => (
    <FeatureGate feature={feature} {...options}>
      <WrappedComponent {...props} />
    </FeatureGate>
  );
  
  GatedComponent.displayName = `FeatureGated(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  
  return GatedComponent;
};

// ============================================
// HOOK VERSION
// ============================================

/**
 * Hook to check feature access
 */
export const useFeatureAccess = (feature) => {
  const subscription = useContext(SubscriptionContext);
  const userTier = subscription?.plan || subscription?.tier || SUBSCRIPTION_TIER.BASIC;
  
  return {
    hasAccess: hasFeatureAccess(userTier, feature),
    requiredTier: getMinimumTierForFeature(feature),
    currentTier: userTier,
  };
};

export { UpgradePrompt };
export default FeatureGate;
