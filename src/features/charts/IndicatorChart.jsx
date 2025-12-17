import React from "react";
import { Card } from "../../components/Card";

/**
 * IndicatorChart - Temporarily disabled to stay within Vercel Hobby plan limits.
 * API endpoint /api/indicators is not available.
 */
export function IndicatorChart({ symbol: _symbol = "BTCUSDT", interval: _interval = "1h" }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="EMA & Price (V4)">
        <div className="flex h-44 items-center justify-center rounded-lg border border-slate-800/30 bg-slate-900/40">
          <p className="text-center text-sm text-amber-400/80">
            Chart temporarily unavailable<br />
            <span className="text-xs text-slate-500">Upgrade coming soon</span>
          </p>
        </div>
      </Card>

      <Card title="MACD (V4)">
        <div className="flex h-44 items-center justify-center rounded-lg border border-slate-800/30 bg-slate-900/40">
          <p className="text-center text-sm text-amber-400/80">
            Chart temporarily unavailable<br />
            <span className="text-xs text-slate-500">Upgrade coming soon</span>
          </p>
        </div>
      </Card>

      <Card title="Stochastic & Volatility (V4)">
        <div className="flex h-40 items-center justify-center rounded-lg border border-slate-800/30 bg-slate-900/40">
          <p className="text-center text-sm text-amber-400/80">
            Chart temporarily unavailable<br />
            <span className="text-xs text-slate-500">Upgrade coming soon</span>
          </p>
        </div>
      </Card>
    </div>
  );
}
