import { safeFetch } from "../lib/safeFetch";
import { getCachedUserTier } from "../firebase";
import { apiUrl } from "../lib/http";
import type { ApiHealthStatus } from "../lib/safeFetch";
import { computeDerivativesComposite } from "../lib/derivativesRisk.js";

type HealthCb = (service: string, status: ApiHealthStatus, message?: string) => void;
type LogCb = (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
type ToastCb = (message: string, type?: "warn" | "error" | "info") => void;

const DEFAULT_SYMBOL = "DERIBIT_PERPETUAL_BTC_USD";

export const fetchDerivativesLive = async (
  symbolId: string = DEFAULT_SYMBOL,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const tier = getCachedUserTier();
  if (tier !== "pro" && tier !== "elite") {
    onHealthUpdate?.("DERIVATIVES_PRIMARY", "warn", "Tier required");
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
    // FIX: Use the dedicated /api/derivatives proxy (with apiUrl) to avoid CORS/404 issues.
    const url = apiUrl(`/api/derivatives?symbol=${encodeURIComponent(symbolId)}&period=1HRS&limit=200`);
    const res = await safeFetch<{
      data?: { funding?: any[]; openInterest?: any[]; risk?: { composite: number; fundingScore: number; oiScore: number; riskLevel: string } };
    }>(url, {
      serviceName: "DERIVATIVES_PRIMARY",
      timeoutMs: 12000,
      retries: 1,
      onHealthUpdate,
      onLog,
      onToast,
    });
    const fundingSeries =
      res?.data?.funding?.map((r) => ({ time: r.time, value: Number(r.value ?? 0) })).filter((r) => Number.isFinite(r.value)) || [];
    const oiSeries =
      res?.data?.openInterest?.map((r) => ({ time: r.time, value: Number(r.value ?? 0) })).filter((r) => Number.isFinite(r.value)) ||
      [];

    const fundingDelta = fundingSeries.slice(-20).map((p, idx, arr) => (idx === 0 ? 0 : p.value - arr[idx - 1].value));
    const oiDelta = oiSeries.slice(-20).map((p, idx, arr) => (idx === 0 ? 0 : p.value - arr[idx - 1].value));

    const { fundingZ, oiZ, composite, score, riskLevel } = computeDerivativesComposite(fundingDelta, oiDelta);

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
