import { safeFetch } from "../lib/safeFetch";

export type LiveHoldingPoint = { date: string; aumUsd: number; shares?: number | null };

export type LiveHolding = {
  symbol: string;
  aumUsd: number | null;
  shares: number | null;
  change7d: number | null;
  change30d: number | null;
  marketShare: number | null;
  provider: string;
  lastUpdated: string;
};

type HealthFn = (service: string, status: string, message?: string) => void;
type ToastFn = (message: string, type?: string) => void;

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

const fillSeries = (points: LiveHoldingPoint[], days = 30) => {
  const map = new Map<string, LiveHoldingPoint>();
  points.forEach((p) => map.set(dateKey(p.date), { ...p, date: dateKey(p.date) }));
  return lastNDates(days).map((d) => map.get(d) || { date: d, aumUsd: 0, shares: null });
};

const computeChange = (series: LiveHoldingPoint[], window: number) => {
  if (!series.length) return null;
  const sorted = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last = sorted.at(-1)?.aumUsd ?? null;
  const past = sorted.at(-Math.min(window, sorted.length))?.aumUsd ?? null;
  if (last === null || past === null) return null;
  return last - past;
};

async function fetchFmp(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveHoldingPoint[]> {
  if (!FMP_KEY) {
    onHealthUpdate?.("ETF_HOLDINGS_FMP", "degraded", "FMP key missing");
    throw new Error("FMP key missing");
  }
  const data = await safeFetch<{ historical?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v3/historical-market-capitalization/${symbol}?apikey=${FMP_KEY}`,
    { serviceName: "ETF_HOLDINGS_FMP", timeoutMs: 4000, retries: 2, onHealthUpdate }
  );
  const list = Array.isArray(data?.historical) ? data.historical : Array.isArray(data) ? data : [];
  onHealthUpdate?.("ETF_HOLDINGS_FMP", "healthy");
  return list
    .map((row: any) => ({
      date: row.date || row.dateTime || row.timestamp || row.calendarDate,
      aumUsd: Number(row.marketCap || row.aum || row.value || row.nav) || 0,
      shares: null,
    }))
    .filter((p: LiveHoldingPoint) => p.date);
}

async function fetchSoso(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveHoldingPoint[]> {
  const data = await safeFetch<{ data?: { items?: any[] } }>(`${SOSO_BASE}/etf/flow`, {
    serviceName: "ETF_HOLDINGS_SOSO",
    timeoutMs: 4000,
    retries: 2,
    onHealthUpdate,
  });
  const items = (data as any)?.data?.items || (data as any)?.data || [];
  const filtered = (items || []).filter((it: any) => {
    const code = (it.code || it.symbol || it.ticker || "").toString().toUpperCase();
    return code.includes(symbol.toUpperCase());
  });
  onHealthUpdate?.("ETF_HOLDINGS_SOSO", "healthy");
  return filtered
    .map((row: any) => ({
      date: row.date || row.time || row.update || new Date().toISOString(),
      aumUsd: Number(row.aum || row.nav || row.market_cap || row.marketCap || row.value || 0),
      shares: Number(row.share || row.shares || row.qty || 0) || null,
    }))
    .filter((p: LiveHoldingPoint) => p.date);
}

async function fetchCoinstats(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveHoldingPoint[]> {
  const data = await safeFetch<{ data?: any[]; items?: any[] }>(`${COINSTATS_BASE}/etf/flows`, {
    serviceName: "ETF_HOLDINGS_COINSTATS",
    timeoutMs: 4000,
    retries: 2,
    onHealthUpdate,
  });
  const items = (data as any)?.data || (data as any)?.items || [];
  const filtered = (items || []).filter((it: any) => (it.symbol || it.ticker || "").toString().toUpperCase().includes(symbol.toUpperCase()));
  onHealthUpdate?.("ETF_HOLDINGS_COINSTATS", "healthy");
  return filtered
    .map((row: any) => ({
      date: row.date || row.time || new Date().toISOString(),
      aumUsd: Number(row.aum || row.nav || row.value || row.flow || 0),
      shares: Number(row.share || row.shares || row.qty || 0) || null,
    }))
    .filter((p: LiveHoldingPoint) => p.date);
}

async function loadSeries(symbol: string, onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<{ points: LiveHoldingPoint[]; provider: string }> {
  try {
    const res = await fetchFmp(symbol, onHealthUpdate);
    return { points: res, provider: "FMP" };
  } catch (err: any) {
    onHealthUpdate?.("ETF_HOLDINGS_FMP", "degraded", err?.message);
    onToast?.(`ETF Holdings: FMP Fallback aktiv (${symbol})`, "warn");
    try {
      const res = await fetchSoso(symbol, onHealthUpdate);
      return { points: res, provider: "SosoValue" };
    } catch (err2: any) {
      onHealthUpdate?.("ETF_HOLDINGS_SOSO", "degraded", err2?.message);
      onToast?.(`ETF Holdings: SosoValue Fallback aktiv (${symbol})`, "warn");
      try {
        const res = await fetchCoinstats(symbol, onHealthUpdate);
        return { points: res, provider: "CoinStats" };
      } catch (err3: any) {
        onHealthUpdate?.("ETF_HOLDINGS_COINSTATS", "degraded", err3?.message);
        onToast?.(`ETF Holdings: Daten derzeit nicht verfügbar (${symbol})`, "warn");
        return { points: [], provider: "unavailable" };
      }
    }
  }
}

export async function fetchEtfHoldingsLive(symbols: string[], onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<LiveHolding[]> {
  const results: LiveHolding[] = [];
  for (const sym of symbols) {
    const { points, provider } = await loadSeries(sym, onHealthUpdate, onToast);
    const normalized = fillSeries(points, 30);
    const aumUsd = normalized.at(-1)?.aumUsd ?? null;
    const change7d = computeChange(normalized, 7);
    const change30d = computeChange(normalized, 30);
    const shares = normalized.at(-1)?.shares ?? null;
    results.push({
      symbol: sym,
      aumUsd,
      shares,
      change7d,
      change30d,
      marketShare: null,
      provider,
      lastUpdated: new Date().toISOString(),
    });
  }
  const totalAum = results.reduce((acc, h) => acc + (Number.isFinite(h.aumUsd ?? null) ? (h.aumUsd as number) : 0), 0);
  return results.map((h) => ({
    ...h,
    marketShare: totalAum > 0 && h.aumUsd ? (h.aumUsd / totalAum) * 100 : null,
  }));
}
