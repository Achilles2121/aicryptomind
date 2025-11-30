import { safeFetch } from "../lib/safeFetch";

export type LiveFlowPoint = { date: string; netFlowUsd: number; aumUsd?: number };
export type LiveFlowSeries = {
  symbol: string;
  points: LiveFlowPoint[];
  sum7dUsd: number;
  sum30dUsd: number;
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

const fillMissing = (points: LiveFlowPoint[], days = 30) => {
  const map = new Map<string, LiveFlowPoint>();
  points.forEach((p) => map.set(dateKey(p.date), { ...p, date: dateKey(p.date) }));
  return lastNDates(days).map((d) => map.get(d) || { date: d, netFlowUsd: 0 });
};

const sumRange = (points: LiveFlowPoint[], days: number) => points.slice(-days).reduce((acc, p) => acc + (Number.isFinite(p.netFlowUsd) ? p.netFlowUsd : 0), 0);

async function fetchFmpAum(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveFlowPoint[]> {
  if (!FMP_KEY) {
    onHealthUpdate?.("ETF_FLOWS_FMP", "degraded", "FMP key missing");
    throw new Error("FMP key missing");
  }
  const data = await safeFetch<{ historical?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v3/historical-market-capitalization/${symbol}?apikey=${FMP_KEY}`,
    { serviceName: "ETF_FLOWS_FMP", timeoutMs: 4000, retries: 2, onHealthUpdate }
  );
  const list = Array.isArray(data?.historical) ? data.historical : Array.isArray(data) ? data : [];
  onHealthUpdate?.("ETF_FLOWS_FMP", "healthy");
  return list
    .map((row: any) => ({
      date: row.date || row.dateTime || row.timestamp || row.calendarDate,
      aumUsd: Number(row.marketCap || row.aum || row.value || row.nav) || 0,
    }))
    .filter((p: any) => p.date)
    .map((p: any) => ({ date: p.date, netFlowUsd: 0, aumUsd: p.aumUsd }));
}

async function fetchSosoFlows(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveFlowPoint[]> {
  const data = await safeFetch<{ data?: { items?: any[] } }>(`${SOSO_BASE}/etf/flow`, {
    serviceName: "ETF_FLOWS_SOSO",
    timeoutMs: 4000,
    retries: 2,
    onHealthUpdate,
  });
  const items = (data as any)?.data?.items || (data as any)?.data || [];
  onHealthUpdate?.("ETF_FLOWS_SOSO", "healthy");
  return items
    .filter((it: any) => (it.code || it.symbol || it.ticker || "").toString().toUpperCase().includes(symbol.toUpperCase()))
    .map((m: any) => ({
      date: m.date || m.time || new Date().toISOString().slice(0, 10),
      netFlowUsd: Number(m.net_inflow || m.inflow || m.net || m.value || 0),
      aumUsd: Number(m.aum || m.nav || 0) || undefined,
    }));
}

async function fetchCoinstatsFlows(symbol: string, onHealthUpdate?: HealthFn): Promise<LiveFlowPoint[]> {
  const data = await safeFetch<{ data?: any[]; items?: any[] }>(`${COINSTATS_BASE}/etf/flows`, {
    serviceName: "ETF_FLOWS_COINSTATS",
    timeoutMs: 4000,
    retries: 2,
    onHealthUpdate,
  });
  const items = (data as any)?.data || (data as any)?.items || [];
  onHealthUpdate?.("ETF_FLOWS_COINSTATS", "healthy");
  return items
    .filter((it: any) => (it.symbol || it.ticker || "").toString().toUpperCase().includes(symbol.toUpperCase()))
    .map((row: any) => ({
      date: row.date || row.time || new Date().toISOString().slice(0, 10),
      netFlowUsd: Number(row.net || row.inflow || row.value || 0),
      aumUsd: Number(row.aum || row.nav || 0) || undefined,
    }));
}

const computeFlowsFromAum = (aumSeries: LiveFlowPoint[]) => {
  const sorted = [...aumSeries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const flows: LiveFlowPoint[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const net = (curr.aumUsd ?? 0) - (prev.aumUsd ?? 0);
    flows.push({ date: curr.date, netFlowUsd: net, aumUsd: curr.aumUsd });
  }
  return flows;
};

async function loadSeries(symbol: string, onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<{ points: LiveFlowPoint[]; provider: string }> {
  try {
    const aum = await fetchFmpAum(symbol, onHealthUpdate);
    const flows = computeFlowsFromAum(aum);
    return { points: flows, provider: "FMP" };
  } catch (err: any) {
    onHealthUpdate?.("ETF_FLOWS_FMP", "degraded", err?.message);
    onToast?.(`ETF Flows: FMP Fallback aktiv (${symbol})`, "warn");
    try {
      const soso = await fetchSosoFlows(symbol, onHealthUpdate);
      return { points: soso, provider: "SosoValue" };
    } catch (err2: any) {
      onHealthUpdate?.("ETF_FLOWS_SOSO", "degraded", err2?.message);
      onToast?.(`ETF Flows: SosoValue Fallback aktiv (${symbol})`, "warn");
      try {
        const cs = await fetchCoinstatsFlows(symbol, onHealthUpdate);
        return { points: cs, provider: "CoinStats" };
      } catch (err3: any) {
        onHealthUpdate?.("ETF_FLOWS_COINSTATS", "degraded", err3?.message);
        onToast?.(`ETF Flows: Daten derzeit nicht verfügbar (${symbol})`, "warn");
        return { points: [], provider: "unavailable" };
      }
    }
  }
}

export async function fetchEtfFlowSeriesLive(symbols: string[], onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<LiveFlowSeries[]> {
  const results: LiveFlowSeries[] = [];
  for (const sym of symbols) {
    const { points, provider } = await loadSeries(sym, onHealthUpdate, onToast);
    const normalized = fillMissing(points, 30);
    const now = new Date().toISOString();
    results.push({
      symbol: sym,
      points: normalized,
      sum7dUsd: sumRange(normalized, 7),
      sum30dUsd: sumRange(normalized, 30),
      provider,
      lastUpdated: now,
    });
  }
  return results;
}
