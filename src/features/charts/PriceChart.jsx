import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
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

export function PriceChart({ symbol = "BTCUSDT" }) {
  const { data, loading, error } = useDataFetch(
    () => api.get("/ohlc", { symbol, interval: "1h", limit: 80 }),
    [symbol],
    { initialData: { candles: [] }, refreshMs: 15_000 }
  );

  const chartData =
    data?.candles?.map((candle) => ({
      time: formatDate(candle.time),
      close: candle.close,
    })) ?? [];

  return (
    <Card title={`${symbol} Price`}>
      {loading ? <Skeleton className="h-44 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!loading && !error ? (
        <div className="h-52">
          <ResponsiveContainer>
            <LineChart data={chartData}>
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
              <Line
                type="monotone"
                dataKey="close"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </Card>
  );
}
