import React from "react";

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-800 text-slate-200",
    green: "bg-emerald-800 text-emerald-100",
    blue: "bg-sky-800 text-sky-100",
    amber: "bg-amber-800 text-amber-100",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}
