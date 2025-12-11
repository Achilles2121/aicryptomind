import { safeFetch, type ApiHealthStatus, type ApiHealthUpdateFn, type ToastFn } from "../lib/safeFetch";
import { apiUrl } from "../lib/http";

export type CorrelationPoint = {
  pair: string;
  corr7d: number | null;
  corr30d: number | null;
};

export type CorrelationResult = {
  data: CorrelationPoint[];
  lastUpdated: string;
  error?: string;
  status?: string;
};

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { ok?: boolean; status?: string; statusCode?: number; source?: string; hint?: string; data?: CorrelationPoint[]; health?: ProxyHealth[]; generatedAt?: string; error?: string; reason?: string };

const isHealthStatus = (val: string): val is ApiHealthStatus => {
  return val === "ok" || val === "warn" || val === "error" || val === "disabled";
};

const relayHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: ApiHealthUpdateFn) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {
    if (!entry?.key || !entry?.status) continue;
    const status = isHealthStatus(entry.status) ? entry.status : "warn";
    onHealthUpdate(entry.key, status, entry.message);
  }
};

export async function fetchEtfCorrelationsLive(onHealthUpdate?: ApiHealthUpdateFn, _onToast?: ToastFn): Promise<CorrelationResult> {
  try {
    const response = await safeFetch<ProxyResponse>(apiUrl("/api/etf/correlations"), {
      serviceName: "ETF_PROXY_CORR",
      timeoutMs: 15000,
      retries: 0,
      uiLevel: "status",
      onHealthUpdate,
    });
    relayHealth(response?.health, onHealthUpdate);
    if (response?.status === "disabled" || response?.statusCode === 503) {
      const msg = response?.hint || "ETF-Korrelationen aktuell nicht verfügbar (konfiguriert als disabled).";
      onHealthUpdate?.("etfCorrelations", "disabled", msg);
      return { data: [], lastUpdated: new Date().toISOString(), error: msg, status: "disabled" };
    }
    if (response?.error || response?.status === "error" || response?.ok === false) {
      const msg = response.error || response.reason || "ETF-Korrelationen aktuell nicht erreichbar.";
      onHealthUpdate?.("etfCorrelations", "error", msg);
      return { data: [], lastUpdated: new Date().toISOString(), error: msg, status: response?.status || "error" };
    }
    const data = response?.data ?? [];
    const status = response?.status || "ok";
    return {
      data,
      lastUpdated: response?.generatedAt || new Date().toISOString(),
      error: status === "disabled" ? "ETF correlation disabled in dev" : undefined,
      status,
    };
  } catch (err: any) {
    const message = err?.message || "ETF correlations fetch failed";
    onHealthUpdate?.("etfCorrelations", "error", message);
    return { data: [], lastUpdated: new Date().toISOString(), error: message };
  }
}
