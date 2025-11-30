import { safeFetch } from "../lib/safeFetch";

export type ApiHealthStatus = "ok" | "degraded" | "fallback" | "error";

export type EtfFlowPoint = { date: string; netFlowUsd: number; aumUsd?: number; volumeUsd?: number };
export type EtfFlowSeries = {
  symbol: string;
  points: EtfFlowPoint[];
  sum7dUsd: number;
  sum30dUsd: number;
  provider: string;
  lastUpdated: string;
};

export type AumPoint = { date: string; aum: number };
export type FlowPoint = { date: string; flow: number };

const FMP_BASE = "https://financialmodelingprep.com/api";
const FMP_KEY = import.meta.env.VITE_FMP_KEY;
const SOSO_BASE = "https://sosovalue.com/api/v1";

export type SafeOpts = {
  onHealthUpdate?: (service: string, status: ApiHealthStatus, message?: string) => void;
  onLog?: (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
  onToast?: (message: string, type?: "warn" | "error" | "info") => void;
};

const sumRange = (points: EtfFlowPoint[], days: number) => points.slice(-days).reduce((acc, p) => acc + (Number.isFinite(p.netFlowUsd) ? p.netFlowUsd : 0), 0);
const dateKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const lastNDates = (n: number) => {
  const list: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    list.push(d.toISOString().slice(0, 10));
  }
  return list;
};

const fillMissingPoints = (points: EtfFlowPoint[], days = 30) => {
  const map = new Map<string, EtfFlowPoint>();
  points.forEach((p) => map.set(dateKey(p.date), { ...p, date: dateKey(p.date) }));
  return lastNDates(days).map((d) => map.get(d) || { date: d, netFlowUsd: 0 });
};

export async function fetchEtfHoldings(symbol: string, opts: SafeOpts = {}) {
  if (!FMP_KEY) {
    opts.onHealthUpdate?.("etfFlowsFmp", "degraded", "FMP key missing");
    return [];
  }
  const data = await safeFetch<{ holdings?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v4/etf-holdings?symbol=${symbol}&apikey=${FMP_KEY}`,
    {
      serviceName: "etfFlowsFmp",
      timeoutMs: 9000,
      retries: 1,
      onHealthUpdate: opts.onHealthUpdate,
      onLog: opts.onLog,
      onToast: opts.onToast,
    }
  );
  return Array.isArray(data?.holdings) ? data.holdings : Array.isArray(data) ? data : [];
}

async function fetchFmpAumHistory(symbol: string, opts: SafeOpts = {}) {
  if (!FMP_KEY) {
    opts.onHealthUpdate?.("etfFlowsFmp", "degraded", "FMP key missing");
    throw new Error("FMP key missing");
  }
  const data = await safeFetch<{ historical?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v3/historical-market-capitalization/${symbol}?apikey=${FMP_KEY}`,
    {
      serviceName: "etfFlowsFmp",
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
      aum: Number(row.marketCap || row.aum || row.value || row.nav) || 0,
    }))
    .filter((p) => p.date && Number.isFinite(p.aum));
}

async function fetchSosoFlows(symbol: string, opts: SafeOpts = {}) {
  // SosoValue provides aggregated ETF flows; we'll pick entries matching the symbol and build latest point(s)
  const data = await safeFetch<{ data?: { items?: any[] } }>(`${SOSO_BASE}/etf/flow`, {
    serviceName: "etfFlowsSoso",
    timeoutMs: 8000,
    retries: 1,
    onHealthUpdate: opts.onHealthUpdate,
    onLog: opts.onLog,
    onToast: opts.onToast,
  });
  const items = (data as any)?.data?.items || (data as any)?.data || (Array.isArray((data as any)?.items) ? (data as any).items : []);
  const match = (items || []).filter((it: any) => {
    const code = (it.code || it.symbol || it.ticker || it.name || "").toString().toUpperCase();
    return code.includes(symbol.toUpperCase());
  });
  return match.map((m: any) => ({
    date: m.date || m.time || new Date().toISOString().slice(0, 10),
    netFlowUsd: Number(m.net_inflow || m.inflow || m.net || m.value || 0),
    aumUsd: Number(m.aum || m.nav || 0) || undefined,
  }));
}

export function computeDailyFlows(aumHistory: AumPoint[]): FlowPoint[] {
  if (!Array.isArray(aumHistory) || !aumHistory.length) return [];
  const sorted = [...aumHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const flows: FlowPoint[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    flows.push({
      date: curr.date,
      flow: Number(curr.aum) - Number(prev.aum),
    });
  }
  return flows;
}

async function buildSeriesFromFmp(symbol: string, opts: SafeOpts): Promise<EtfFlowSeries> {
  const history = await fetchFmpAumHistory(symbol, opts);
  const flows = computeDailyFlows(history).slice(-30);
  const points: EtfFlowPoint[] = flows.map((f) => ({
    date: dateKey(f.date),
    netFlowUsd: f.flow,
  }));
  const normalized = fillMissingPoints(points, 30);
  const now = new Date().toISOString();
  return {
    symbol,
    points: normalized,
    sum7dUsd: sumRange(normalized, 7),
    sum30dUsd: sumRange(normalized, 30),
    provider: "FMP",
    lastUpdated: now,
  };
}

async function buildSeriesFromSoso(symbol: string, opts: SafeOpts): Promise<EtfFlowSeries> {
  const rows = await fetchSosoFlows(symbol, opts);
  const points: EtfFlowPoint[] = rows.slice(-30).map((r) => ({
    date: dateKey(r.date),
    netFlowUsd: Number(r.netFlowUsd || r.netFlow || r.netflow || r.flow || 0),
    aumUsd: r.aumUsd,
  }));
  const normalized = fillMissingPoints(points, 30);
  const now = new Date().toISOString();
  return {
    symbol,
    points: normalized,
    sum7dUsd: sumRange(normalized, 7),
    sum30dUsd: sumRange(normalized, 30),
    provider: "SosoValue",
    lastUpdated: now,
  };
}

export async function fetchEtfFlowSeries(symbols: string[], opts: SafeOpts = {}): Promise<EtfFlowSeries[]> {
  const results: EtfFlowSeries[] = [];
  for (const symbol of symbols) {
    let series: EtfFlowSeries | null = null;
    try {
      series = await buildSeriesFromFmp(symbol, opts);
      opts.onHealthUpdate?.("etfFlowsFmp", "ok");
    } catch (err: any) {
      opts.onHealthUpdate?.("etfFlowsFmp", "degraded", err?.message);
      opts.onToast?.(`ETF ${symbol}: FMP ausgefallen, versuche Fallback`, "warn");
      try {
        series = await buildSeriesFromSoso(symbol, opts);
        opts.onHealthUpdate?.("etfFlowsSoso", "ok");
      } catch (err2: any) {
        opts.onHealthUpdate?.("etfFlowsSoso", "error", err2?.message);
        opts.onToast?.(`ETF ${symbol}: Daten derzeit nicht verfügbar`, "warn");
        series = null;
      }
    }
    if (series) {
      results.push({
        ...series,
        points: series.points.slice(-30),
        sum7dUsd: sumRange(series.points, 7),
        sum30dUsd: sumRange(series.points, 30),
      });
    }
  }
  return results;
}
