// STANDALONE DERIVATIVES ENDPOINT - NO EXTERNAL IMPORTS

type MetricPoint = { time: number; value: number };

// Simple in-memory cache
const derivativesCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 60000; // 1 minute

function getCached(key: string) {
  const entry = derivativesCache.get(key);
  if (entry && Date.now() < entry.expires) return entry.data;
  derivativesCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown) {
  derivativesCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// Simple fetch with timeout
async function safeFetch<T>(url: string, options?: { headers?: Record<string, string>; timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 7000);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        ...(options?.headers || {}),
      },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json() as T;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const METRIC_FUNDING = "DERIVATIVES_FUNDING_RATE_CURRENT";
const METRIC_OI = "DERIVATIVES_OPEN_INTEREST";

const normalizePoint = (row: unknown, metricKey: string): MetricPoint | null => {
  const r = row as Record<string, unknown>;
  const ts =
    Date.parse(
      (r?.time_period_end as string) || 
      (r?.time_close as string) || 
      (r?.time as string) || 
      (r?.period_end_time as string) || 
      (r?.timestamp as string) || 
      ""
    ) || 0;
  const metrics = Array.isArray(r?.metrics)
    ? (r.metrics as Array<Record<string, unknown>>).find(
        (m) => m?.metric_id === metricKey || m?.metric === metricKey || m?.id === metricKey
      )
    : null;
  const rawValue = r?.metric_value ?? r?.value ?? r?.[metricKey] ?? (metrics ? metrics.value : undefined);
  const value = Number(rawValue ?? 0);
  if (!ts || !Number.isFinite(value)) return null;
  return { time: ts, value };
};

const parseMetricSeries = (rows: unknown[] = [], metricKey: string): MetricPoint[] =>
  rows
    .map((row) => normalizePoint(row, metricKey))
    .filter(Boolean) as MetricPoint[];

const zScore = (values: number[] = []) => {
  if (!values.length) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(Math.max(variance, 1e-9));
  const last = values.at(-1) ?? 0;
  return (last - mean) / std;
};

const computeDeltaSeries = (series: MetricPoint[] = []) => {
  const sorted = [...series].sort((a, b) => a.time - b.time);
  const deltas: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    deltas.push(sorted[i].value - sorted[i - 1].value);
  }
  return deltas;
};

const buildRiskScore = (fundingSeries: MetricPoint[] = [], oiSeries: MetricPoint[] = []) => {
  const fundingDeltas = computeDeltaSeries(fundingSeries).slice(-20);
  const oiDeltas = computeDeltaSeries(oiSeries).slice(-20);
  const fundingScore = zScore(fundingDeltas);
  const oiScore = zScore(oiDeltas);
  const composite = 0.6 * oiScore + 0.4 * fundingScore;
  let riskLevel: "hot" | "neutral" | "cool" = "neutral";
  if (composite >= 1) riskLevel = "hot";
  else if (composite <= -0.5) riskLevel = "cool";
  return { composite, fundingScore, oiScore, riskLevel };
};

const fetchMetric = async ({
  symbol,
  period,
  limit,
  metric,
  apiKey,
}: {
  symbol: string;
  period: string;
  limit: number;
  metric: string;
  apiKey: string;
}) => {
  const params = new URLSearchParams({
    period_id: period,
    limit: String(limit),
    metrics: metric,
  });
  const url = `https://rest.coinapi.io/v1/metrics/${encodeURIComponent(symbol)}/history?${params.toString()}`;
  const rows = await safeFetch<unknown[]>(url, {
    headers: { "X-CoinAPI-Key": apiKey },
    timeoutMs: 7000,
  });
  return parseMetricSeries(rows, metric);
};

const EMPTY_DATA = {
  funding: [] as MetricPoint[],
  openInterest: [] as MetricPoint[],
  risk: { composite: 0, fundingScore: 0, oiScore: 0, riskLevel: "neutral" as const },
};

// Serverless function handler (non-edge, standard Vercel format)
type Req = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
};

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
};

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const val = query?.[key];
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val[0];
  return undefined;
};

function clampNumber(value: unknown, options: { min: number; max: number }): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return options.min;
  return Math.max(options.min, Math.min(options.max, num));
}

export default async function handler(req: Req, res: Res) {
  const symbol = (getQueryParam(req.query, "symbol") || "BITSTAMP_SPOT_BTC_USD").toUpperCase();
  const period = (getQueryParam(req.query, "period") || "1HRS").toUpperCase();
  const limit = clampNumber(getQueryParam(req.query, "limit") || 200, { min: 50, max: 400 });
  const apiKey = process.env.VITE_COINAPI_KEY || process.env.COINAPI_KEY;

  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      status: "error",
      data: EMPTY_DATA,
      meta: { symbol, period, limit },
      error: "missing_coinapi_key",
      generatedAt: new Date().toISOString(),
    });
  }

  const cacheKey = `derivatives:${symbol}:${period}:${limit}`;
  const cached = getCached(cacheKey) as typeof EMPTY_DATA | null;
  if (cached) {
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: cached,
      meta: { symbol, period, limit, cached: true },
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const funding = await fetchMetric({ symbol, period, limit, metric: METRIC_FUNDING, apiKey });
    const openInterest = await fetchMetric({ symbol, period, limit, metric: METRIC_OI, apiKey });
    const risk = buildRiskScore(funding, openInterest);

    const payload = { funding, openInterest, risk };
    setCache(cacheKey, payload);
    
    return res.status(200).json({
      ok: true,
      status: "ok",
      data: payload,
      meta: { symbol, period, limit, cached: false },
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("[derivatives] error", err);
    return res.status(200).json({
      ok: false,
      status: "degraded",
      data: EMPTY_DATA,
      meta: { symbol, period, limit },
      error: (err as Error)?.message || "coinapi failed",
      generatedAt: new Date().toISOString(),
    });
  }
}
