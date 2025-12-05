import { safeFetch } from "../lib/safeFetch";

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

type HealthFn = (key: string, status: string, message?: string) => void;
type ToastFn = (msg: string, type?: string) => void;

type ProxyHealth = { key: string; status: string; message?: string };
type ProxyResponse = { data?: CorrelationPoint[]; health?: ProxyHealth[]; generatedAt?: string; error?: string };

const relayHealth = (entries: ProxyHealth[] | undefined, onHealthUpdate?: HealthFn) => {
  if (!entries?.length || !onHealthUpdate) return;
  for (const entry of entries) {

    onHealthUpdate(entry.key, entry.status, entry.message);
  }
};

export async function fetchEtfCorrelationsLive(onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<CorrelationResult> {
  const response = await safeFetch<ProxyResponse>("/api/etf/correlations", {
    serviceName: "ETF_PROXY_CORR",
    timeoutMs: 15000,
    retries: 0,
    onHealthUpdate,
  });
  relayHealth(response?.health, onHealthUpdate);
  if (response?.error) {
    onToast?.("ETF correlations currently unavailable", "warn");
    return { data: [], lastUpdated: new Date().toISOString(), error: response.error };
  }
  return {
    data: response?.data ?? [],
    lastUpdated: response?.generatedAt || new Date().toISOString(),
  };
}
  let denB = 0;
