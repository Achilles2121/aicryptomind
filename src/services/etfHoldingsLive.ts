import { safeFetch } from "../lib/safeFetch";

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

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { data?: LiveHolding[]; health?: ProxyHealth[]; error?: string };

const relayHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: HealthFn) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    onHealthUpdate(entry.key, entry.status, entry.message);
  }
};

export async function fetchEtfHoldingsLive(symbols: string[], onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<LiveHolding[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const response = await safeFetch<ProxyResponse>(`/api/etf/holdings?${params.toString()}`, {
    serviceName: "ETF_PROXY_HOLDINGS",
    timeoutMs: 12000,
    retries: 0,
    onHealthUpdate,
  });
  relayHealth(response?.health, onHealthUpdate);
  if (response?.error) {
    throw new Error(response.error);
  }
  if (!response?.data) {
    onToast?.("ETF holdings currently unavailable", "warn");
    return [];
  }
  return response.data;
}
