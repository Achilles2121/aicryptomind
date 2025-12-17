import React from "react";
import { Card } from "../../components/Card";

/**
 * IndicatorCards - Temporarily disabled to stay within Vercel Hobby plan limits.
 * API endpoint /api/indicators is not available.
 */
export function IndicatorCards({ symbol: _symbol = "BTCUSDT" }) {
  const placeholderCards = [
    { label: "RSI", value: "--" },
    { label: "Trend Strength", value: "--" },
    { label: "ATR", value: "--" },
    { label: "Volatility", value: "--" },
    { label: "Smart Money Flow", value: "--" },
    { label: "Stochastic K", value: "--" },
  ];

  return (
    <Card title="Indicator Engine V4">
      <p className="mb-3 text-xs text-amber-400/80">
        Indicators temporarily unavailable - upgrade coming soon
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {placeholderCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3 text-sm opacity-60"
          >
            <p className="text-slate-400">{card.label}</p>
            <p className="text-lg font-semibold text-slate-500">{card.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
