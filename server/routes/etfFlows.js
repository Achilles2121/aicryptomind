/* eslint-env node */
import { Router } from "express";
import { fetchHistoricalMarketCap } from "../../api/_lib/providers/fmp.js";
import { fetchSosoEtfFlow } from "../../api/_lib/providers/sosovalue.js";
import { fetchCoinstatsFlows } from "../../api/_lib/providers/coinstats.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { fillFlowSeries, computeFlowsFromAum, normalizeFlowRow, sumRange } from "../../api/_lib/etf.js";
import { withCache } from "../utils/cache.js";

const router = Router();
const DEFAULT_SYMBOLS = (process.env.ETF_SYMBOLS || "IBIT,FBTC,ARKB,BITB,HODL").split(",").map((s) => s.trim().toUpperCase());
const MAX_SYMBOLS = Number(process.env.ETF_SYMBOL_LIMIT || 12);
const safeFixed = (val, digits = 2) => (Number(val) || 0).toFixed(digits);

const parseSymbols = (query) => {
  if (!query) return DEFAULT_SYMBOLS;
  return query
    .split(/[\s,]+/)
    .map((sym) => sym.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);
};

const createLazy = (factory) => {
  let promise;
  return async () => {
    if (!promise) {
      promise = factory().catch((err) => {
        promise = null;
        throw err;
      });
    }
    return promise;
  };
};

const buildSampleFlow = (symbol) => {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, idx) => ({
    symbol,
    ts: now - (30 - idx) * 24 * 60 * 60 * 1000,
    flowUsd: safeFixed(Math.sin(idx / 5) * 50_000, 2),
  }));
};

async function buildFlowSeries(symbol, tracker, fetchSoso, fetchCoinstats) {
  const attempts = [
    {
      key: "ETF_FLOWS_FMP",
      exec: async () => {
        const history = await fetchHistoricalMarketCap(symbol);
        if (!history.length) throw new Error("FMP empty");
        return computeFlowsFromAum(history);
      },
    },
    {
      key: "ETF_FLOWS_SOSO",
      exec: async () => {
        const rows = await fetchSoso();
        const filtered = rows.filter((row) => normalizeFlowRow(row).symbol.includes(symbol));
        if (!filtered.length) throw new Error("Soso empty");
        return filtered.map((row) => normalizeFlowRow(row));
      },
    },
    {
      key: "ETF_FLOWS_COINSTATS",
      exec: async () => {
        const rows = await fetchCoinstats();
        const filtered = rows.filter((row) => normalizeFlowRow(row).symbol.includes(symbol));
        if (!filtered.length) throw new Error("Coinstats empty");
        return filtered.map((row) => normalizeFlowRow(row));
      },
    },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const rows = await attempt.exec();
      tracker.set(attempt.key, "ok");
      const normalized = fillFlowSeries(rows.slice(-30), 30);
      return {
        ok: true,
        symbol,
        points: normalized,
        sum7dUsd: sumRange(normalized, 7),
        sum30dUsd: sumRange(normalized, 30),
        provider: attempt.key,
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      const status = i === attempts.length - 1 ? "error" : "degraded";
      tracker.set(attempt.key, status, err?.message || "fetch failed");
    }
  }

  tracker.set("ETF_FLOWS_SAMPLE", "degraded", "using sample data");
  const sample = fillFlowSeries(buildSampleFlow(symbol), 30);
  return {
    ok: false,
    symbol,
    points: sample,
    sum7dUsd: sumRange(sample, 7),
    sum30dUsd: sumRange(sample, 30),
    provider: "sample",
    lastUpdated: new Date().toISOString(),
  };
}

router.get("/", async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const symbols = parseSymbols(req.query.symbols);
  const tracker = createHealthTracker();
  const fetchSoso = createLazy(() => fetchSosoEtfFlow().then((rows) => rows.map(normalizeFlowRow)));
  const fetchCoinstats = createLazy(() => fetchCoinstatsFlows().then((rows) => rows.map(normalizeFlowRow)));

  try {
    const result = await withCache(`etf:flows:${symbols.join(",")}`, 60_000, async () => {
      const data = [];
      for (const symbol of symbols) {
        data.push(await buildFlowSeries(symbol, tracker, fetchSoso, fetchCoinstats));
      }
      return { data, health: tracker.toArray() };
    });
    return res.json({ ok: true, data: result.data, health: result.health, generatedAt: new Date().toISOString() });
  } catch (err) {
    tracker.set("ETF_FLOWS", "error", err?.message || "flows failed");
    return res.status(200).json({
      ok: false,
      error: "flows_unavailable",
      status: 502,
      data: [],
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  }
});

export default router;
