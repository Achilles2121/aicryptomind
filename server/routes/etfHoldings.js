import { Router } from "express";
import { fetchEtfHoldingsSeries } from "../../api/_lib/providers/fmp.js";
import { fetchSosoHoldingsSnapshot } from "../../api/_lib/providers/sosovalue.js";
import { fetchCoinstatsHoldingsSnapshot } from "../../api/_lib/providers/coinstats.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { fillSeries, computeChange, upsertMarketShare } from "../../api/_lib/etf.js";
import { withCache } from "../utils/cache.js";

const router = Router();
const DEFAULT_SYMBOLS = (process.env.ETF_SYMBOLS || "IBIT,FBTC,ARKB,BITB,HODL").split(",").map((s) => s.trim().toUpperCase());
const MAX_SYMBOLS = Number(process.env.ETF_SYMBOL_LIMIT || 12);

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

const buildSampleSeries = (symbol) => {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, idx) => ({
    symbol,
    ts: now - (30 - idx) * 24 * 60 * 60 * 1000,
    aumUsd: 1_000_000 + idx * 10_000,
    shares: 100_000 + idx * 1000,
  }));
};

async function buildHolding(symbol, tracker, fetchSoso, fetchCoinstats) {
  const attempts = [
    {
      key: "ETF_HOLDINGS_FMP",
      exec: async () => {
        const series = await fetchEtfHoldingsSeries(symbol);
        if (!series.length) throw new Error("FMP empty");
        return fillSeries(series, 30);
      },
    },
    {
      key: "ETF_HOLDINGS_SOSO",
      exec: async () => {
        const rows = await fetchSoso();
        const filtered = rows.filter((row) => row.symbol.includes(symbol));
        if (!filtered.length) throw new Error("Soso empty");
        return fillSeries(filtered, 30);
      },
    },
    {
      key: "ETF_HOLDINGS_COINSTATS",
      exec: async () => {
        const rows = await fetchCoinstats();
        const filtered = rows.filter((row) => row.symbol.includes(symbol));
        if (!filtered.length) throw new Error("Coinstats empty");
        return fillSeries(filtered, 30);
      },
    },
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      const series = await attempt.exec();
      tracker.set(attempt.key, "ok");
      const latest = series.at(-1) || {};
      return {
        symbol,
        aumUsd: latest.aumUsd ?? null,
        shares: latest.shares ?? null,
        change7d: computeChange(series, 7),
        change30d: computeChange(series, 30),
        provider: attempt.key,
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      const status = i === attempts.length - 1 ? "error" : "degraded";
      tracker.set(attempt.key, status, err?.message || "fetch failed");
    }
  }

  tracker.set("ETF_HOLDINGS_SAMPLE", "degraded", "using sample data");
  const sample = fillSeries(buildSampleSeries(symbol), 30);
  return {
    symbol,
    aumUsd: sample.at(-1)?.aumUsd ?? null,
    shares: sample.at(-1)?.shares ?? null,
    change7d: computeChange(sample, 7),
    change30d: computeChange(sample, 30),
    provider: "sample",
    lastUpdated: new Date().toISOString(),
  };
}

router.get("/", async (req, res) => {
  const symbols = parseSymbols(req.query.symbols);
  const tracker = createHealthTracker();
  const fetchSoso = createLazy(() => fetchSosoHoldingsSnapshot());
  const fetchCoinstats = createLazy(() => fetchCoinstatsHoldingsSnapshot());

  try {
    const result = await withCache(`etf:holdings:${symbols.join(",")}`, 60_000, async () => {
      const items = [];
      for (const symbol of symbols) {
        items.push(await buildHolding(symbol, tracker, fetchSoso, fetchCoinstats));
      }
      return { items: upsertMarketShare(items), health: tracker.toArray() };
    });
    return res.json({ data: result.items, health: result.health, generatedAt: new Date().toISOString() });
  } catch (err) {
    tracker.set("ETF_HOLDINGS", "error", err?.message || "holdings failed");
    return res.status(200).json({
      error: "holdings_unavailable",
      data: [],
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  }
});

export default router;
