// Copyright (c) 2025 Vision AI Mind. All rights reserved.
// Coins API - Top 100 Cryptocurrencies with Market Data

import supportedCoins from "../src/config/supportedCoins.js";

// Local types to avoid @vercel/node dependency
type VercelRequest = {
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  sparkline_in_7d?: { price: number[] };
  price_source?: string;
}

interface CacheEntry {
  data: CoinData[];
  timestamp: number;
}

// In-memory cache
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 1 minute
const MAX_CONCURRENT_FETCHES = 5;
const IDS_CHUNK_SIZE = 50;
const DEFAULT_IDS = supportedCoins.map((coin) => coin.id);
const SUPPORTED_IDS = new Set(DEFAULT_IDS);

type SourceKey = 'binance' | 'kraken' | 'coingecko';

interface SourceMetric {
  avgLatency: number;
  samples: number;
  errorCount: number;
  lastErrorAt: number | null;
}

const sourceMetrics = new Map<SourceKey, SourceMetric>();

let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

const withSemaphore = async <T>(task: () => Promise<T>): Promise<T> => {
  if (activeFetches >= MAX_CONCURRENT_FETCHES) {
    await new Promise<void>((resolve) => fetchQueue.push(resolve));
  }
  activeFetches += 1;
  try {
    return await task();
  } finally {
    activeFetches -= 1;
    const next = fetchQueue.shift();
    if (next) next();
  }
};

const recordSourceMetric = (source: SourceKey, ok: boolean, durationMs: number) => {
  const prev = sourceMetrics.get(source);
  const samples = (prev?.samples || 0) + 1;
  const avgLatency = prev ? (prev.avgLatency * (samples - 1) + durationMs) / samples : durationMs;
  const errorCount = (prev?.errorCount || 0) + (ok ? 0 : 1);
  const lastErrorAt = ok ? prev?.lastErrorAt ?? null : Date.now();
  sourceMetrics.set(source, { avgLatency, samples, errorCount, lastErrorAt });
};

const scoreSource = (source: SourceKey, baseIndex: number) => {
  const metric = sourceMetrics.get(source);
  if (!metric) return 800 + baseIndex * 100;
  const recentErrorPenalty = metric.lastErrorAt && Date.now() - metric.lastErrorAt < 90_000 ? 2500 : 0;
  const errorPenalty = metric.errorCount * 300;
  return metric.avgLatency + errorPenalty + recentErrorPenalty + baseIndex * 60;
};

const pickPreferredSource = (sources: SourceKey[]) => {
  let best = sources[0];
  let bestScore = Number.POSITIVE_INFINITY;
  sources.forEach((source, index) => {
    const score = scoreSource(source, index);
    if (score < bestScore) {
      best = source;
      bestScore = score;
    }
  });
  return best;
};

const SOURCE_PRIORITY: SourceKey[] = ['binance', 'kraken', 'coingecko'];

const getSourceOrder = () => {
  const preferred = pickPreferredSource(SOURCE_PRIORITY);
  return [preferred, ...SOURCE_PRIORITY.filter((source) => source !== preferred)];
};

const fetchJson = async <T>(source: SourceKey, url: string, options?: { timeoutMs?: number; headers?: Record<string, string> }): Promise<T> => {
  return withSemaphore(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 5000);
    const start = Date.now();
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: options?.headers,
      });
      const duration = Date.now() - start;
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      const payload = await response.json() as T;
      recordSourceMetric(source, true, duration);
      return payload;
    } catch (err) {
      const duration = Date.now() - start;
      recordSourceMetric(source, false, duration);
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  });
};

