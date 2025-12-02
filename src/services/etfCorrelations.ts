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

export async function fetchEtfCorrelations(): Promise<CorrelationResult> {
  try {
    const res = await safeFetch<{ data?: CorrelationPoint[]; generatedAt?: string; error?: string }>("/api/etf/correlations", {
      serviceName: "ETF_CORR_PRIMARY",
      timeoutMs: 10000,
      retries: 1,
    });
    if ((res as any)?.error) {
      return { data: [], lastUpdated: res?.generatedAt || new Date().toISOString(), error: (res as any).error };
    }
    const data = Array.isArray(res?.data) ? res.data : [];
    return {
      data,
      lastUpdated: res?.generatedAt || new Date().toISOString(),
    };
  } catch (err: any) {
    return { data: [], lastUpdated: new Date().toISOString(), error: err?.message || "correlation failed" };
  }
}

export default fetchEtfCorrelations;
