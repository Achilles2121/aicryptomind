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

export type SafeOpts = {
  onHealthUpdate?: (service: string, status: ApiHealthStatus, message?: string) => void;
  onLog?: (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
  onToast?: (message: string, type?: "warn" | "error" | "info") => void;
};

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { data?: EtfFlowSeries[]; health?: ProxyHealth[]; error?: string };

const relayProxyHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: SafeOpts["onHealthUpdate"]) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    onHealthUpdate(entry.key, entry.status, entry.message);
  }
};

export async function fetchEtfFlowSeries(symbols: string[], opts: SafeOpts = {}): Promise<EtfFlowSeries[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const url = params.toString() ? `/api/etf/flows?${params.toString()}` : "/api/etf/flows";
  const response = await safeFetch<ProxyResponse>(url, {
    serviceName: "ETF_PROXY_FLOWS",
    timeoutMs: 12000,
    retries: 0,
    onHealthUpdate: opts.onHealthUpdate,
    onLog: opts.onLog,
    onToast: opts.onToast,
  });
  relayProxyHealth(response?.health, opts.onHealthUpdate);
  if (response?.error) throw new Error(response.error);
  const data = Array.isArray(response?.data) ? response.data : [];
  if (!data.length) {
    opts.onToast?.("ETF flows currently unavailable", "warn");
  }
  return data;
}
