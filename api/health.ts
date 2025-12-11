import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

const send = (res: Res, status: number, body: unknown) => {
  if (res.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (typeof res.json === "function") {
    res.status(status).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
};

const isAbortError = (error: unknown) => {
  const message = (error as Error)?.message?.toLowerCase?.() || "";
  return (error as Error)?.name === "AbortError" || message.includes("abort") || message.includes("timeout");
};

type ProviderStatus = "ok" | "warn" | "error";

type ProviderConfig = {
  key: string;
  url?: string;
  requiresKey?: string;
};

const providers: ProviderConfig[] = [
  { key: "coingecko", url: "https://api.coingecko.com/api/v3/ping" },
  { key: "cryptocompare", url: "https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC&tsyms=USD" },
  { key: "fmp", requiresKey: "FMP_API_KEY" },
  { key: "binance", url: "https://api.binance.com/api/v3/ping" },
  { key: "kraken", url: "https://api.kraken.com/0/public/Time" },
];

const normalizeStatus = (status: ProviderStatus, message = "") => ({
  status,
  message,
  checkedAt: new Date().toISOString(),
});

async function probeProvider(config: ProviderConfig) {
  const cacheId = cacheKey("health", config.key);
  const cached = cache.get<ReturnType<typeof normalizeStatus>>(cacheId);
  if (cached) return cached;

  if (config.requiresKey && !process.env[config.requiresKey] && !process.env.VITE_FMP_KEY) {
    return cache.set(cacheId, normalizeStatus("warn", "API key missing"));
  }

  if (!config.url) {
    return cache.set(cacheId, normalizeStatus("warn", "No probe configured"));
  }

  try {
    await safeFetchJson(config.url, undefined, { timeoutMs: 1500, attempts: 1 });
    return cache.set(cacheId, normalizeStatus("ok"));
  } catch (err: any) {
    const status: ProviderStatus = isAbortError(err) ? "warn" : "error";
    const message = err?.message || "probe failed";
    return cache.set(cacheId, normalizeStatus(status, message));
  }
}

export default async function handler(_req: unknown, res: Res) {
  try {
    const entries = await Promise.all(providers.map((provider) => probeProvider(provider)));
    const providersStatus = providers.reduce<Record<string, ProviderStatus>>((acc, provider, idx) => {
      acc[provider.key] = entries[idx].status;
      return acc;
    }, {});

    return send(res, 200, {
      ok: true,
      timestamp: new Date().toISOString(),
      providers: providersStatus,
      meta: entries.reduce<Record<string, string>>((acc, provider, idx) => {
        const status = entries[idx];
        if (status.message) acc[providers[idx].key] = status.message;
        return acc;
      }, {}),
    });
  } catch (err: any) {
    const statusCode = isAbortError(err) ? 504 : 502;
    return send(res, statusCode, {
      ok: false,
      statusCode,
      message: err?.message || "Health probe failed",
      hint: statusCode === 504 ? "Health probe timeout" : "Probe failed",
      timestamp: new Date().toISOString(),
      providers: {},
    });
  }
}
