import React from "react";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded bg-slate-700/60 ${className}`} />;
}
