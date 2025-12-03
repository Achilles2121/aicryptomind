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
import { formatCurrency, formatDate } from "../../lib/formatters";
import { marketService } from "../../services/marketService";

export function PriceChart({ symbol = "BTCUSDT" }) {
  const { data, loading, error } = useDataFetch(
    () => marketService.getOhlc(symbol, "1h", 80),
    [symbol],
    { initialData: { candles: [] }, refreshMs: 15_000 }
  );

  const chartData =
    data?.candles?.map((candle) => ({
      time: formatDate(candle.time),
      close: candle.close,
    })) ?? [];
  const dataError = !error && data?.error ? data.error : null;
  const unavailable = !loading && !error && (data?.status && data.status !== "ok");
  const noData = !loading && !error && !dataError && chartData.length === 0;
  const showUnavailable = unavailable || noData;
  const overlayMessage = dataError || data?.error || "Price data temporarily unavailable";

  return (
    <Card title={`${symbol} Price`}>
      {loading ? <Skeleton className="h-44 w-full" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {!error && dataError ? <ErrorMessage message={dataError} /> : null}
      {!loading && !error ? (
        <div className="relative h-52">
          {showUnavailable ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              {overlayMessage}
            </div>
          ) : null}
          {!showUnavailable ? (
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
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
