import React from "react";
import PropTypes from "prop-types";
import { Lock, Crown, Zap, Star, ArrowRight } from "lucide-react";

const TIER_CONFIG = {
  basic: { 
    icon: Star, 
    color: "text-slate-400", 
    bgColor: "bg-slate-500/10", 
    borderColor: "border-slate-500/30",
    gradient: "from-slate-600 to-slate-700",
    label: "Basic"
  },
  pro: { 
    icon: Zap, 
    color: "text-amber-400", 
    bgColor: "bg-amber-500/10", 
    borderColor: "border-amber-500/30",
    gradient: "from-amber-500 to-orange-500",
    label: "Pro"
  },
  elite: { 
    icon: Crown, 
    color: "text-violet-400", 
    bgColor: "bg-violet-500/10", 
    borderColor: "border-violet-500/30",
    gradient: "from-violet-600 to-purple-600",
    label: "Elite"
  },
};

/**
 * LockedCard - Zeigt eine gesperrte Karte mit Upgrade-Option
 * Komplett neues Design passend zum Vision AI Mind Dashboard
 */
const LockedCard = ({ 
  title, 
  requiredTier = "pro", 
  description,
  showUpgradeButton = true,
  onUpgrade,
  compact = false,
}) => {
  const config = TIER_CONFIG[requiredTier] || TIER_CONFIG.pro;
  const TierIcon = config.icon;
  
  if (compact) {
    // Kompakte Version für Listen
    return (
      <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-3 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <Lock className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm text-slate-300">{title}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}>
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${config.borderColor} bg-gradient-to-br from-slate-900/90 via-slate-800/50 to-slate-900/90 overflow-hidden shadow-lg`}>
      {/* Decorative top gradient bar */}
      <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />
      
      <div className="p-5 flex flex-col items-center text-center space-y-4">
        {/* Lock Icon */}
        <div className={`p-3 rounded-full ${config.bgColor} border ${config.borderColor}`}>
          <Lock className={`w-6 h-6 ${config.color}`} />
        </div>
        
        {/* Title */}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        
        {/* Description */}
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
          {description || `Diese Funktion erfordert ${config.label}-Zugang. Upgrade, um alle Features freizuschalten.`}
        </p>
        
        {/* Tier Badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bgColor} ${config.color} border ${config.borderColor} text-sm font-medium`}>
          <TierIcon className="w-4 h-4" />
          <span>{config.label} erforderlich</span>
        </div>
        
        {/* Upgrade Button */}
        {showUpgradeButton && (
          <button
            onClick={onUpgrade}
            className={`mt-2 flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white transition-all hover:scale-105 hover:shadow-lg bg-gradient-to-r ${config.gradient}`}
          >
            <span>Upgrade auf {config.label}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

LockedCard.propTypes = {
  title: PropTypes.string.isRequired,
  requiredTier: PropTypes.oneOf(["basic", "pro", "elite"]),
  description: PropTypes.string,
  showUpgradeButton: PropTypes.bool,
  onUpgrade: PropTypes.func,
  compact: PropTypes.bool,
};

export default LockedCard;
