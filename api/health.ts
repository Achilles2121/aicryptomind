import { cache, cacheKey } from "./utils/cache";
import { safeFetchJson } from "./utils/safeFetch";
import { sendEnvelope, buildErrorEnvelope, type ApiEnvelope } from "./utils/response";

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
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
  optional?: boolean;
};

const metalApiKey = process.env.METALS_API_KEY;
const metalPriceKey = process.env.METALPRICEAPI_KEY;
const metalsDevKey = process.env.METALS_DEV_KEY;
const finnhubKey = process.env.FINNHUB_API_KEY;
const fmpKey = process.env.FMP_API_KEY || process.env.VITE_FMP_KEY;
const alphaKey = process.env.ALPHAVANTAGE_API_KEY;
const coreProviders = new Set(["coingecko", "cryptocompare", "binance", "kraken", "fmp"]);

const providers: ProviderConfig[] = [
  { key: "coingecko", url: "https://api.coingecko.com/api/v3/ping" },
  { key: "cryptocompare", url: "https://min-api.cryptocompare.com/data/pricemulti?fsyms=BTC&tsyms=USD" },
  { key: "fmp", requiresKey: fmpKey ? undefined : "FMP_API_KEY", url: fmpKey ? "https://financialmodelingprep.com/api/v3/is-the-market-open" : undefined },
  { key: "binance", url: "https://api.binance.com/api/v3/ping" },
  { key: "kraken", url: "https://api.kraken.com/0/public/Time" },
  { key: "freeforexapi", url: "https://freeforexapi.com/api/live?pairs=EURUSD" },
  { key: "exchangeratehost", url: "https://api.exchangerate.host/convert?from=EUR&to=USD" },
  { key: "alphavantage", requiresKey: alphaKey ? undefined : "ALPHAVANTAGE_API_KEY", url: alphaKey ? `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${alphaKey}` : undefined, optional: true },
  { key: "finnhub", requiresKey: finnhubKey ? undefined : "FINNHUB_API_KEY", url: finnhubKey ? `https://finnhub.io/api/v1/forex/exchange?token=${finnhubKey}` : undefined, optional: true },
  { key: "metals-api", requiresKey: metalApiKey ? undefined : "METALS_API_KEY", url: metalApiKey ? `https://metals-api.com/api/latest?access_key=${metalApiKey}&base=USD&symbols=XAU` : undefined, optional: true },
  { key: "metalpriceapi", requiresKey: metalPriceKey ? undefined : "METALPRICEAPI_KEY", url: metalPriceKey ? `https://api.metalpriceapi.com/v1/latest?api_key=${metalPriceKey}&base=USD&currencies=XAU` : undefined, optional: true },
  { key: "metals.dev", requiresKey: metalsDevKey ? undefined : "METALS_DEV_KEY", url: metalsDevKey ? `https://api.metals.dev/v1/latest?api_key=${metalsDevKey}&symbols=XAU` : undefined, optional: true },
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

  if (config.requiresKey && !process.env[config.requiresKey] && !(config.key === "fmp" && process.env.VITE_FMP_KEY)) {
    const msg = config.optional ? "optional provider, no api key" : "API key missing";
    return cache.set(cacheId, normalizeStatus("warn", msg));
  }

  if (!config.url) {
    const msg = config.optional ? "optional provider, no probe" : "No probe configured";
    return cache.set(cacheId, normalizeStatus("warn", msg));
  }

  try {
    await safeFetchJson(config.url, undefined, { timeoutMs: 1500, attempts: 1 });
    return cache.set(cacheId, normalizeStatus("ok"));
  } catch (err: any) {
    const isCore = coreProviders.has(config.key);
    const status: ProviderStatus = isCore ? (isAbortError(err) ? "warn" : "error") : "warn";
    const message = err?.message || (isCore ? "probe failed" : "optional provider unavailable");
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

    return sendEnvelope(res, {
      ok: true,
      status: "ok",
      timestamp: new Date().toISOString(),
      providers: providersStatus,
      meta: entries.reduce<Record<string, string>>((acc, provider, idx) => {
        const status = entries[idx];
        if (status.message) acc[providers[idx].key] = status.message;
        return acc;
      }, {}),
    } as ApiEnvelope);
  } catch (err: any) {
    const statusCode = isAbortError(err) ? 504 : 502;
    return sendEnvelope(
      res,
      buildErrorEnvelope({
        status: statusCode === 503 ? "disabled" : "degraded",
        statusCode,
        source: "health",
        message: err?.message || "Health probe failed",
        hint: statusCode === 504 ? "Health probe timeout" : "Probe failed",
        errors: [err?.message || "health probe failed"],
      })
    );
  }
}
