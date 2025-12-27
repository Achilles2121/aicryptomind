import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

function LiveClock({ className = "" }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={`text-xs text-slate-400 tabular-nums ${className}`}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

LiveClock.propTypes = {
  className: PropTypes.string,
};

export default function Card({ title, icon: Icon, children, actions, tooltip }) {
  return (
    <div
      className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur"
      title={tooltip || title}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          {Icon ? <Icon className="h-5 w-5 text-emerald-400" /> : null}
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <LiveClock className="text-[11px]" />
        </div>
      </div>
      {children}
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  actions: PropTypes.node,
  tooltip: PropTypes.string,
};
