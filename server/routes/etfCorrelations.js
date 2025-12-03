/* eslint-env node */
import { Router } from "express";
import { createHealthTracker } from "../../api/_lib/health.js";
import { safeFetchJson } from "../utils/safeFetch.js";
import { withCache } from "../utils/cache.js";

const router = Router();
const ETF_SYMBOLS = (process.env.ETF_CORR_SYMBOLS || "IBIT,FBTC,ARKB,BITB,HODL").split(",").map((s) => s.trim().toUpperCase());
const REFERENCE_ASSETS = (process.env.ETF_CORR_ASSETS || "BTC,ETH,^GSPC,XAU").split(",").map((s) => s.trim().toUpperCase());
const ALPHA_KEY = process.env.ALPHAVANTAGE_KEY || "demo";

const SOURCES = {
  BTC: { cgId: "bitcoin", cc: "BTC", binance: "BTCUSDT" },
  ETH: { cgId: "ethereum", cc: "ETH", binance: "ETHUSDT" },
  "^GSPC": { alpha: "SPX" },
  XAU: { alpha: "GOLD" },
  IBIT: { alpha: "IBIT" },
  FBTC: { alpha: "FBTC" },
  ARKB: { alpha: "ARKB" },
  BITB: { alpha: "BITB" },
  HODL: { alpha: "HODL" },
};

const pearson = (a, b) => {
  if (!a.length || !b.length || a.length !== b.length) return null;
  const n = a.length;
  const meanA = a.reduce((acc, v) => acc + v, 0) / n;
  const meanB = b.reduce((acc, v) => acc + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return null;
  return num / Math.sqrt(denA * denB);
};

const CG_ENDPOINT = (id) => `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30`;
const CC_ENDPOINT = (sym) => `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${sym}&tsym=USD&limit=30`;
const BINANCE_ENDPOINT = (sym) => `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&limit=30`;
const ALPHA_ENDPOINT = (sym) =>
  `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${sym}&apikey=${ALPHA_KEY}`;

const takeCloses = (rows = [], idx = 1) => rows.map((row) => Number(row[idx] || 0)).filter(Number.isFinite);

async function fetchCoingeckoSeries(id) {
  const data = await safeFetchJson(CG_ENDPOINT(id), { label: "ETF_CORR_CG", timeoutMs: 10000 });
  return takeCloses(data?.prices || [], 1);
}

async function fetchCryptoCompareSeries(sym) {
  const data = await safeFetchJson(CC_ENDPOINT(sym), { label: "ETF_CORR_CC", timeoutMs: 10000 });
  const rows = data?.Data?.Data || [];
  return rows.map((row) => Number(row.close || 0)).filter(Number.isFinite);
}

async function fetchBinanceSeries(sym) {
  const rows = await safeFetchJson(BINANCE_ENDPOINT(sym), { label: "ETF_CORR_BINANCE", timeoutMs: 8000 });
  return Array.isArray(rows) ? rows.map((row) => Number(row[4] || 0)).filter(Number.isFinite) : [];
}

async function fetchAlphaSeries(sym) {
  const data = await safeFetchJson(ALPHA_ENDPOINT(sym), { label: "ETF_CORR_ALPHA", timeoutMs: 12000 });
  const series = data?.["Time Series (Daily)"] || {};
  return Object.entries(series)
    .slice(0, 60)
    .map(([date, value]) => ({ date, close: Number(value?.["4. close"] || 0) }))
    .filter((entry) => Number.isFinite(entry.close))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((entry) => entry.close);
}

async function fetchSeries(symbol, tracker) {
  const src = SOURCES[symbol] || {};
  let closes = [];
  try {
    if (src.cgId) {
      closes = await fetchCoingeckoSeries(src.cgId);
      tracker.set("ETF_CORR_PRIMARY", "ok");
    } else if (src.alpha) {
      closes = await fetchAlphaSeries(src.alpha);
      tracker.set("ETF_CORR_PRIMARY", "ok");
    }
  } catch (err) {
    tracker.set("ETF_CORR_PRIMARY", "degraded", err?.message || "primary source failed");
  }

  if (!closes.length && src.cc) {
    try {
      closes = await fetchCryptoCompareSeries(src.cc);
      tracker.set("ETF_CORR_FALLBACK", "ok", "cryptocompare");
    } catch (err) {
      tracker.set("ETF_CORR_FALLBACK", "degraded", err?.message || "cc failed");
    }
  }

  if (!closes.length && src.binance) {
    try {
      closes = await fetchBinanceSeries(src.binance);
      tracker.set("ETF_CORR_FALLBACK", "ok", "binance");
    } catch (err) {
      tracker.set("ETF_CORR_FALLBACK", "error", err?.message || "binance failed");
    }
  }

  return closes.length ? { symbol, closes } : null;
}

router.get("/", async (_req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const tracker = createHealthTracker();
  try {
    const result = await withCache("etf:correlations", 120_000, async () => {
      const targets = [...ETF_SYMBOLS, ...REFERENCE_ASSETS];
      const seriesList = await Promise.all(targets.map((symbol) => fetchSeries(symbol, tracker)));
      const present = seriesList.filter(Boolean);
      const map = new Map();
      present.forEach((entry) => map.set(entry.symbol, entry.closes));
      const data = [];
      ETF_SYMBOLS.forEach((etf) => {
        REFERENCE_ASSETS.forEach((asset) => {
          const a = map.get(etf) || [];
          const b = map.get(asset) || [];
          const len = Math.min(a.length, b.length);
          const alignedA = len ? a.slice(-len) : [];
          const alignedB = len ? b.slice(-len) : [];
          const corr30 = len >= 30 ? pearson(alignedA.slice(-30), alignedB.slice(-30)) : null;
          const corr7 = len >= 7 ? pearson(alignedA.slice(-7), alignedB.slice(-7)) : null;
          data.push({ pair: `${etf}-${asset}`, corr7d: corr7, corr30d: corr30 });
        });
      });
      return { data, health: tracker.toArray() };
    });

    const payload = {
      ok: true,
      data: result.data || [],
      health: result.health || tracker.toArray(),
      generatedAt: new Date().toISOString(),
    };

    if (!payload.data.length) {
      tracker.set("ETF_CORR_PRIMARY", "degraded", "no data (rate limit?)");
      return res.status(200).json({ ...payload, error: "correlation_unavailable" });
    }

    return res.json(payload);
  } catch (err) {
    tracker.set("ETF_CORR_PRIMARY", "error", err?.message || "correlation failed");
    return res
      .status(200)
      .json({
        ok: false,
        error: "correlation_unavailable",
        status: 502,
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
        data: [],
      });
  }
});

export default router;
