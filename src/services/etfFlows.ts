import { safeFetch } from "../lib/safeFetch";

export type AumPoint = { date: string; aum: number };
export type FlowPoint = { date: string; flow: number };

const FMP_BASE = "https://financialmodelingprep.com/api";
const FMP_KEY = import.meta.env.VITE_FMP_KEY || "demo";

type SafeOpts = {
  onHealthUpdate?: (service: string, status: "ok" | "degraded" | "fallback" | "error", message?: string) => void;
  onLog?: (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
  onToast?: (message: string, type?: "warn" | "error" | "info") => void;
};

export async function fetchEtfHoldings(symbol: string, opts: SafeOpts = {}) {
  const data = await safeFetch<{ holdings?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v4/etf-holdings?symbol=${symbol}&apikey=${FMP_KEY}`,
    {
      serviceName: "etfFlows",
      timeoutMs: 9000,
      retries: 1,
      onHealthUpdate: opts.onHealthUpdate,
      onLog: opts.onLog,
      onToast: opts.onToast,
    }
  );
  return Array.isArray(data?.holdings) ? data.holdings : Array.isArray(data) ? data : [];
}

export async function fetchEtfAumHistory(symbol: string, opts: SafeOpts = {}) {
  const data = await safeFetch<{ historical?: any[]; [key: string]: any }>(
    `${FMP_BASE}/v3/historical-market-capitalization/${symbol}?apikey=${FMP_KEY}`,
    {
      serviceName: "etfFlows",
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
