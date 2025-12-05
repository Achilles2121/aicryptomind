import { safeFetch, type ApiHealthStatus, type ApiHealthUpdateFn, type ToastFn, type ToastType } from "../lib/safeFetch";
import { apiUrl } from "../lib/http";

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
  onHealthUpdate?: ApiHealthUpdateFn;
  onLog?: (source: string, level: ToastType, message?: string, meta?: Record<string, unknown>) => void;
  onToast?: ToastFn;
};

type ProxyHealth = { key: string; status: ApiHealthStatus | string; message?: string };
type ProxyResponse = { data?: EtfHolding[]; health?: ProxyHealth[]; error?: string };

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

export async function fetchEtfHoldings(symbols: string[], opts: SafeOpts = {}): Promise<EtfHolding[]> {
  const params = new URLSearchParams();
  if (symbols?.length) params.set("symbols", symbols.join(","));
  const url = params.toString() ? `/api/etf/holdings?${params.toString()}` : "/api/etf/holdings";
  try {
    const response = await safeFetch<ProxyResponse>(apiUrl(url), {
      serviceName: "ETF_PROXY_HOLDINGS",
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
      opts.onToast?.("ETF-Holdings aktuell nicht erreichbar (API-Fehler).", "warn");
    }
    return data;
  } catch (err: any) {
    const message = err?.message || "ETF holdings fetch failed";
    opts.onToast?.("ETF-Holdings aktuell nicht erreichbar (API-Fehler).", "warn");
    opts.onHealthUpdate?.("etfHoldings", "error", message);
    return [];
  }
}
