import { safeFetch, AppError } from "../lib/safeFetch";
import { getCachedUserTier } from "../firebase";
import type { ApiHealthStatus } from "../lib/safeFetch";

type HealthCb = (service: string, status: ApiHealthStatus, message?: string) => void;
type LogCb = (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
type ToastCb = (message: string, type?: "warn" | "error" | "info") => void;

const COINAPI_BASE = "https://rest.coinapi.io/v1/metrics/symbol/history";
const DEFAULT_SYMBOL = "DERIBIT_PERPETUAL_BTC_USD";

const computeZ = (values: number[]) => {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length || 1;
  const std = Math.sqrt(variance) || 1;
  const last = values.at(-1) ?? 0;
  return (last - mean) / std;
};

const normalizeScore = (value: number) => {
  const clipped = Math.max(-3, Math.min(3, value));
  return Number((0.5 + clipped / 6).toFixed(4)); // map -3..3 -> 0..1
};

const mapMetric = (rows: any[] = []) =>
  rows
    .map((r) => ({
      time: r.time_period_end ? Date.parse(r.time_period_end) : Date.now(),
      value: Number(r.value_close ?? r.value ?? r.v ?? 0),
    }))
    .filter((r) => Number.isFinite(r.value));

const fetchMetric = async (
  metricId: string,
  symbolId: string,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const apiKey = import.meta.env.VITE_COINAPI_KEY;
  if (!apiKey) throw new AppError("Missing CoinAPI key", 401, "DERIVATIVES_PRIMARY");
  const url = `${COINAPI_BASE}?symbol_id=${symbolId}&metric_id=${metricId}&period_id=1HRS&limit=200`;
  return safeFetch<any[]>(url, {
    serviceName: "DERIVATIVES_PRIMARY",
    timeoutMs: 12000,
    retries: 1,
    headers: { "X-CoinAPI-Key": apiKey },
    onHealthUpdate,
    onLog,
    onToast,
  });
};

export const fetchDerivativesLive = async (
  symbolId: string = DEFAULT_SYMBOL,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const tier = getCachedUserTier();
  if (tier !== "pro" && tier !== "elite") {
    onHealthUpdate?.("DERIVATIVES_PRIMARY", "degraded", "Tier required");
    return {
      fundingSeries: [],
      oiSeries: [],
      fundingZ: 0,
      oiZ: 0,
      composite: 0,
      score: 0.5,
      riskLevel: "neutral",
      updatedAt: Date.now(),
    };
  }
  try {
    const [fundingRaw, oiRaw] = await Promise.all([
      fetchMetric("DERIVATIVES_FUNDING_RATE_CURRENT", symbolId, onHealthUpdate, onLog, onToast),
      fetchMetric("DERIVATIVES_OPEN_INTEREST", symbolId, onHealthUpdate, onLog, onToast),
    ]);
    const fundingSeries = mapMetric(fundingRaw);
    const oiSeries = mapMetric(oiRaw);

    const fundingDelta = fundingSeries.slice(-20).map((p, idx, arr) => (idx === 0 ? 0 : p.value - arr[idx - 1].value));
    const oiDelta = oiSeries.slice(-20).map((p, idx, arr) => (idx === 0 ? 0 : p.value - arr[idx - 1].value));

    const fundingZ = computeZ(fundingDelta.filter((v) => Number.isFinite(v)));
    const oiZ = computeZ(oiDelta.filter((v) => Number.isFinite(v)));
    const composite = 0.6 * oiZ + 0.4 * fundingZ;
    const score = normalizeScore(composite);
    const riskLevel = composite >= 1.2 ? "hot" : composite <= -1 ? "cool" : "neutral";

    onHealthUpdate?.("DERIVATIVES_PRIMARY", "ok");
    return {
      fundingSeries,
      oiSeries,
      fundingZ,
      oiZ,
      composite,
      score,
      riskLevel,
      updatedAt: Date.now(),
    };
  } catch (err: any) {
    onHealthUpdate?.("DERIVATIVES_PRIMARY", "error", err?.message || "derivatives fetch failed");
    onLog?.("DERIVATIVES_PRIMARY", "error", err?.message || "derivatives fetch failed");
    return {
      fundingSeries: [],
      oiSeries: [],
      fundingZ: 0,
      oiZ: 0,
      composite: 0,
      score: 0.5,
      riskLevel: "neutral",
      updatedAt: Date.now(),
    };
  }
};

export type DerivativesLive = Awaited<ReturnType<typeof fetchDerivativesLive>>;
