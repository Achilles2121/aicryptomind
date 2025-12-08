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
};

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { status?: string; data?: CorrelationPoint[]; health?: ProxyHealth[]; generatedAt?: string; error?: string; reason?: string };

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

export async function fetchEtfCorrelationsLive(onHealthUpdate?: ApiHealthUpdateFn, onToast?: ToastFn): Promise<CorrelationResult> {
  try {
    const response = await safeFetch<ProxyResponse>(apiUrl("/api/etf/correlations"), {
      serviceName: "ETF_PROXY_CORR",
      timeoutMs: 15000,
      retries: 0,
      onHealthUpdate,
    });
    relayHealth(response?.health, onHealthUpdate);
    if (response?.error || response?.status === "error") {
      const msg = response.error || response.reason || "ETF-Korrelationen aktuell nicht erreichbar.";
      onToast?.("ETF-Korrelationen aktuell nicht erreichbar (API-Fehler).", "warn");
      onHealthUpdate?.("etfCorrelations", "error", msg);
      return { data: [], lastUpdated: new Date().toISOString(), error: msg };
    }
    const data = response?.data ?? [];
    const status = response?.status || "ok";
    return {
      data,
      lastUpdated: response?.generatedAt || new Date().toISOString(),
      error: status === "disabled" ? "ETF correlation disabled in dev" : undefined,
    };
  } catch (err: any) {
    const message = err?.message || "ETF correlations fetch failed";
    onToast?.("ETF-Korrelationen aktuell nicht erreichbar (API-Fehler).", "warn");
    onHealthUpdate?.("etfCorrelations", "error", message);
    return { data: [], lastUpdated: new Date().toISOString(), error: message };
  }
}
