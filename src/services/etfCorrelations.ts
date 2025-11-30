import { safeFetch } from "../lib/safeFetch";

export type CorrelationPoint = {
  pair: string;
  corr7d: number | null;
  corr30d: number | null;
};

export type CorrelationResult = {
  data: CorrelationPoint[];
  lastUpdated: string;
  error?: string;
};

type Series = { symbol: string; closes: number[] };

const CG_ENDPOINT = (id: string) => `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30`;
const CC_ENDPOINT = (sym: string) => `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${sym}&tsym=USD&limit=30`;
const BINANCE_ENDPOINT = (sym: string) => `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1d&limit=30`;
const ALPHA_ENDPOINT = (sym: string) => `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&apikey=demo`;

const SOURCES: Record<
  string,
  {
    cgId?: string;
    cc?: string;
    binance?: string;
    alpha?: string;
  }
> = {
  BTC: { cgId: "bitcoin", cc: "BTC", binance: "BTCUSDT" },
  ETH: { cgId: "ethereum", cc: "ETH", binance: "ETHUSDT" },
  "^GSPC": { alpha: "SPX" },
  XAU: { alpha: "GOLD" },
  IBIT: { alpha: "IBIT" },
  FBTC: { alpha: "FBTC" },
  ARKB: { alpha: "ARKB" },
  BITB: { alpha: "BITB" },
  HODL: { alpha: "HODL" },
};

const pearson = (a: number[], b: number[]) => {
  if (!a.length || !b.length || a.length !== b.length) return null;
  const n = a.length;
  const meanA = a.reduce((acc, v) => acc + v, 0) / n;
  const meanB = b.reduce((acc, v) => acc + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return null;
  return num / Math.sqrt(denA * denB);
};

const fetchCoingecko = async (id: string) => {
  const res = await safeFetch<{ prices?: [number, number][] }>(CG_ENDPOINT(id));
  const prices = res?.prices ?? [];
  return prices.map((p) => p[1]);
};

const fetchCryptoCompare = async (sym: string) => {
  const res = await safeFetch<{ Data?: { Data?: { close: number }[] } }>(CC_ENDPOINT(sym));
  const data = res?.Data?.Data ?? [];
  return data.map((d) => d.close);
};

const fetchBinance = async (sym: string) => {
  const res = await safeFetch<any[]>(BINANCE_ENDPOINT(sym));
  return (res || []).map((k) => Number(k[4] || 0));
};

const fetchAlpha = async (sym: string) => {
  const res = await safeFetch<{ "Time Series (Daily)"?: Record<string, { "4. close": string }> }>(ALPHA_ENDPOINT(sym));
  const series = res?.["Time Series (Daily)"] || {};
  const entries = Object.entries(series)
    .slice(0, 40)
    .map(([date, val]) => ({ date, close: Number(val["4. close"]) }));
  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((e) => e.close);
};

const takeLast = (arr: number[], n: number) => (arr.length >= n ? arr.slice(-n) : arr);

async function fetchSeries(symbol: string): Promise<Series | null> {
  const src = SOURCES[symbol] || {};
  let closes: number[] = [];
  try {
    if (src.cgId) {
      closes = await fetchCoingecko(src.cgId);
    } else if (src.alpha) {
      closes = await fetchAlpha(src.alpha);
    }
    if (!closes.length && src.cc) {
      closes = await fetchCryptoCompare(src.cc);
    }
    if (!closes.length && src.binance) {
      closes = await fetchBinance(src.binance);
    }
  } catch (err) {
    // ignore, will return null
  }
  return closes.length ? { symbol, closes } : null;
}

export async function fetchEtfCorrelations(onHealthUpdate?: (key: string, status: string, message?: string) => void, onToast?: (msg: string, type?: string) => void): Promise<CorrelationResult> {
  const symbols = ["IBIT", "FBTC", "ARKB", "BITB", "HODL"];
  const assets = ["BTC", "ETH", "^GSPC", "XAU"];
  try {
    const allSymbols = [...symbols, ...assets];
    const seriesList = await Promise.all(allSymbols.map((s) => fetchSeries(s)));
    const present = seriesList.filter(Boolean) as Series[];
    const map: Record<string, Series> = {};
    present.forEach((s) => {
      map[s.symbol] = s;
    });
    const data: CorrelationPoint[] = [];
    symbols.forEach((etf) => {
      assets.forEach((asset) => {
        const a = map[etf]?.closes || [];
        const b = map[asset]?.closes || [];
        const len = Math.min(a.length, b.length);
        const alignedA = a.slice(-len);
        const alignedB = b.slice(-len);
        const corr30 = len >= 30 ? pearson(alignedA.slice(-30), alignedB.slice(-30)) : null;
        const corr7 = len >= 7 ? pearson(alignedA.slice(-7), alignedB.slice(-7)) : null;
        data.push({ pair: `${etf}-${asset}`, corr7d: corr7, corr30d: corr30 });
      });
    });
    onHealthUpdate?.("ETF_CORR", "healthy");
    return { data, lastUpdated: new Date().toISOString() };
  } catch (err: any) {
    onHealthUpdate?.("ETF_CORR", "degraded", err?.message || "correlation failed");
    onToast?.("ETF-Korrelationen: Daten derzeit nicht verfügbar", "warn");
    return { data: [], lastUpdated: new Date().toISOString(), error: "unavailable" };
  }
}
