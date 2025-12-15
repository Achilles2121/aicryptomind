import { fetchHistoricalMarketCap } from "../_lib/providers/fmp.js";
import { fetchSosoEtfFlow } from "../_lib/providers/sosovalue.js";
import { fetchCoinstatsFlows } from "../_lib/providers/coinstats.js";
import { jsonResponse, errorResponse } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";
import { fillFlowSeries, computeFlowsFromAum, normalizeFlowRow, sumRange } from "../_lib/etf.js";

export const config = { runtime: "edge" };

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
        symbol,
        points: normalized,
        sum7dUsd: sumRange(normalized, 7),
        sum30dUsd: sumRange(normalized, 30),
        provider: attempt.key,
        lastUpdated: new Date().toISOString(),
      };
      } catch (err) {
        const status = i === attempts.length - 1 ? "warn" : "degraded";
        tracker.set(attempt.key, status, err?.message || "fetch failed");
      }
    }
  return {
    symbol,
    points: fillFlowSeries([], 30),
    sum7dUsd: 0,
    sum30dUsd: 0,
    provider: "unavailable",
    lastUpdated: new Date().toISOString(),
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  const tracker = createHealthTracker();
  const fetchSoso = createLazy(() => fetchSosoEtfFlow().then((rows) => rows.map(normalizeFlowRow)));
  const fetchCoinstats = createLazy(() => fetchCoinstatsFlows().then((rows) => rows.map(normalizeFlowRow)));

  try {
    const data = [];
    for (const symbol of symbols) {
      data.push(await buildFlowSeries(symbol, tracker, fetchSoso, fetchCoinstats));
    }
    return jsonResponse({ data, health: tracker.toArray(), generatedAt: new Date().toISOString() });
  } catch (err) {
    return errorResponse(err?.message || "Failed to fetch flows", 502, { health: tracker.toArray() });
  }
}
