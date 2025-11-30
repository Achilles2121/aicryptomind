import { safeFetch } from "../lib/safeFetch";

export type ApiHealthStatus = "ok" | "degraded" | "fallback" | "error";

export type EtfHoldingPoint = {
  date: string;
  aumUsd: number;
};

export type EtfHolding = {
  symbol: string;
  shares: number | null;
  aumUsd: number | null;
  change7d: number | null;
  change30d: number | null;
  marketShare: number | null;
  lastUpdated: string;
  provider: string;
};

export type SafeOpts = {
  onHealthUpdate?: (service: string, status: ApiHealthStatus, message?: string) => void;
  onLog?: (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
  onToast?: (message: string, type?: "warn" | "error" | "info") => void;
};

const FMP_BASE = "https://financialmodelingprep.com/api";
const FMP_KEY = import.meta.env.VITE_FMP_KEY;
const SOSO_BASE = "https://sosovalue.com/api/v1";
const COINSTATS_BASE = "https://api.coinstats.app/public/v1";

const dateKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const lastNDates = (n: number) => {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const fillSeries = (points: EtfHoldingPoint[], days = 30): EtfHoldingPoint[] => {
  const map = new Map<string, EtfHoldingPoint>();
  points.forEach((p) => map.set(dateKey(p.date), { ...p, date: dateKey(p.date) }));
  return lastNDates(days).map((d) => map.get(d) || { date: d, aumUsd: 0 });
};

const computeChange = (series: EtfHoldingPoint[], window: number) => {
  if (!series.length) return null;
  const sorted = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last = sorted.at(-1)?.aumUsd ?? null;
  const past = sorted.at(-Math.min(window, sorted.length))?.aumUsd ?? null;
  if (last === null || past === null) return null;
  return last - past;
};

async function fetchFmpSeries(symbol: string, opts: SafeOpts): Promise<EtfHoldingPoint[]> {
  if (!FMP_KEY) {
    opts.onHealthUpdate?.("etfHoldingsFmp", "degraded", "FMP key missing");
    throw new Error("FMP key missing");
  }
  const data = await safeFetch<{ historical?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v3/historical-market-capitalization/${symbol}?apikey=${FMP_KEY}`,
    {
      serviceName: "etfHoldingsFmp",
      timeoutMs: 9000,
      retries: 1,
      onHealthUpdate: opts.onHealthUpdate,
      onLog: opts.onLog,
      onToast: opts.onToast,
    }
  );
  const list = Array.isArray(data?.historical) ? data.historical : Array.isArray(data) ? data : [];
  return list
    .map((row) => ({
      date: row.date || row.dateTime || row.timestamp || row.calendarDate,
      aumUsd: Number(row.marketCap || row.aum || row.value || row.nav) || 0,
    }))
    .filter((p) => p.date);
}

async function fetchSosoSeries(symbol: string, opts: SafeOpts): Promise<EtfHoldingPoint[]> {
  const data = await safeFetch<{ data?: { items?: any[] } }>(`${SOSO_BASE}/etf/flow`, {
    serviceName: "etfHoldingsSoso",
    timeoutMs: 8000,
    retries: 1,
    onHealthUpdate: opts.onHealthUpdate,
    onLog: opts.onLog,
    onToast: opts.onToast,
  });
  const items = (data as any)?.data?.items || (data as any)?.data || [];
  const filtered = (items || []).filter((it: any) => {
    const code = (it.code || it.symbol || it.ticker || "").toString().toUpperCase();
    return code.includes(symbol.toUpperCase());
  });
  return filtered
    .map((row: any) => ({
      date: row.date || row.time || row.update || new Date().toISOString(),
      aumUsd: Number(row.aum || row.nav || row.market_cap || row.marketCap || row.value || 0),
    }))
    .filter((p) => p.date);
}

async function fetchCoinstatsSeries(symbol: string, opts: SafeOpts): Promise<EtfHoldingPoint[]> {
  const data = await safeFetch<{ news?: any[]; data?: any }>(`${COINSTATS_BASE}/etf/flows`, {
    serviceName: "etfHoldingsCoinstats",
    timeoutMs: 8000,
    retries: 1,
    onHealthUpdate: opts.onHealthUpdate,
    onLog: opts.onLog,
    onToast: opts.onToast,
  });
  const items = (data as any)?.data || (data as any)?.items || [];
  const filtered = (items || []).filter((it: any) => (it.symbol || it.ticker || "").toString().toUpperCase().includes(symbol.toUpperCase()));
  return filtered
    .map((row: any) => ({
      date: row.date || row.time || new Date().toISOString(),
      aumUsd: Number(row.aum || row.nav || row.value || row.flow || 0),
    }))
    .filter((p) => p.date);
}

async function buildFromSeries(symbol: string, series: EtfHoldingPoint[], provider: string): Promise<EtfHolding> {
  const normalized = fillSeries(series, 30);
  const latest = normalized.at(-1)?.aumUsd ?? null;
  return {
    symbol,
    shares: null,
    aumUsd: latest,
    change7d: computeChange(normalized, 7),
    change30d: computeChange(normalized, 30),
    marketShare: null, // will be filled later
    lastUpdated: new Date().toISOString(),
    provider,
  };
}

export async function fetchEtfHoldings(symbols: string[], opts: SafeOpts = {}): Promise<EtfHolding[]> {
  const results: EtfHolding[] = [];
  for (const symbol of symbols) {
    let series: EtfHoldingPoint[] = [];
    let provider = "FMP";
    try {
      series = await fetchFmpSeries(symbol, opts);
      opts.onHealthUpdate?.("etfHoldingsFmp", "ok");
    } catch (err: any) {
      opts.onHealthUpdate?.("etfHoldingsFmp", "degraded", err?.message);
      opts.onToast?.(`ETF ${symbol}: FMP nicht verfügbar, Fallback aktiv`, "warn");
      try {
        series = await fetchSosoSeries(symbol, opts);
        provider = "SosoValue";
        opts.onHealthUpdate?.("etfHoldingsSoso", "ok");
      } catch (err2: any) {
        opts.onHealthUpdate?.("etfHoldingsSoso", "degraded", err2?.message);
        opts.onToast?.(`ETF ${symbol}: Zweiter Fallback aktiv`, "warn");
        try {
          series = await fetchCoinstatsSeries(symbol, opts);
          provider = "CoinStats";
          opts.onHealthUpdate?.("etfHoldingsCoinstats", "ok");
        } catch (err3: any) {
          opts.onHealthUpdate?.("etfHoldingsCoinstats", "error", err3?.message);
          opts.onToast?.(`ETF ${symbol}: Daten derzeit nicht verfügbar`, "warn");
          series = [];
          provider = "unavailable";
        }
      }
    }
    const holding = await buildFromSeries(symbol, series, provider);
    results.push(holding);
  }
  // compute market share
  const totalAum = results.reduce((acc, h) => acc + (Number.isFinite(h.aumUsd ?? null) ? (h.aumUsd as number) : 0), 0);
  return results.map((h) => ({
    ...h,
    marketShare: totalAum > 0 && h.aumUsd ? (h.aumUsd / totalAum) * 100 : null,
  }));
}
