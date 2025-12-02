import React from "react";

export function Card({ title, action, children }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        {title ? <h3 className="text-sm font-semibold text-slate-100">{title}</h3> : <span />}
        {action}
      </div>
      <div className="text-slate-200">{children}</div>
    </div>
  );
}
