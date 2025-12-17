import React from "react";
import { Card } from "../../components/Card";

/**
 * RiskPanel - Temporarily disabled to stay within Vercel Hobby plan limits.
 * API endpoint /api/correlations is not available.
 */
export function RiskPanel() {
  return (
    <Card title="Cross-Asset Correlations">
      <p className="text-sm text-amber-400/80">
        ETF correlations temporarily unavailable - upgrade coming soon
      </p>
      <div className="mt-3 space-y-2 opacity-50">
        <div className="rounded border border-slate-800/60 p-2">
          <p className="font-semibold text-slate-400">BTC vs SPY</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>7d</span><span>--</span>
            </div>
            <div className="flex items-center justify-between">
              <span>30d</span><span>--</span>
            </div>
          </div>
        </div>
        <div className="rounded border border-slate-800/60 p-2">
          <p className="font-semibold text-slate-400">ETH vs QQQ</p>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <span>7d</span><span>--</span>
            </div>
            <div className="flex items-center justify-between">
              <span>30d</span><span>--</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
