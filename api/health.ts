// STANDALONE HEALTH ENDPOINT - NO EXTERNAL IMPORTS

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
};

type ProviderStatus = "ok" | "warn" | "error";

type ProviderResult = {
  key: string;
  status: ProviderStatus;
  message: string;
  latency?: number;
};

// Simple in-memory cache for health checks (persists across warm invocations)
const healthCache = new Map<string, { data: ProviderResult; expires: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key: string): ProviderResult | null {
  const entry = healthCache.get(key);
  if (entry && Date.now() < entry.expires) {
    return entry.data;
  }
  healthCache.delete(key);
  return null;
}

function setCache(key: string, data: ProviderResult): ProviderResult {
  healthCache.set(key, { data, expires: Date.now() + CACHE_TTL });
  return data;
}

// Providers to check
const PROVIDERS = [
  { key: "coingecko", url: "https://api.coingecko.com/api/v3/ping", core: true },
  { key: "cryptocompare", url: "https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC&tsyms=USD", core: true },
  { key: "binance", url: "https://api.binance.com/api/v3/ping", core: true },
  { key: "kraken", url: "https://api.kraken.com/0/public/Time", core: true },
  { key: "openExchangeRate", url: "https://open.er-api.com/v6/latest/USD", core: true },
  { key: "stooq", url: "https://stooq.pl/q/d/l/?s=^spx&i=d", core: true },
];

async function probeProvider(provider: typeof PROVIDERS[0]): Promise<ProviderResult> {
  const cached = getCached(provider.key);
  if (cached) return cached;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(provider.url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    
    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok || response.status < 500) {
      return setCache(provider.key, {
        key: provider.key,
        status: "ok",
        message: `${latency}ms`,
        latency,
      });
    }

    return setCache(provider.key, {
      key: provider.key,
      status: "warn",
      message: `HTTP ${response.status}`,
      latency,
    });
  } catch (err: unknown) {
    const latency = Date.now() - start;
    const isTimeout = (err as Error)?.name === "AbortError";
    return setCache(provider.key, {
      key: provider.key,
      status: provider.core ? "error" : "warn",
      message: isTimeout ? "timeout" : (err as Error)?.message || "failed",
      latency,
    });
  }
}

export default async function handler(_req: unknown, res: Res) {
  try {
    // Probe all providers in parallel
    const results = await Promise.all(PROVIDERS.map(probeProvider));

    // Build status object
    const providers: Record<string, ProviderStatus> = {};
    const meta: Record<string, string> = {};
    let hasError = false;
    let hasWarn = false;

    for (const result of results) {
      providers[result.key] = result.status;
      if (result.message) meta[result.key] = result.message;
      if (result.status === "error") hasError = true;
      if (result.status === "warn") hasWarn = true;
    }

    const overallStatus = hasError ? "degraded" : hasWarn ? "partial" : "ok";

    return res.status(200).json({
      ok: !hasError,
      status: overallStatus,
      timestamp: new Date().toISOString(),
      providers,
      meta,
    });
  } catch (err: unknown) {
    const errMsg = (err as Error)?.message || "Health probe failed";
    return res.status(500).json({
      ok: false,
      status: "error",
      timestamp: new Date().toISOString(),
      error: errMsg,
      providers: {},
    });
  }
}
