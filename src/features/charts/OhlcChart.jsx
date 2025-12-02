import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../../components/Card";
import { Skeleton } from "../../components/Skeleton";
import { ErrorMessage } from "../../components/ErrorMessage";
import { useDataFetch } from "../../hooks/useDataFetch";
import { api } from "../../lib/api";
import { formatCurrency, formatDate } from "../../lib/formatters";

export function OhlcChart({ symbol = "BTCUSDT" }) {
  const { data, loading, error } = useDataFetch(
    () => api.get("/ohlc", { symbol, interval: "1h", limit: 120 }),
    [symbol],
    { initialData: { candles: [] }, refreshMs: 20_000 }
  );

  const chartData =
    data?.candles?.map((candle) => ({
      time: formatDate(candle.time),
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })) ?? [];

  return (
    <Card title={`${symbol} OHLC`}>
      {loading ? <Skeleton className="h-48 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickFormatter={(v) => formatCurrency(v, 0)}
                width={70}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                formatter={(value) => formatCurrency(Number(value), 2)}
              />
              <Area
                type="monotone"
                dataKey="low"
                stroke="#f59e0b"
                fill="#fbbf24"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="high"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#38bdf8"
                fill="#38bdf8"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </Card>
  );
}