const getQueryParam = (query: Record<string, string | string[]> | undefined, key: string): string | undefined => {
  const value = query?.[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const normalizeData = (base: CoinData, overrides: Partial<CoinData>, source: SourceKey): CoinData => {
  const currentPrice = Number.isFinite(overrides.current_price) ? overrides.current_price! : base.current_price;
  const changePct = Number.isFinite(overrides.price_change_percentage_24h)
    ? overrides.price_change_percentage_24h!
    : base.price_change_percentage_24h;
  const totalVolume = Number.isFinite(overrides.total_volume) ? overrides.total_volume! : base.total_volume;
  return {
    ...base,
    current_price: currentPrice ?? 0,
    price_change_percentage_24h: changePct ?? 0,
    total_volume: totalVolume ?? 0,
    price_source: source,
  };
};

const normalizeBinanceSymbol = (symbol: string) => {
  const base = symbol.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  if (base === "BTC" || base === "BTCUSD") return "BTCUSDT";
  if (base === "ETH" || base === "ETHUSD") return "ETHUSDT";
  if (base === "SOL" || base === "SOLUSD") return "SOLUSDT";
  if (base.endsWith("USDT")) return base;
  return `${base}USDT`;
};

const normalizeKrakenPair = (symbol: string) => {
  const base = symbol.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
  const stripped = base.replace(/USDT?$/, "");
  if (stripped === "BTC") return "XBTUSD";
  if (stripped === "ETH") return "ETHUSD";
  return `${stripped}USD`;
};

const fetchBinanceTicker = async (symbol: string): Promise<Partial<CoinData>> => {
  const pair = normalizeBinanceSymbol(symbol);
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
  const data = await fetchJson<{
    lastPrice?: string;
    priceChangePercent?: string;
    volume?: string;
  }>("binance", url, { timeoutMs: 3000, headers: { Accept: "application/json" } });
  const current_price = Number(data.lastPrice);
  if (!Number.isFinite(current_price)) throw new Error("Invalid Binance price");
  const price_change_percentage_24h = Number(data.priceChangePercent);
  const total_volume = Number(data.volume);
  return {
    current_price,
    price_change_percentage_24h: Number.isFinite(price_change_percentage_24h) ? price_change_percentage_24h : undefined,
    total_volume: Number.isFinite(total_volume) ? total_volume : undefined,
  };
};

const fetchKrakenTicker = async (symbol: string): Promise<Partial<CoinData>> => {
  const pair = normalizeKrakenPair(symbol);
  const url = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;
  const data = await fetchJson<{ result?: Record<string, { c?: string[]; o?: string; v?: string[] }>; error?: string[] }>(
    "kraken",
    url,
    { timeoutMs: 3500, headers: { Accept: "application/json" } }
  );
  if (data.error?.length) {
    throw new Error(`Kraken: ${data.error.join(", ")}`);
  }
  const resultKey = Object.keys(data.result || {})[0];
  const ticker = resultKey ? data.result?.[resultKey] : null;
  const last = Number(ticker?.c?.[0]);
  if (!Number.isFinite(last)) throw new Error("Invalid Kraken price");
  const open = Number(ticker?.o);
  const price_change_percentage_24h = Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : undefined;
  const total_volume = Number(ticker?.v?.[1]);
  return {
    current_price: last,
    price_change_percentage_24h,
    total_volume: Number.isFinite(total_volume) ? total_volume : undefined,
  };
};

const isRetryableBinanceError = (error: unknown) => {
  const status = (error as Error & { status?: number })?.status;
  return status === 400 || status === 429 || status === 500 || status === undefined;
};

const fetchCoinGeckoMarkets = async (params: URLSearchParams): Promise<CoinData[]> => {
  const url = `${COINGECKO_API}/coins/markets?${params.toString()}`;
  return fetchJson<CoinData[]>("coingecko", url, {
    timeoutMs: 4500,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'VisionAIMind/1.0',
    },
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let cachedEntry: CacheEntry | undefined;
  try {
    const idsParam = getQueryParam(req.query, 'ids');
    const requestedIds = idsParam
      ? idsParam
          .split(',')
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry) => SUPPORTED_IDS.has(entry))
      : [];
    const ids = requestedIds.length ? requestedIds : DEFAULT_IDS;
    const cacheKey = `ids:${ids.join(',')}`;

    cachedEntry = cache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      return res.status(200).json({
        success: true,
        data: cachedEntry.data,
        cached: true,
        count: cachedEntry.data.length,
        timestamp: new Date().toISOString(),
      });
    }

    const baseParams = new URLSearchParams({
      vs_currency: 'usd',
      order: 'market_cap_desc',
      sparkline: 'true',
      price_change_percentage: '24h,7d',
    });

    let coins: CoinData[] = [];
    let hadBatchErrors = false;

    const chunks = chunkArray(ids, IDS_CHUNK_SIZE);
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const params = new URLSearchParams(baseParams);
        params.set('ids', chunk.join(','));
        try {
          return await fetchCoinGeckoMarkets(params);
        } catch (batchError) {
          hadBatchErrors = true;
          console.warn('[coins] CoinGecko batch failed:', (batchError as Error).message);
          return [];
        }
      })
    );
    coins = results.flat();

    if (!coins.length && cachedEntry) {
      return res.status(200).json({
        success: true,
        data: cachedEntry.data,
        cached: true,
        stale: true,
        count: cachedEntry.data.length,
        timestamp: new Date().toISOString(),
      });
    }

    if (coins.length) {
      const sourceOrder = getSourceOrder();
      const normalized = await Promise.all(
        coins.map(async (coin) => {
          const symbol = coin.symbol || "";
          if (!symbol) {
            return normalizeData(coin, {}, "coingecko");
          }
          for (const source of sourceOrder) {
            if (source === "binance") {
              try {
                const overrides = await fetchBinanceTicker(symbol);
                return normalizeData(coin, overrides, "binance");
              } catch (error) {
                if (!isRetryableBinanceError(error)) {
                  continue;
                }
              }
            }
            if (source === "kraken") {
              try {
                const overrides = await fetchKrakenTicker(symbol);
                return normalizeData(coin, overrides, "kraken");
              } catch {
                continue;
              }
            }
            if (source === "coingecko") {
              return normalizeData(coin, {}, "coingecko");
            }
          }
          return normalizeData(coin, {}, "coingecko");
        })
      );
      coins = normalized;
    }

    cache.set(cacheKey, { data: coins, timestamp: Date.now() });

    return res.status(200).json({
      success: true,
      data: coins,
      cached: false,
      partial: hadBatchErrors,
      count: coins.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Coins API error:', error);

    // Return stale cache if available
    if (cachedEntry) {
      return res.status(200).json({
        success: true,
        data: cachedEntry.data,
        cached: true,
        stale: true,
        error: 'Using cached data due to API error',
        count: cachedEntry.data.length,
        timestamp: new Date().toISOString(),
      });
    }

    // NEVER return 500 - always provide fallback data
    const fallbackData = DEFAULT_IDS.slice(0, 10).map((id) => {
      const coin = supportedCoins.find((c) => c.id === id);
      return {
        id,
        symbol: coin?.symbol || id.toUpperCase(),
        name: coin?.name || id,
        image: '',
        current_price: 0,
        price_change_percentage_24h: 0,
        market_cap: 0,
        market_cap_rank: 0,
        total_volume: 0,
        circulating_supply: 0,
        total_supply: null,
        max_supply: null,
        ath: 0,
        ath_change_percentage: 0,
        price_source: 'fallback',
      } as CoinData;
    });

    return res.status(200).json({
      success: true,
      data: fallbackData,
      cached: false,
      fallback: true,
      error: error instanceof Error ? error.message : 'Using fallback data',
      count: fallbackData.length,
      timestamp: new Date().toISOString(),
    });
  }
}
