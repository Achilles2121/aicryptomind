import { fetchEtfHoldingsSeries } from "../_lib/providers/fmp.js";
import { fetchSosoHoldingsSnapshot } from "../_lib/providers/sosovalue.js";
import { fetchCoinstatsHoldingsSnapshot } from "../_lib/providers/coinstats.js";
import { jsonResponse, errorResponse } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";
import { fillSeries, computeChange, upsertMarketShare } from "../_lib/etf.js";

export const config = { runtime: "edge" };

// ============================================
// IN-MEMORY CACHE (5 minutes for ETF data)
// ============================================
const holdingsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - ETF data doesn't change frequently

function getCached(key) {
  const entry = holdingsCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  holdingsCache.delete(key);
  return null;
}

function setCache(key, data) {
  holdingsCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

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
      const status = i === attempts.length - 1 ? "warn" : "degraded";
      tracker.set(attempt.key, status, err?.message || "fetch failed");
    }
  }
  return {
    symbol,
    aumUsd: null,
    shares: null,
    change7d: null,
    change30d: null,
    provider: "unavailable",
    lastUpdated: new Date().toISOString(),
  };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const symbols = parseSymbols(searchParams.get("symbols"));
  
  // Check cache first
  const cacheKey = `holdings_${symbols.join("_")}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return jsonResponse({ ...cached, cached: true });
  }
  
  const tracker = createHealthTracker();
  const fetchSoso = createLazy(() => fetchSosoHoldingsSnapshot());
  const fetchCoinstats = createLazy(() => fetchCoinstatsHoldingsSnapshot());

  try {
    const items = [];
    for (const symbol of symbols) {
      const holding = await buildHolding(symbol, tracker, fetchSoso, fetchCoinstats);
      items.push(holding);
    }
    const response = {
      data: upsertMarketShare(items),
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    };
    setCache(cacheKey, response);
    return jsonResponse(response);
  } catch (err) {
    return errorResponse(err?.message || "Failed to fetch holdings", 502, { health: tracker.toArray() });
  }
}
