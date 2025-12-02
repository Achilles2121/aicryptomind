import { safeFetch } from "../lib/safeFetch";

export type LiveFlowPoint = { date: string; netFlowUsd: number; aumUsd?: number | null };
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

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { data?: LiveFlowSeries[]; health?: ProxyHealth[]; error?: string };

const relayHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: HealthFn) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    onHealthUpdate(entry.key, entry.status, entry.message);
  }
};

export async function fetchEtfFlowSeriesLive(symbols: string[], onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<LiveFlowSeries[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const response = await safeFetch<ProxyResponse>(`/api/etf/flows?${params.toString()}`, {
    serviceName: "ETF_PROXY_FLOWS",
    timeoutMs: 12000,
    retries: 0,
    onHealthUpdate,
  });
  relayHealth(response?.health, onHealthUpdate);
  if (response?.error) {
    throw new Error(response.error);
  }
  if (!response?.data) {
    onToast?.("ETF flows currently unavailable", "warn");
    return [];
  }
  return response.data;
}
