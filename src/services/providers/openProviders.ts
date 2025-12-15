import { safeFetch } from "../../lib/safeFetch";
import type { MarketDataProviderConfig } from "../../config/dataSources";

export type StandardizedPrice = {
  symbol: string;
  price: number;
  ts: number;
  source: string;
};

export type StandardizedOhlc = {
  t?: number;
  time?: number;
  openTime?: number;
  closeTime?: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
  source: string;
  // Legacy aliases to keep existing consumers working during migration
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export type StandardizedDerivatives = {
  fundingSeries: { time: number; value: number }[];
  oiSeries: { time: number; value: number }[];
  fundingZ: number;
  oiZ: number;
  composite: number;
  score: number;
  riskLevel: string;
};

const coinGeckoMap: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

const resolveBaseSymbol = (symbol: string) => symbol.replace("/", "").replace(/USDT$/i, "").toUpperCase();
const normalizeProviderId = (id?: string) => (id || "").toUpperCase();

const parseStooqCsv = (csv?: string) => {
  if (!csv || typeof csv !== "string") return null;
  const lines = csv.trim().split(/\r?\n/);
  if (!lines.length) return null;
  const rows = lines.slice(1);
  const mapped = rows
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(",");
      const t = Date.parse(date);
      if (!Number.isFinite(t)) return null;
      const o = Number(open);
      const h = Number(high);
      const l = Number(low);
      const c = Number(close);
      const v = Number(volume) || 0;
      if ([o, h, l, c].some((n) => Number.isNaN(n))) return null;
      return { t, o, h, l, c, v, time: t, source: "STOOQ" };
    })
    .filter(Boolean) as StandardizedOhlc[];
  return mapped.length ? mapped : null;
};

