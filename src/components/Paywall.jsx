import React from "react";
import PropTypes from "prop-types";
import { Shield } from "lucide-react";
import LockedCard from "./LockedCard";

export const TIER_ORDER = ["basic", "pro", "elite"];

const TIER_CONFIG = {
  basic: { color: "text-slate-400", bgColor: "bg-slate-500/10", borderColor: "border-slate-500/30", label: "Basic" },
  pro: { color: "text-amber-400", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/30", label: "Pro" },
  elite: { color: "text-violet-400", bgColor: "bg-violet-500/10", borderColor: "border-violet-500/30", label: "Elite" },
};

/**
 * Paywall Component - Redesigned for clean tier-based access
 * Three modes:
 * - overlay: Blurred content with lock (default)
 * - hidden: Completely hide the content
 * - locked: Show a locked placeholder card
 */
const Paywall = ({
  minTier = "basic",
  userTier = "basic",
  isTrialActive = false,
  trialEndText = "",
  lockText = "",
  mode = "overlay",
  cardTitle = "",
  onUpgrade,
  children,
}) => {
  const unlockedByTier = TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier);
  const unlockedByTrial = isTrialActive && TIER_ORDER.indexOf("pro") >= TIER_ORDER.indexOf(minTier);
  const locked = !(unlockedByTier || unlockedByTrial);

  if (!locked) return children;

  const tierConfig = TIER_CONFIG[minTier] || TIER_CONFIG.pro;
  const defaultLockText = `${tierConfig.label} erforderlich`;

  if (mode === "hidden") {
    return null;
  }

  if (mode === "locked") {
    return (
      <LockedCard
        title={cardTitle || "Gesperrte Funktion"}
        requiredTier={minTier}
        description={lockText || `Diese Funktion erfordert ${tierConfig.label}-Zugang.`}
        showUpgradeButton={!!onUpgrade}
        onUpgrade={onUpgrade}
      />
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none">
        <div className="absolute inset-0 rounded-xl bg-slate-950/85 backdrop-blur-[3px] z-10" />
        <div className={`absolute inset-0 rounded-xl border-2 border-dashed ${tierConfig.borderColor} z-10`} />
        <div className="relative opacity-20">{children}</div>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 space-y-3 p-4">
        <div className={`p-3 rounded-full ${tierConfig.bgColor} border ${tierConfig.borderColor} shadow-lg`}>
          <Shield className={`w-6 h-6 ${tierConfig.color}`} />
        </div>
        <div className={`px-4 py-2 rounded-lg ${tierConfig.bgColor} border ${tierConfig.borderColor} shadow-md text-center`}>
          <span className={`text-sm font-semibold ${tierConfig.color}`}>{lockText || defaultLockText}</span>
        </div>
        {trialEndText && <span className="text-xs text-amber-400 text-center">{trialEndText}</span>}
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className={`mt-1 px-4 py-1.5 rounded-lg text-sm font-medium ${tierConfig.bgColor} ${tierConfig.color} border ${tierConfig.borderColor} hover:scale-105 transition-transform`}
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
};

Paywall.propTypes = {
  minTier: PropTypes.string,
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  trialEndText: PropTypes.string,
  lockText: PropTypes.string,
  mode: PropTypes.oneOf(["overlay", "hidden", "locked"]),
  cardTitle: PropTypes.string,
  onUpgrade: PropTypes.func,
  children: PropTypes.node.isRequired,
};

export default Paywall;
