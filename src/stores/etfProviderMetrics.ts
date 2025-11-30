export type EtfProviderKey = "fmp" | "sosovalue" | "coinstats";

export interface EtfProviderMetric {
  provider: EtfProviderKey;
  status: "healthy" | "degraded" | "error";
  latencyMs: number;
  successRate: number;
  fallbackCount: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  requestCount: number;
  successCount: number;
}

type Listener = () => void;

const defaults: Record<EtfProviderKey, EtfProviderMetric> = {
  fmp: {
    provider: "fmp",
    status: "healthy",
    latencyMs: 0,
    successRate: 100,
    fallbackCount: 0,
    requestCount: 0,
    successCount: 0,
  },
  sosovalue: {
    provider: "sosovalue",
    status: "healthy",
    latencyMs: 0,
    successRate: 100,
    fallbackCount: 0,
    requestCount: 0,
    successCount: 0,
  },
  coinstats: {
    provider: "coinstats",
    status: "healthy",
    latencyMs: 0,
    successRate: 100,
    fallbackCount: 0,
    requestCount: 0,
    successCount: 0,
  },
};

let state: Record<EtfProviderKey, EtfProviderMetric> = { ...defaults };
const listeners: Listener[] = [];

export const subscribeEtfProviderMetrics = (fn: Listener) => {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
};

const emit = () => listeners.forEach((l) => l());

export const getEtfProviderMetrics = () => state;

const computeStatus = (metric: EtfProviderMetric): "healthy" | "degraded" | "error" => {
  if (metric.requestCount >= 3 && metric.successCount === 0) return "error";
  if (metric.successRate < 80) return "degraded";
  return "healthy";
};

export function updateEtfProviderMetric(provider: EtfProviderKey, partial: Partial<EtfProviderMetric>): void {
  const current = state[provider] || defaults[provider];
  const next = { ...current, ...partial };
  if (typeof next.requestCount === "number" && typeof next.successCount === "number") {
    next.successRate = next.requestCount > 0 ? Math.min(100, Math.max(0, (next.successCount / next.requestCount) * 100)) : 100;
  }
  next.status = computeStatus(next);
  state = { ...state, [provider]: next };
  emit();
}

export function incrementFallback(provider: EtfProviderKey) {
  const current = state[provider] || defaults[provider];
  updateEtfProviderMetric(provider, { fallbackCount: (current.fallbackCount || 0) + 1 });
}

export function recordSuccess(provider: EtfProviderKey, latencyMs: number) {
  const current = state[provider] || defaults[provider];
  const requestCount = (current.requestCount || 0) + 1;
  const successCount = (current.successCount || 0) + 1;
  const latency = current.latencyMs ? current.latencyMs * 0.7 + latencyMs * 0.3 : latencyMs;
  updateEtfProviderMetric(provider, { requestCount, successCount, latencyMs: latency, lastSuccessAt: Date.now() });
}

export function recordError(provider: EtfProviderKey) {
  const current = state[provider] || defaults[provider];
  const requestCount = (current.requestCount || 0) + 1;
  updateEtfProviderMetric(provider, { requestCount, lastErrorAt: Date.now() });
}
