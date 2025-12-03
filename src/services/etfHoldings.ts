import { safeFetch, type ApiHealthStatus } from "../lib/safeFetch";

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

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { ok?: boolean; data?: EtfHolding[]; health?: ProxyHealth[]; error?: string; status?: number };

const relayProxyHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: SafeOpts["onHealthUpdate"]) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    onHealthUpdate(entry.key, entry.status as ApiHealthStatus, entry.message);
  }
};

export async function fetchEtfHoldings(symbols: string[], opts: SafeOpts = {}): Promise<EtfHolding[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const url = params.toString() ? `/api/etf/holdings?${params.toString()}` : "/api/etf/holdings";
  const response = await safeFetch<ProxyResponse>(url, {
    serviceName: "ETF_PROXY_HOLDINGS",
    timeoutMs: 12000,
    retries: 0,
    onHealthUpdate: opts.onHealthUpdate,
    onLog: opts.onLog,
    onToast: opts.onToast,
  });
  relayProxyHealth(response?.health, opts.onHealthUpdate);
  if (response?.ok === false || response?.error) throw new Error(response?.error || "holdings_unavailable");
  const data = Array.isArray(response?.data) ? response.data : [];
  if (!data.length) {
    opts.onToast?.("ETF holdings currently unavailable", "warn");
  }
  return data;
}
