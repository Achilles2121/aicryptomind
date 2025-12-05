import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { createHealthTracker } from "./_lib/health.js";
import { clampNumber } from "./_lib/utils.js";
import { jsonResponse } from "./_lib/http.js";

export const config = { runtime: "edge" };

// FIX: Serve derivatives metrics via CoinAPI proxy for both local and Vercel.
type MetricPoint = { time: number; value: number };

const METRIC_FUNDING = "DERIVATIVES_FUNDING_RATE_CURRENT";
const METRIC_OI = "DERIVATIVES_OPEN_INTEREST";

const normalizePoint = (row: any, metricKey: string): MetricPoint | null => {
  const ts =
    Date.parse(row?.time_period_end || row?.time_close || row?.time || row?.period_end_time || row?.timestamp || 0) || 0;
  const metrics = Array.isArray(row?.metrics)
    ? row.metrics.find((m: any) => m?.metric_id === metricKey || m?.metric === metricKey || m?.id === metricKey)
    : null;
  const rawValue = row?.metric_value ?? row?.value ?? row?.[metricKey] ?? (metrics ? metrics.value : undefined);
  const value = Number(rawValue ?? 0);
  if (!ts || !Number.isFinite(value)) return null;
  return { time: ts, value };
};

const parseMetricSeries = (rows: any[] = [], metricKey: string): MetricPoint[] =>
  rows
    .map((row) => normalizePoint(row, metricKey))
    .filter(Boolean) as MetricPoint[];

const zScore = (values: number[] = []) => {
  if (!values.length) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(Math.max(variance, 1e-9));
  const last = values.at(-1) ?? 0;
  return (last - mean) / std;
};

const computeDeltaSeries = (series: MetricPoint[] = []) => {
  const sorted = [...series].sort((a, b) => a.time - b.time);
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    deltas.push(sorted[i].value - sorted[i - 1].value);
  }
  return deltas;
};

const buildRiskScore = (fundingSeries: MetricPoint[] = [], oiSeries: MetricPoint[] = []) => {
  const fundingDeltas = computeDeltaSeries(fundingSeries).slice(-20);
  const oiDeltas = computeDeltaSeries(oiSeries).slice(-20);
  const fundingScore = zScore(fundingDeltas);
  const oiScore = zScore(oiDeltas);
  const composite = 0.6 * oiScore + 0.4 * fundingScore;
  let riskLevel: "hot" | "neutral" | "cool" = "neutral";
  if (composite >= 1) riskLevel = "hot";
  else if (composite <= -0.5) riskLevel = "cool";
  return { composite, fundingScore, oiScore, riskLevel };
};

const fetchMetric = async ({
  symbol,
  period,
  limit,
  metric,
  apiKey,
}: {
  symbol: string;
  period: string;
  limit: number;
  metric: string;
  apiKey: string;
}) => {
  const params = new URLSearchParams({
    period_id: period,
    limit: String(limit),
    metrics: metric,
  });
  const url = `https://rest.coinapi.io/v1/metrics/${encodeURIComponent(symbol)}/history?${params.toString()}`;
  const rows = await safeFetchJson<any[]>(url, {
    headers: { "X-CoinAPI-Key": apiKey },
    timeoutMs: 7000,
    attempts: 2,
  });
  return parseMetricSeries(rows, metric);
};

const EMPTY_DATA = {
  funding: [] as MetricPoint[],
  openInterest: [] as MetricPoint[],
  risk: { composite: 0, fundingScore: 0, oiScore: 0, riskLevel: "neutral" as const },
};

export default async function handler(req: Request) {
  const tracker = createHealthTracker();
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "BITSTAMP_SPOT_BTC_USD").toUpperCase();
  const period = (searchParams.get("period") || "1HRS").toUpperCase();
  const limit = clampNumber(searchParams.get("limit") || 200, { min: 50, max: 400 });
  const cacheMs = clampNumber(searchParams.get("cacheMs") || 1500, { min: 0, max: 10_000 });
  const apiKey = process.env.VITE_COINAPI_KEY || process.env.COINAPI_KEY;

  if (!apiKey) {
    tracker.set("DERIVATIVES_PRIMARY", "error", "missing coinapi key");
    return jsonResponse({
      data: EMPTY_DATA,
      meta: { symbol, period, limit },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
      error: "missing_coinapi_key",
    });
  }

  const key = cacheKey("derivatives", symbol, period, limit);
  const cached = cache.get<typeof EMPTY_DATA>(key);
  if (cached) {
    return jsonResponse({
      data: cached,
      meta: { symbol, period, limit, cached: true },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const funding = await fetchMetric({ symbol, period, limit, metric: METRIC_FUNDING, apiKey });
    const openInterest = await fetchMetric({ symbol, period, limit, metric: METRIC_OI, apiKey });
    const risk = buildRiskScore(funding, openInterest);
    tracker.set("DERIVATIVES_PRIMARY", "ok");

    const payload = { funding, openInterest, risk };
    cache.set(key, payload);
    return jsonResponse({
      data: payload,
      meta: { symbol, period, limit, cached: false },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    tracker.set("DERIVATIVES_PRIMARY", "error", err?.message || "coinapi failed");
    return jsonResponse({
      data: EMPTY_DATA,
      meta: { symbol, period, limit },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
      error: err?.message || "coinapi failed",
    });
  }
}
