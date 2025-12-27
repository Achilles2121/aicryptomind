import React from "react";
import PropTypes from "prop-types";
import { Signal } from "lucide-react";

export default function IndicatorBadge({ label, value, intent }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
        intent === "warn"
          ? "bg-red-500/10 text-red-200"
          : intent === "ok"
          ? "bg-emerald-500/10 text-emerald-200"
          : "bg-slate-800 text-slate-200"
      }`}
    >
      <Signal className="h-4 w-4" />
      <span className="font-semibold">{label}</span>
      <span className="text-slate-300">{value}</span>
    </div>
  );
}

IndicatorBadge.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  intent: PropTypes.oneOf(["warn", "ok", "neutral"]).isRequired,
};