export async function fetchSpotPriceFromProvider(
  provider: MarketDataProviderConfig,
  symbol: string
): Promise<StandardizedPrice | null> {
  const base = resolveBaseSymbol(symbol);
  const providerKey = normalizeProviderId(provider.id);
  try {
    switch (providerKey) {
      case "COINGECKO": {
        const id = coinGeckoMap[base] || "bitcoin";
        const res = await safeFetch<Record<string, { usd: number }>>(
          `${provider.baseUrl}/simple/price?ids=${id}&vs_currencies=usd`,
          { uiLevel: "status", serviceName: provider.id, timeoutMs: 5000 }
        );
        const price = res?.[id]?.usd;
        if (!Number.isFinite(price)) return null;
        return { symbol: `${base}USD`, price: Number(price), ts: Date.now(), source: provider.id };
      }
      case "BINANCE": {
        const pair = `${base}USDT`;
        const res = await safeFetch<{ price: string }>(`${provider.baseUrl}/ticker/price?symbol=${pair}`, {
          uiLevel: "status",
          serviceName: provider.id,
          timeoutMs: 5000,
        });
        if (!res?.price) return null;
        return { symbol: pair, price: Number(res.price), ts: Date.now(), source: provider.id };
      }
      case "STOOQ":
      case "FX_PROVIDER": {
        const symbolParam = symbol.toLowerCase();
        const res = await safeFetch<string>(`${provider.baseUrl}/q/d/l/?s=${encodeURIComponent(symbolParam)}&i=d`, {
          uiLevel: "status",
          serviceName: provider.id,
          timeoutMs: 6000,
        });
        const parsed = parseStooqCsv(res);
        const last = parsed?.at(-1);
        if (!last) return null;
        return { symbol: symbolParam.toUpperCase(), price: last.c, ts: last.t ?? Date.now(), source: provider.id };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

type OhlcParams = { symbol: string; interval: number; limit?: number };

const getBinanceInterval = (minutes: number): string => {
  if (minutes >= 1440) return "1d";
  if (minutes >= 240) return "4h";
  if (minutes >= 60) return "1h";
  return "15m";
};

const getKrakenInterval = (minutes: number): number => {
  if (minutes >= 1440) return 1440;
  if (minutes >= 240) return 240;
  if (minutes >= 60) return 60;
  return 15;
};

export async function fetchOhlcFromProvider(
  provider: MarketDataProviderConfig,
  params: OhlcParams
): Promise<StandardizedOhlc[] | null> {
  const base = resolveBaseSymbol(params.symbol);
  const providerKey = normalizeProviderId(provider.id);
  try {
    switch (providerKey) {
      case "COINGECKO": {
        const id = coinGeckoMap[base] || "bitcoin";
        const res = await safeFetch<(number | string)[][]>(
          `${provider.baseUrl}/coins/${id}/ohlc?vs_currency=usd&days=1`,
          { uiLevel: "status", serviceName: provider.id, timeoutMs: 6000 }
        );
        if (!Array.isArray(res)) return null;
        return res.slice(-(params.limit || 120)).map((row) => {
          const t = Number(row[0]);
          const o = Number(row[1]);
          const h = Number(row[2]);
          const l = Number(row[3]);
          const c = Number(row[4]);
          const v = Number(row[4]);
          return { t, o, h, l, c, v, source: provider.id, time: t, open: o, high: h, low: l, close: c, volume: v };
        });
      }
      case "BINANCE": {
        const interval = getBinanceInterval(params.interval);
        const pair = `${base}USDT`;
        const res = await safeFetch<(number | string)[][]>(
          `${provider.baseUrl}/klines?symbol=${pair}&interval=${interval}&limit=${params.limit || 120}`,
          { uiLevel: "status", serviceName: provider.id, timeoutMs: 6000 }
        );
        if (!Array.isArray(res)) return null;
        return res.map((row) => {
          const t = Number(row[0]);
          const o = Number(row[1]);
          const h = Number(row[2]);
          const l = Number(row[3]);
          const c = Number(row[4]);
          const v = Number(row[5]);
          return { t, o, h, l, c, v, source: provider.id, time: t, open: o, high: h, low: l, close: c, volume: v };
        });
      }
      case "KRAKEN": {
        const interval = getKrakenInterval(params.interval);
        const mapped = base === "BTC" ? "XBTUSD" : `${base}USD`;
        const res = await safeFetch<{ result: Record<string, any[]> }>(
          `${provider.baseUrl}/public/OHLC?pair=${mapped}&interval=${interval}`,
          { uiLevel: "status", serviceName: provider.id, timeoutMs: 6500 }
        );
        const first = res?.result ? Object.values(res.result)?.[0] : null;
        if (!Array.isArray(first)) return null;
        return (first as any[]).slice(-(params.limit || 120)).map((row: any[]) => {
          const t = Number(row[0]) * 1000;
          const o = Number(row[1]);
          const h = Number(row[2]);
          const l = Number(row[3]);
          const c = Number(row[4]);
          const v = Number(row[6]);
          return { t, o, h, l, c, v, source: provider.id, time: t, open: o, high: h, low: l, close: c, volume: v };
        });
      }
      case "STOOQ":
      case "FX_PROVIDER": {
        const granularity = "d";
        const symbol = params.symbol.toLowerCase();
        const res = await safeFetch<string>(`${provider.baseUrl}/q/d/l/?s=${encodeURIComponent(symbol)}&i=${granularity}`, {
          uiLevel: "status",
          serviceName: provider.id,
          timeoutMs: 6000,
        });
        const parsed = parseStooqCsv(res);
        if (!parsed?.length) return null;
        const rows = parsed.slice(-(params.limit || 120)).map((row) => ({
          ...row,
          source: provider.id,
          open: row.o,
          high: row.h,
          low: row.l,
          close: row.c,
          volume: row.v,
        }));
        return rows;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function fetchDerivativesFromProvider(
  _provider: MarketDataProviderConfig,
  _symbol: string
): Promise<StandardizedDerivatives | null> {
  // Placeholder for future open derivatives feeds
  return null;
}
