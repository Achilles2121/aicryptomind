import { safeFetch, type ApiHealthStatus, type ApiHealthUpdateFn, type ToastFn, type ToastType } from "../lib/safeFetch";
import { apiUrl } from "../lib/http";

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
  onHealthUpdate?: ApiHealthUpdateFn;
  onLog?: (source: string, level: ToastType, message?: string, meta?: Record<string, unknown>) => void;
  onToast?: ToastFn;
};

type ProxyHealth = { key: string; status: ApiHealthStatus | string; message?: string };
type ProxyResponse = { data?: EtfFlowSeries[]; health?: ProxyHealth[]; error?: string };

const isHealthStatus = (val: string): val is ApiHealthStatus => {
  return val === "ok" || val === "warn" || val === "error" || val === "disabled";
};

const relayProxyHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: SafeOpts["onHealthUpdate"]) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    const status = typeof entry.status === "string" && isHealthStatus(entry.status) ? entry.status : "warn";
    onHealthUpdate(entry.key, status, entry.message);
  }
};

export async function fetchEtfFlowSeries(symbols: string[], opts: SafeOpts = {}): Promise<EtfFlowSeries[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const url = params.toString() ? `/api/etf/flows?${params.toString()}` : "/api/etf/flows";
  try {
    const response = await safeFetch<ProxyResponse>(apiUrl(url), {
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
      opts.onToast?.("ETF-Flows aktuell nicht erreichbar (API-Fehler).", "warn");
    }
    return data;
  } catch (err: any) {
    const message = err?.message || "ETF flows fetch failed";
    opts.onToast?.("ETF-Flows aktuell nicht erreichbar (API-Fehler).", "warn");
    opts.onHealthUpdate?.("etfFlows", "error", message);
    return [];
  }
}
