import { fetchHistoricalMarketCap } from "../_lib/providers/fmp.js";
import { fetchJson, jsonResponse, errorResponse } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";

export const config = { runtime: "edge" };

// FIX: Add ETF correlation proxy so the dashboard can load live correlation matrices.
const DEFAULT_SYMBOLS = (process.env.ETF_SYMBOLS || "IBIT,FBTC,ARKB,BITB,HODL").split(",").map((s) => s.trim().toUpperCase());
const MAX_SYMBOLS = Number(process.env.ETF_SYMBOL_LIMIT || 12);
const BASE_FMP = "https://financialmodelingprep.com/api";

const parseSymbols = (query?: string | null) => {
  if (!query) return DEFAULT_SYMBOLS;
  return query
    .split(/[\s,]+/)
    .map((sym) => sym.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);
};

type SeriesPoint = { date: string; value: number };

const getFmpKey = () => process.env.FMP_API_KEY || process.env.VITE_FMP_KEY || process.env.FMP_KEY;

const withFmpKey = (path: string) => {
  const key = getFmpKey();
  if (!key) throw new Error("FMP_API_KEY missing");
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}apikey=${key}`;
};

const toDateKey = (value: number | string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const fetchCoinGeckoSeries = async (id: string, days = 90) => {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const data = await fetchJson(url, { timeoutMs: 6500, retries: 1 });
  const prices = Array.isArray(data?.prices) ? data.prices : [];
  return prices
    .map((entry: any[]) => ({ date: toDateKey(entry?.[0]), value: Number(entry?.[1] ?? 0) }))
    .filter((p) => p.date && Number.isFinite(p.value)) as SeriesPoint[];
};

const fetchFmpPriceSeries = async (symbol: string, days = 90) => {
  const url = withFmpKey(`${BASE_FMP}/v3/historical-price-full/${encodeURIComponent(symbol)}?timeseries=${Math.max(days, 30)}`);
  const data = await fetchJson(url, { timeoutMs: 7500, retries: 1 });
  const rows = Array.isArray(data?.historical) ? data.historical : Array.isArray(data) ? data : [];
  return rows
    .map((row: any) => ({ date: toDateKey(row?.date || row?.dateTime), value: Number(row?.close ?? row?.adjClose ?? row?.price ?? 0) }))
    .filter((p) => p.date && Number.isFinite(p.value)) as SeriesPoint[];
};

const fetchEtfSeries = async (symbol: string) => {
  const history = await fetchHistoricalMarketCap(symbol);
  return history
    .map((row) => ({ date: toDateKey(row.date), value: Number(row.value ?? row.aumUsd ?? 0) }))
    .filter((p) => p.date && Number.isFinite(p.value)) as SeriesPoint[];
};

const pearson = (a: number[], b: number[]) => {
  if (a.length !== b.length || a.length < 3) return null;
  const meanA = a.reduce((acc, v) => acc + v, 0) / a.length;
  const meanB = b.reduce((acc, v) => acc + v, 0) / b.length;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da ** 2;
    denB += db ** 2;
  }
  const denom = Math.sqrt(denA) * Math.sqrt(denB);
  if (!denom) return null;
  return Number((num / denom).toFixed(4));
};

const correlate = (lhs: SeriesPoint[], rhs: SeriesPoint[], window = 30) => {
  const mapA = new Map(lhs.map((p) => [p.date, p.value]));
  const mapB = new Map(rhs.map((p) => [p.date, p.value]));
  const shared = Array.from(mapA.keys())
    .filter((d) => mapB.has(d))
    .sort();
  const slice = shared.slice(-window);
  const aVals = slice.map((d) => mapA.get(d) ?? 0);
  const bVals = slice.map((d) => mapB.get(d) ?? 0);
  return pearson(aVals, bVals);
};

export default async function handler(req: Request) {
  const tracker = createHealthTracker();
  try {
    const { searchParams } = new URL(req.url);
    const symbols = parseSymbols(searchParams.get("symbols"));
    const assets = ["BTC", "ETH", "^GSPC", "XAU"];

    const assetSeries: Record<string, SeriesPoint[]> = {};

    try {
      assetSeries.BTC = await fetchCoinGeckoSeries("bitcoin");
      tracker.set("coingecko:btc", "ok");
    } catch (err: any) {
      tracker.set("coingecko:btc", "warn", err?.message || "coingecko BTC failed");
      assetSeries.BTC = [];
    }

    try {
      assetSeries.ETH = await fetchCoinGeckoSeries("ethereum");
      tracker.set("coingecko:eth", "ok");
    } catch (err: any) {
      tracker.set("coingecko:eth", "warn", err?.message || "coingecko ETH failed");
      assetSeries.ETH = [];
    }

    try {
      assetSeries["^GSPC"] = await fetchFmpPriceSeries("^GSPC");
      tracker.set("fmp:sp500", "ok");
    } catch (err: any) {
      tracker.set("fmp:sp500", "warn", err?.message || "FMP ^GSPC failed");
      assetSeries["^GSPC"] = [];
    }

    try {
      assetSeries.XAU = await fetchCoinGeckoSeries("pax-gold");
      tracker.set("coingecko:gold", "ok");
    } catch (err: any) {
      tracker.set("coingecko:gold", "warn", err?.message || "gold proxy failed");
      assetSeries.XAU = [];
    }

    const data = [];
    for (const symbol of symbols) {
      try {
        const etfSeries = await fetchEtfSeries(symbol);
        tracker.set("ETF_CORR_FMP", etfSeries.length ? "ok" : "warn", etfSeries.length ? "" : "ETF series empty");
        for (const asset of assets) {
          data.push({
            pair: `${symbol}-${asset}`,
            corr7d: correlate(etfSeries, assetSeries[asset] || [], 7),
            corr30d: correlate(etfSeries, assetSeries[asset] || [], 30),
          });
        }
      } catch (err: any) {
        tracker.set("ETF_CORR_FMP", "error", err?.message || "ETF correlation failed");
        for (const asset of assets) {
          data.push({ pair: `${symbol}-${asset}`, corr7d: null, corr30d: null });
        }
      }
    }

    return jsonResponse({
      data,
      health: tracker.toArray(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    tracker.set("etfCorrelations", "error", err?.message || "ETF correlations failed");
    return errorResponse(err?.message || "ETF correlations failed", 502, { health: tracker.toArray() });
  }
}
