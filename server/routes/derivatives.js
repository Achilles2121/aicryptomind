/* eslint-env node */
import { Router } from "express";
import { createHealthTracker } from "../../api/_lib/health.js";
import { clampNumber } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";
import { safeFetchJson } from "../utils/safeFetch.js";

const router = Router();
const METRIC_FUNDING = "DERIVATIVES_FUNDING_RATE_CURRENT";
const METRIC_OI = "DERIVATIVES_OPEN_INTEREST";

const parseMetricSeries = (rows = [], metricKey) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const ts =
        Date.parse(row.time_period_end || row.time_close || row.time || row.period_end_time || row.timestamp || 0) || 0;
      const metrics = Array.isArray(row.metrics)
        ? row.metrics.find((m) => m.metric_id === metricKey || m.metric || m.id === metricKey)
        : null;
      const value =
        Number(row.metric_value ?? row.value ?? row[metricKey] ?? (metrics ? metrics.value : undefined) ?? 0);
      return { time: ts, value };
    })
    .filter((entry) => Number.isFinite(entry.value) && entry.time);
};

const zScore = (values = []) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(Math.max(variance, 1e-9));
  const last = values[values.length - 1];
  return (last - mean) / std;
};

const computeDeltaSeries = (series = []) => {
  const sorted = [...series].sort((a, b) => a.time - b.time);
  const deltas = [];
  for (let i = 1; i < sorted.length; i++) {
    deltas.push(sorted[i].value - sorted[i - 1].value);
  }
  return deltas;
};

const buildRiskScore = (fundingSeries = [], oiSeries = []) => {
  const fundingDeltas = computeDeltaSeries(fundingSeries).slice(-20);
  const oiDeltas = computeDeltaSeries(oiSeries).slice(-20);
  const fundingScore = zScore(fundingDeltas);
  const oiScore = zScore(oiDeltas);
  const composite = 0.6 * oiScore + 0.4 * fundingScore;
  let riskLevel = "neutral";
  if (composite >= 1) riskLevel = "hot";
  else if (composite <= -0.5) riskLevel = "cool";
  return { composite, fundingScore, oiScore, riskLevel };
};

const fetchMetric = async ({ symbol, period, limit, metric, apiKey }) => {
  const params = new URLSearchParams({
    period_id: period,
    limit: String(limit),
    metrics: metric,
  });
  const url = `https://rest.coinapi.io/v1/metrics/${encodeURIComponent(symbol)}/history?${params.toString()}`;
  const rows = await safeFetchJson(url, {
    label: `coinapi-${metric.toLowerCase()}`,
    timeoutMs: 7000,
    retries: 1,
    headers: { "X-CoinAPI-Key": apiKey },
  });
  return parseMetricSeries(rows, metric);
};

router.get("/", async (req, res, _next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const tracker = createHealthTracker();
  const symbol = String(req.query.symbol || "BITSTAMP_SPOT_BTC_USD").toUpperCase();
  const period = String(req.query.period || "1HRS").toUpperCase();
  const limit = clampNumber(req.query.limit || 200, { min: 50, max: 400 });
  const cacheMs = clampNumber(req.query.cacheMs || 1000, { min: 0, max: 10_000 });
  const apiKey = process.env.VITE_COINAPI_KEY || process.env.COINAPI_KEY;

  if (!apiKey) {
    tracker.set("DERIVATIVES_PRIMARY", "error", "missing coinapi key");
    return res.status(200).json({
      data: { funding: [], openInterest: [], risk: { composite: 0, fundingScore: 0, oiScore: 0, riskLevel: "neutral" } },
      meta: { symbol, period, limit },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
      error: "missing_coinapi_key",
    });
  }

  try {
    const data = await withCache(`derivatives:${symbol}:${period}:${limit}`, cacheMs, async () => {
      const funding = await fetchMetric({ symbol, period, limit, metric: METRIC_FUNDING, apiKey });
      const oi = await fetchMetric({ symbol, period, limit, metric: METRIC_OI, apiKey });

      tracker.set("DERIVATIVES_PRIMARY", "ok");

      const risk = buildRiskScore(funding, oi);
      return { funding, openInterest: oi, risk };
    });

    return res.json({
      data,
      meta: { symbol, period, limit },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    tracker.set("DERIVATIVES_PRIMARY", "error", err?.message || "coinapi failed");
    return res.status(200).json({
      data: { funding: [], openInterest: [], risk: { composite: 0, fundingScore: 0, oiScore: 0, riskLevel: "neutral" } },
      meta: { symbol, period, limit },
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
      error: err?.message || "coinapi failed",
    });
  }
});

export default router;
