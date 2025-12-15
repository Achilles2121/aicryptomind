import { fetchHistoricalMarketCap } from "../_lib/providers/fmp.js";
import { fetchJson } from "../_lib/http.js";
import { createHealthTracker } from "../_lib/health.js";
import { ok, fail, okEnvelope, failEnvelope, sendEnvelope, ApiStatus } from "../utils/apiEnvelope.js";

export const config = { runtime: "edge" };

const isAbortError = (err: unknown) => {
  const message = (err as Error)?.message?.toLowerCase?.() || "";
  return (err as Error)?.name === "AbortError" || message.includes("abort") || message.includes("timeout");
};

const isDisabledFlag = () => process.env.ETF_CORRELATIONS_DISABLED === "true";

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

const fetchStooqSeries = async (symbol: string, days = 120) => {
  const mapped = `${symbol.toLowerCase()}.us`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://stooq.pl/q/d/l/?s=${mapped}&i=d`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/).slice(1);
    const rows = lines
      .map((line) => line.split(","))
      .map((cols) => ({ date: toDateKey(cols[0]), value: Number(cols[4] ?? cols[1] ?? 0) }))
      .filter((p) => p.date && Number.isFinite(p.value));
    return rows.slice(-days);
  } finally {
    clearTimeout(timer);
  }
};

export const fetchEtfSeriesSafe = async (
  symbol: string,
  tracker: ReturnType<typeof createHealthTracker>,
  opts: { forceMock?: boolean } = {}
) => {
  const key = getFmpKey();
  const shouldMock = opts.forceMock || (!key && process.env.NODE_ENV === "test");
  if (shouldMock) {
    tracker.set("ETF_CORR_FMP", "warn", "FMP key missing (mock)");
    return [];
  }
  try {
    const series = await fetchEtfSeries(symbol);
    tracker.set("ETF_CORR_FMP", series.length ? "ok" : "warn", series.length ? "" : "ETF series empty");
    return series;
  } catch (err: any) {
    tracker.set("ETF_CORR_FMP", "degraded", err?.message || "FMP failed, fallback to Stooq");
  }
  try {
    const series = await fetchStooqSeries(symbol);
    tracker.set("ETF_CORR_FALLBACK", series.length ? "warn" : "error", series.length ? "fallback stooq" : "stooq empty");
    return series;
  } catch (err: any) {
    const message = isAbortError(err) ? "Fetch aborted" : err?.message || "fallback failed";
    tracker.set("ETF_CORR_FALLBACK", isAbortError(err) ? "warn" : "error", message);
    return [];
  }
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

const normalizeError = (error: unknown) => {
  const message = (error as Error)?.message || "ETF correlation failed";
  const statusCode = isAbortError(error) ? 504 : 502;
  return {
    ok: false,
    status: statusCode === 504 ? "degraded" : "degraded",
    statusCode,
    message,
    hint: statusCode === 504 ? "Primary correlation fetch was aborted/timeout" : "Provider unavailable",
    source: "etf_correlations",
  };
};

export default async function handler(req: Request) {
  const tracker = createHealthTracker();
  try {
    const devDisabled = process.env.NODE_ENV === "development" && isDisabledFlag();
    const hardDisabled = isDisabledFlag();
    if (devDisabled || hardDisabled) {
      return sendEnvelope(
        fail("disabled", {
          source: "etf_correlations",
          statusCode: 503,
          hint: "etf_correlations_disabled",
          data: [],
          health: tracker.toArray(),
          generatedAt: new Date().toISOString(),
        })
      );
    }

    const { searchParams } = new URL(req.url);
    const symbols = parseSymbols(searchParams.get("symbols"));
    const assets = ["BTC", "ETH", "^GSPC", "XAU"];

    const assetSeries: Record<string, SeriesPoint[]> = {};
    let upstreamStatus: "ok" | "warn" | "error" = "ok";

    try {
      assetSeries.BTC = await fetchCoinGeckoSeries("bitcoin");
      tracker.set("coingecko:btc", "ok");
    } catch (err: any) {
      tracker.set("coingecko:btc", "warn", err?.message || "coingecko BTC failed");
      assetSeries.BTC = [];
      upstreamStatus = "warn";
    }

    try {
      assetSeries.ETH = await fetchCoinGeckoSeries("ethereum");
      tracker.set("coingecko:eth", "ok");
    } catch (err: any) {
      tracker.set("coingecko:eth", "warn", err?.message || "coingecko ETH failed");
      assetSeries.ETH = [];
      upstreamStatus = "warn";
    }

    try {
      assetSeries["^GSPC"] = await fetchFmpPriceSeries("^GSPC");
      tracker.set("fmp:sp500", "ok");
    } catch (err: any) {
      tracker.set("fmp:sp500", "warn", err?.message || "FMP ^GSPC failed");
      assetSeries["^GSPC"] = [];
      upstreamStatus = "warn";
    }

    try {
      assetSeries.XAU = await fetchCoinGeckoSeries("pax-gold");
      tracker.set("coingecko:gold", "ok");
    } catch (err: any) {
      tracker.set("coingecko:gold", "warn", err?.message || "gold proxy failed");
      assetSeries.XAU = [];
      upstreamStatus = "warn";
    }

    const data = [];
    for (const symbol of symbols) {
      try {
        const etfSeries = await fetchEtfSeriesSafe(symbol, tracker);
        for (const asset of assets) {
          data.push({
            pair: `${symbol}-${asset}`,
            corr7d: correlate(etfSeries, assetSeries[asset] || [], 7),
            corr30d: correlate(etfSeries, assetSeries[asset] || [], 30),
          });
        }
      } catch (err: any) {
        const normalized = normalizeError(err);
        tracker.set("ETF_CORR_FMP", "warn", normalized.message || "ETF correlation failed");
        upstreamStatus = normalized.status === "degraded" ? "warn" : "warn";
        for (const asset of assets) {
          data.push({ pair: `${symbol}-${asset}`, corr7d: null, corr30d: null });
        }
      }
    }

    const status: "ok" | "warn" | "degraded" = upstreamStatus === "error" ? "degraded" : upstreamStatus;
    return sendEnvelope(
      ok(data, {
        source: "etf_correlations",
        status: status === "warn" ? "degraded" : status,
        statusCode: upstreamStatus === "error" ? 502 : 200,
        hint: upstreamStatus === "error" ? "upstream_error" : undefined,
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      })
    );
  } catch (err: any) {
    const normalized = normalizeError(err);
    console.error("[etf_correlations] handler error", {
      message: err?.message,
      stack: err?.stack,
    });
    tracker.set(
      "etfCorrelations",
      normalized.status === "degraded" ? "warn" : "error",
      normalized.message || "ETF correlations failed"
    );
    return sendEnvelope(
      fail("degraded", {
        source: "etf_correlations",
        statusCode: normalized.statusCode,
        message: normalized.message,
        hint: normalized.hint || "runtime_error",
        data: [],
        errors: [normalized.message],
        health: tracker.toArray(),
        generatedAt: new Date().toISOString(),
      })
    );
  }
}
