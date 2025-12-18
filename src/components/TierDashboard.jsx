// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { memo } from "react";
import PropTypes from "prop-types";
import { 
  Crown, 
  Zap, 
  Star, 
  Check, 
  TrendingUp, 
  BarChart3,
  Activity,
  Target,
  Shield,
  Brain,
  LineChart,
  Gauge,
  Bell,
  Wallet,
  ArrowRight
} from "lucide-react";

/**
 * Tier Comparison Dashboard
 * Shows what features are available in each tier
 */

const TIER_FEATURES = {
  basic: {
    icon: Star,
    label: "Basic",
    price: "Kostenlos",
    priceNote: "Für immer",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    gradient: "from-slate-600 to-slate-700",
    features: [
      { icon: LineChart, label: "Live Crypto Preise" },
      { icon: Gauge, label: "Fear & Greed Index" },
      { icon: BarChart3, label: "Basis-Indikatoren (RSI, MACD, BB)" },
      { icon: Activity, label: "TradingView Chart Integration" },
      { icon: Shield, label: "System Status Monitor" },
      { icon: Bell, label: "Quick Tips für Einsteiger" },
    ],
  },
  pro: {
    icon: Zap,
    label: "Pro",
    price: "€29",
    priceNote: "/Monat",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    gradient: "from-amber-500 to-orange-500",
    popular: true,
    features: [
      { icon: Star, label: "Alle Basic Features", included: true },
      { icon: Target, label: "Pro Trading Signale" },
      { icon: TrendingUp, label: "Crypto Bubbles Analyse" },
      { icon: Brain, label: "AI Predictor" },
      { icon: BarChart3, label: "Local Backtest Engine" },
      { icon: Shield, label: "Risk Score Summary" },
      { icon: Target, label: "Fibonacci & Trade Levels" },
      { icon: Activity, label: "Derivatives Risk Monitor" },
      { icon: Wallet, label: "Funding Rates & Correlations" },
      { icon: Bell, label: "Social Sentiment Tracker" },
    ],
  },
  elite: {
    icon: Crown,
    label: "Elite",
    price: "€79",
    priceNote: "/Monat",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    gradient: "from-violet-600 to-purple-600",
    features: [
      { icon: Zap, label: "Alle Pro Features", included: true },
      { icon: Brain, label: "AI Signal (Heuristik)" },
      { icon: Gauge, label: "Volatility Prediction System" },
      { icon: Bell, label: "Volatility Alerts" },
      { icon: BarChart3, label: "Advanced Backtest Dashboard" },
      { icon: Wallet, label: "ETF Flows & Holdings" },
      { icon: Activity, label: "ETF Correlation Matrix" },
      { icon: Target, label: "Multi TP/SL Engine" },
      { icon: TrendingUp, label: "On-Chain Metrics (Pro)" },
      { icon: Shield, label: "Order Blocks (SMC)" },
      { icon: Brain, label: "Crypto Edu Chat (AI)" },
      { icon: Crown, label: "Priority Support" },
    ],
  },
};

