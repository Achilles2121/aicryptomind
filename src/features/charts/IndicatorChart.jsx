import React from "react";
import {
  Area,
  AreaChart,
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
import { formatCurrency } from "../../lib/formatters";

const fallbackSeries = Array.from({ length: 30 }, (_, i) => ({
  label: i,
  value: 0,
}));

export function IndicatorChart({ symbol = "BTCUSDT", interval = "1h" }) {
  const { data, loading, error } = useDataFetch(
    () => api.get("/indicators", { v: 4, type: "all", symbol, interval }),
    [symbol, interval],
    {
      initialData: {
        frames: {
          [interval]: {
            candles: [],
            indicators: {},
          },
        },
        htfConfirmation: { bullish: false, bearish: false, composite: {} },
      },
      refreshMs: 20_000,
    }
  );

  const frame = data?.frames?.[interval] ?? { candles: [], indicators: {} };
  const candles = frame.candles ?? [];
  const indicators = frame.indicators ?? {};

  const safeCandles =
    candles.length > 0
      ? candles
      : fallbackSeries.map((item) => ({
          time: item.label,
          close: item.value,
          high: item.value,
          low: item.value,
        }));

  const macdData =
    (indicators.macd?.line ?? []).length > 0
      ? indicators.macd.line.map((value, idx) => ({
          label: idx,
          macd: value,
          signal: indicators.macd.signal?.[idx] ?? 0,
          histogram: indicators.macd.histogram?.[idx] ?? 0,
        }))
      : fallbackSeries;

  const stochData =
    (indicators.stochastic?.k ?? []).length > 0
      ? indicators.stochastic.k.map((value, idx) => ({
          label: idx,
          k: value,
          d: indicators.stochastic.d?.[idx] ?? value,
          volatility: indicators.volatility?.[idx] ?? 0,
        }))
      : fallbackSeries.map((item) => ({ label: item.label, k: 50, d: 50, volatility: 0 }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="EMA & Price (V4)">
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <ErrorMessage message={error} /> : null}
        {!loading && !error ? (
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart
                data={safeCandles.map((candle, idx) => ({
                  time:
                    candle.time && typeof candle.time === "number"
                      ? new Date(candle.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : idx,
                  close: candle.close ?? 0,
                  ema21: indicators.ema?.ema21?.[idx] ?? candle.close ?? 0,
                  ema50: indicators.ema?.ema50?.[idx] ?? candle.close ?? 0,
                }))}
              >
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
                  dataKey="close"
                  type="monotone"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="ema21"
                  type="monotone"
                  stroke="#22c55e"
                  strokeWidth={1.5}
                  dot={false}
                  name="EMA 21"
                  isAnimationActive={false}
                />
                <Line
                  dataKey="ema50"
                  type="monotone"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  dot={false}
                  name="EMA 50"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Card>

      <Card title="MACD (V4)">
        {loading ? <Skeleton className="h-40 w-full" /> : null}
        {error ? <ErrorMessage message={error} /> : null}
        {!loading && !error ? (
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={macdData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                  formatter={(value) => value?.toFixed?.(2) ?? value}
                />
                <Line
                  type="monotone"
                  dataKey="macd"
                  stroke="#22c55e"
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="signal"
                  stroke="#f97316"
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Card>

      <Card title="Stochastic & Volatility (V4)">
        {loading ? <Skeleton className="h-36 w-full" /> : null}
        {error ? <ErrorMessage message={error} /> : null}
        {!loading && !error ? (
          <div className="h-40">
            <ResponsiveContainer>
              <AreaChart data={stochData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b" }}
                  formatter={(value) => value?.toFixed?.(2) ?? value}
                />
                <Area type="monotone" dataKey="k" stroke="#38bdf8" fillOpacity={0.15} fill="#38bdf8" />
                <Area type="monotone" dataKey="d" stroke="#22c55e" fillOpacity={0.12} fill="#22c55e" />
                <Area
                  type="monotone"
                  dataKey="volatility"
                  stroke="#f59e0b"
                  fillOpacity={0.08}
                  fill="#f59e0b"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
