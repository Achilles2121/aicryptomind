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
import { marketService } from "../../services/marketService";
import { formatCurrency, formatDate } from "../../lib/formatters";

export function OhlcChart({ symbol = "BTCUSDT" }) {
  const { data, loading, error } = useDataFetch(
    () => marketService.getOhlc(symbol, "1h", 120),
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
  const dataError = !error && data?.error ? data.error : null;
  const unavailable = !loading && !error && (data?.status && data.status !== "ok");
  const noData = !loading && !error && !dataError && chartData.length === 0;
  const showUnavailable = unavailable || noData;
  const overlayMessage = dataError || data?.error || "OHLC data temporarily unavailable";

  return (
    <Card title={`${symbol} OHLC`}>
      {loading ? <Skeleton className="h-48 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!error && dataError ? <ErrorMessage message={dataError} /> : null}
      {!loading && !error ? (
        <div className="relative h-56">
          {showUnavailable ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              {overlayMessage}
            </div>
          ) : null}
          {!showUnavailable ? (
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
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