const TierCard = memo(function TierCard({ 
  tier, 
  currentTier = "basic", 
  onSelect,
  compact = false,
}) {
  const config = TIER_FEATURES[tier];
  const Icon = config.icon;
  const isCurrentTier = currentTier === tier;
  const isUpgrade = ["basic", "pro", "elite"].indexOf(tier) > ["basic", "pro", "elite"].indexOf(currentTier);
  
  if (compact) {
    return (
      <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <span className={`font-semibold ${config.color}`}>{config.label}</span>
          </div>
          {isCurrentTier && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              Aktiv
            </span>
          )}
        </div>
        <ul className="space-y-1.5">
          {config.features.slice(0, 4).map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{feature.label}</span>
            </li>
          ))}
          {config.features.length > 4 && (
            <li className="text-xs text-slate-500">+{config.features.length - 4} weitere Features</li>
          )}
        </ul>
      </div>
    );
  }
  
  return (
    <div className={`relative rounded-2xl border-2 ${isCurrentTier ? 'border-emerald-500' : config.borderColor} bg-gradient-to-br from-slate-900/95 via-slate-800/50 to-slate-900/95 overflow-hidden shadow-xl transition-transform hover:scale-[1.02]`}>
      {/* Popular badge */}
      {config.popular && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
            BELIEBT
          </div>
        </div>
      )}
      
      {/* Current tier indicator */}
      {isCurrentTier && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      )}
      
      {/* Header */}
      <div className="p-6 text-center border-b border-slate-700/50">
        <div className={`inline-flex p-3 rounded-full ${config.bgColor} border ${config.borderColor} mb-4`}>
          <Icon className={`w-8 h-8 ${config.color}`} />
        </div>
        <h3 className={`text-2xl font-bold ${config.color}`}>{config.label}</h3>
        <div className="mt-2">
          <span className="text-3xl font-bold text-white">{config.price}</span>
          <span className="text-slate-400">{config.priceNote}</span>
        </div>
      </div>
      
      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3">
          {config.features.map((feature, idx) => {
            const FeatureIcon = feature.icon;
            return (
              <li key={idx} className="flex items-center gap-3">
                {feature.included ? (
                  <FeatureIcon className={`w-4 h-4 ${config.color}`} />
                ) : (
                  <Check className="w-4 h-4 text-emerald-400" />
                )}
                <span className={`text-sm ${feature.included ? config.color + ' font-medium' : 'text-slate-300'}`}>
                  {feature.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      
      {/* CTA Button */}
      <div className="p-6 pt-0">
        {isCurrentTier ? (
          <button 
            disabled
            className="w-full py-3 rounded-xl bg-emerald-500/20 text-emerald-400 font-semibold cursor-default"
          >
            Aktueller Plan
          </button>
        ) : isUpgrade ? (
          <button 
            onClick={() => onSelect?.(tier)}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 hover:shadow-lg bg-gradient-to-r ${config.gradient} flex items-center justify-center gap-2`}
          >
            <span>Upgrade auf {config.label}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button 
            disabled
            className="w-full py-3 rounded-xl bg-slate-700/50 text-slate-500 font-semibold cursor-not-allowed"
          >
            Downgrade nicht möglich
          </button>
        )}
      </div>
    </div>
  );
});

TierCard.propTypes = {
  tier: PropTypes.oneOf(["basic", "pro", "elite"]).isRequired,
  currentTier: PropTypes.string,
  onSelect: PropTypes.func,
  compact: PropTypes.bool,
};

/**
 * Full Tier Comparison Dashboard
 */
const TierDashboard = memo(function TierDashboard({
  currentTier = "basic",
  onSelectTier,
  showTitle = true,
}) {
  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Wähle deinen Plan</h2>
          <p className="text-slate-400">Schalte Premium-Features für präzisere Trading-Signale frei</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TierCard tier="basic" currentTier={currentTier} onSelect={onSelectTier} />
        <TierCard tier="pro" currentTier={currentTier} onSelect={onSelectTier} />
        <TierCard tier="elite" currentTier={currentTier} onSelect={onSelectTier} />
      </div>
      
      {/* FAQ or additional info */}
      <div className="text-center text-sm text-slate-500 space-y-1">
        <p>Alle Pläne beinhalten 7 Tage kostenlose Pro-Testphase</p>
        <p>Kündigung jederzeit möglich • Keine versteckten Kosten</p>
      </div>
    </div>
  );
});

TierDashboard.propTypes = {
  currentTier: PropTypes.string,
  onSelectTier: PropTypes.func,
  showTitle: PropTypes.bool,
};

/**
 * Compact Feature Access Summary
 * Shows user what they have access to
 */
const TierAccessSummary = memo(function TierAccessSummary({
  userTier = "basic",
  isTrialActive = false,
  trialEndDate = null,
  onUpgrade,
}) {
  const config = TIER_FEATURES[userTier];
  const Icon = config.icon;
  const nextTier = userTier === "basic" ? "pro" : userTier === "pro" ? "elite" : null;
  const nextConfig = nextTier ? TIER_FEATURES[nextTier] : null;
  
  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <span className={`font-semibold ${config.color}`}>{config.label} Plan</span>
          {isTrialActive && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              Trial aktiv
            </span>
          )}
        </div>
        {trialEndDate && isTrialActive && (
          <span className="text-xs text-amber-400">Endet: {trialEndDate}</span>
        )}
      </div>
      
      {/* Quick feature preview */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {config.features.slice(0, 3).map((feature, idx) => (
          <span key={idx} className="px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-300 text-xs">
            {feature.label}
          </span>
        ))}
        <span className="text-xs text-slate-500">+{config.features.length - 3} mehr</span>
      </div>
      
      {/* Upgrade prompt */}
      {nextTier && nextConfig && (
        <button
          onClick={onUpgrade}
          className={`w-full mt-2 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] flex items-center justify-center gap-2 ${nextConfig.bgColor} ${nextConfig.color} border ${nextConfig.borderColor}`}
        >
          <nextConfig.icon className="w-4 h-4" />
          <span>Upgrade auf {nextConfig.label}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
});

TierAccessSummary.propTypes = {
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  trialEndDate: PropTypes.string,
  onUpgrade: PropTypes.func,
};

export { TierCard, TierDashboard, TierAccessSummary, TIER_FEATURES };
export default TierDashboard;
