import { safeFetch } from "../lib/safeFetch";
import { getCachedUserTier } from "../firebase";
import type { ApiHealthStatus } from "../lib/safeFetch";
import { apiUrl } from "../lib/http";
import { getActiveProviders, type MarketDataProviderConfig } from "../config/dataSources";
import { fetchOhlcFromProvider, type StandardizedOhlc } from "./providers/openProviders";
import { DEFAULT_MARKET_ID, MARKETS, type MarketConfig } from "../config/markets";

type HealthCb = (service: string, status: ApiHealthStatus, message?: string) => void;
type LogCb = (source: string, level: "info" | "warn" | "error", message?: string, meta?: Record<string, unknown>) => void;
type ToastCb = (message: string, type?: "warn" | "error" | "info") => void;

const toSeconds = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
};

const extractCandlesArray = (res: unknown): any[] => {
  if (Array.isArray(res)) return res;
  const apiRes = res as Record<string, unknown>;
  const nestedCandles = (apiRes?.data as Record<string, unknown>)?.candles;
  if (Array.isArray(nestedCandles)) return nestedCandles;
  if (Array.isArray(apiRes?.data)) return apiRes.data as any[];
  if (Array.isArray(apiRes?.candles)) return apiRes.candles as any[];
  return [];
};

type OhlcRow = {
  time: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const normalizeProviderId = (value?: string) => (value || "").toLowerCase();
const findProviderSymbol = (market: MarketConfig, providerId: string) =>
  Object.entries(market.providerSymbols || {}).find(([key]) => normalizeProviderId(key) === normalizeProviderId(providerId))?.[1];
const getMarket = (assetId?: string): MarketConfig => {
  if (!assetId) return MARKETS[DEFAULT_MARKET_ID];
  const key = assetId.toUpperCase();
  return MARKETS[key] || MARKETS[DEFAULT_MARKET_ID];
};
const getActiveProviderById = (providerId?: string): MarketDataProviderConfig | undefined => {
  if (!providerId) return undefined;
  return getActiveProviders().find((p) => normalizeProviderId(p.id) === normalizeProviderId(providerId));
};

const mapOhlcSeries = (rows: any[] = []): OhlcRow[] =>
  rows
    .filter((row) => row && (row.time || row.ts || row.closeTime || row.openTime))
    .map((row) => {
      const rawTs = Number(row.time ?? row.ts ?? row.closeTime ?? row.openTime ?? Date.now());
      const ts = toSeconds(rawTs);
      const date = new Date(ts * 1000);
      return {
        time: ts,
        label: date.toISOString(),
        open: Number(row.open ?? row.o ?? 0),
        high: Number(row.high ?? row.h ?? 0),
        low: Number(row.low ?? row.l ?? 0),
        close: Number(row.close ?? row.c ?? 0),
        volume: Number(row.volume ?? row.v ?? 0),
      };
    });

type OhlcApiResponse = {
  ok?: boolean;
  status?: "ok" | "upstream_error" | "timeout" | "invalid_params";
  error?: string | null;
  data?: any[] | null;
};

const mapStandardizedOhlc = (rows: StandardizedOhlc[] = []): OhlcRow[] =>
  rows.map((row) => {
    const rawTs = row.t ?? row.time ?? row.closeTime ?? row.openTime;
    const ts = toSeconds(rawTs ?? Date.now());
    const date = new Date(ts * 1000);
    return {
      time: ts,
      label: date.toISOString(),
      open: Number(row.o ?? row.open ?? 0),
      high: Number(row.h ?? row.high ?? 0),
      low: Number(row.l ?? row.low ?? 0),
      close: Number(row.c ?? row.close ?? 0),
      volume: Number(row.v ?? row.volume ?? 0),
    };
  });

const fetchOpenProviderOhlc = async (
  market: MarketConfig,
  interval: number,
  limit = 120,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb
): Promise<OhlcRow[]> => {
  const providerOrder = Array.from(new Set([market.defaultProvider, ...Object.keys(market.providerSymbols || {})]));
  for (const providerId of providerOrder) {
    const provider = getActiveProviderById(providerId);
    if (!provider) continue;
    const symbol = findProviderSymbol(market, providerId);
    if (!symbol) continue;
    try {
      const rows = await fetchOhlcFromProvider(provider, { symbol, interval, limit });
      if (rows?.length) {
        onHealthUpdate?.(provider.id, "ok");
        return mapStandardizedOhlc(rows);
      }
    } catch (err: any) {
      onLog?.(provider.id, "warn", err?.message || "open provider ohlc failed");
      onHealthUpdate?.(provider.id, "warn", err?.message || "open provider ohlc failed");
    }
  }
  return [];
};

const fetchProxyHtf = async (
  market: MarketConfig,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  _onToast?: ToastCb
) => {
  const krakenPair = findProviderSymbol(market, "kraken");
  const url = krakenPair
    ? apiUrl(`/api/kraken/ohlc?pair=${encodeURIComponent(krakenPair)}&interval=${interval}&limit=240`)
    : apiUrl(`/api/ohlc?asset=${encodeURIComponent(market.id)}&interval=${interval}&limit=240`);
  try {
    const res = await safeFetch<OhlcApiResponse | { candles?: any[]; data?: any[] } | any[]>(url, {
      serviceName: "MARKET_HTF_PRIMARY",
      timeoutMs: 10000,
      retries: 1,
      onHealthUpdate,
      onLog,
      uiLevel: "status",
    });
    const apiRes = res as OhlcApiResponse & { candles?: any[]; data?: any[] };
    if (apiRes?.ok === false) {
      const status = apiRes.status || "upstream_error";
      const message = apiRes.error || "Price data temporarily unavailable";
      const healthStatus: ApiHealthStatus = status === "timeout" ? "warn" : "error";
      onHealthUpdate?.("MARKET_HTF_PRIMARY", healthStatus, message);
      return [];
    }
    const rows = extractCandlesArray(res);
    if (!rows.length) {
      onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", "Empty OHLC response");
      return [];
    }
    return mapOhlcSeries(rows);
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    return [];
  }
};

const fetchProxyHtfFallback = async (
  market: MarketConfig,
  interval: number,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  _onToast?: ToastCb
) => {
  const url = apiUrl(`/api/ohlc?asset=${encodeURIComponent(market.id)}&interval=${interval}&limit=240`);
  try {
    const res = await safeFetch<OhlcApiResponse | { candles?: any[]; data?: any[] } | any[]>(url, {
      serviceName: "MARKET_HTF_FALLBACK",
      timeoutMs: 10000,
      retries: 1,
      onHealthUpdate,
      onLog,
      uiLevel: "status",
    });
    const apiRes = res as OhlcApiResponse & { candles?: any[]; data?: any[] };
    if (apiRes?.ok === false) {
      const status = apiRes.status || "upstream_error";
      const message = apiRes.error || "Price data temporarily unavailable";
      const healthStatus: ApiHealthStatus = status === "timeout" ? "warn" : "error";
      onHealthUpdate?.("MARKET_HTF_FALLBACK", healthStatus, message);
      return [];
    }
    const rows = extractCandlesArray(res);
    if (!rows.length) {
      onHealthUpdate?.("MARKET_HTF_FALLBACK", "warn", "Empty OHLC response");
      return [];
    }
    onHealthUpdate?.("MARKET_HTF_FALLBACK", "ok");
    return mapOhlcSeries(rows);
  } catch (err: any) {
    onLog?.("MARKET_HTF_FALLBACK", "warn", err?.message || "fallback HTF failed");
    onHealthUpdate?.("MARKET_HTF_FALLBACK", "warn", err?.message || "fallback HTF failed");
    return [];
  }
};

export const fetchHtfOhlc = async (
  assetId?: string,
  onHealthUpdate?: HealthCb,
  onLog?: LogCb,
  onToast?: ToastCb
) => {
  const market = getMarket(assetId);
  const tier = getCachedUserTier();
  if (tier !== "pro" && tier !== "elite") {
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "warn", "Tier required");
    return { h4: [], d1: [] };
  }
  try {
    const [h4Primary, d1Primary] = await Promise.all([
      fetchProxyHtf(market, 240, onHealthUpdate, onLog, onToast),
      fetchProxyHtf(market, 1440, onHealthUpdate, onLog, onToast),
    ]);

    const h4 =
      h4Primary?.length
        ? h4Primary
        : await fetchProxyHtfFallback(market, 240, onHealthUpdate, onLog, onToast).then((rows) =>
            rows.length ? rows : fetchOpenProviderOhlc(market, 240, 240, onHealthUpdate, onLog)
          );
    const d1 =
      d1Primary?.length
        ? d1Primary
        : await fetchProxyHtfFallback(market, 1440, onHealthUpdate, onLog, onToast).then((rows) =>
            rows.length ? rows : fetchOpenProviderOhlc(market, 1440, 240, onHealthUpdate, onLog)
          );

    const hasDataPrimary: ApiHealthStatus = h4Primary?.length || d1Primary?.length ? "ok" : "warn";
    onHealthUpdate?.("MARKET_HTF_PRIMARY", hasDataPrimary, hasDataPrimary === "ok" ? "" : "HTF data empty");
    const hasDataFallback: ApiHealthStatus = h4?.length || d1?.length ? "ok" : "warn";
    onHealthUpdate?.("MARKET_HTF_FALLBACK", hasDataFallback, hasDataFallback === "ok" ? "" : "HTF fallback used");
    return { h4, d1 };
  } catch (err: any) {
    onLog?.("MARKET_HTF_PRIMARY", "warn", err?.message || "primary HTF failed");
    onHealthUpdate?.("MARKET_HTF_PRIMARY", "error", err?.message || "primary HTF failed");
    return { h4: [], d1: [] };
  }
};

export type HtfResult = Awaited<ReturnType<typeof fetchHtfOhlc>>;
// NOTE: Removed unused binanceSymbol parameter to fix TS6133 without changing behavior.
