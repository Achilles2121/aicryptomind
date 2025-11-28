import React from "react";
import PropTypes from "prop-types";

const LockedCard = ({ title, requiredTier = "pro", description }) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg text-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">{title}</h3>
        <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-200 whitespace-nowrap">
          {requiredTier.toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-slate-300 leading-snug">
        Benötigt {requiredTier.toUpperCase()}-Zugang. {description || "Upgrade, um diese Karte zu sehen."}
      </p>
    </div>
  );
};

LockedCard.propTypes = {
  title: PropTypes.string.isRequired,
  requiredTier: PropTypes.string,
  description: PropTypes.string,
};

export default LockedCard;
