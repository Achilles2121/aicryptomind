import React from "react";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/formatters";

export function IndicatorCards({ symbol = "BTCUSDT" }) {
  const { data, loading, error } = useDataFetch(
    () => api.get("/indicators", { v: 4, type: "all", symbol, interval: "1h", limit: 180 }),
    [symbol],
    {
      initialData: { frames: { "1h": { indicators: {} } } },
      refreshMs: 20_000,
    }
  );

  const indicator = data?.frames?.["1h"]?.indicators ?? {};

  const cards = [
    { label: "RSI", value: indicator?.rsi?.at?.(-1) ?? 50, format: (v) => formatNumber(v, 1) },
    {
      label: "Trend Strength",
      value: indicator?.trendStrength ?? 0,
      format: (v) => formatNumber(v, 2),
    },
    { label: "ATR", value: indicator?.atr?.at?.(-1) ?? 0, format: (v) => formatNumber(v, 2) },
    {
      label: "Volatility",
      value: indicator?.volatility?.at?.(-1) ?? 0,
      format: (v) => formatNumber(v, 2),
    },
    {
      label: "Smart Money Flow",
      value: indicator?.smartMoneyFlow ?? 0,
      format: (v) => formatNumber(v, 0),
    },
    {
      label: "Stochastic K",
      value: indicator?.stochastic?.k?.at?.(-1) ?? 0,
      format: (v) => formatPercent(v / 100, 1),
    },
  ];

  return (
    <Card title="Indicator Engine V3+">
      {loading ? <Skeleton className="h-16 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3 text-sm"
            >
              <p className="text-slate-400">{card.label}</p>
              <p className="text-lg font-semibold text-white">{card.format(card.value)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
