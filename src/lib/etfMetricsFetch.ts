import { safeFetch } from "./safeFetch";
import { recordError, recordSuccess } from "../stores/etfProviderMetrics";

export async function etfMetricsFetch<T>(provider: any, url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T | null> {
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    const res = await safeFetch<T>(url, init as any);
    const latency = (typeof performance !== "undefined" ? performance.now() : Date.now()) - start;
    recordSuccess(provider, latency);
    return res;
  } catch (err) {
    recordError(provider);
    return null;
  }
}
