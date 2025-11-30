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

type HealthFn = (key: string, status: string, message?: string) => void;
type ToastFn = (msg: string, type?: string) => void;

const CG = (id: string) => `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30`;
const CC = (sym: string) => `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${sym}&tsym=USD&limit=30`;
const AV = (sym: string) => `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${sym}&apikey=demo`;
const TOAST_COOLDOWN_MS = 2 * 60 * 1000;
const lastToastTs = new Map<string, number>();

const maybeToast = (key: string, onToast?: ToastFn, message?: string, type: string = "info") => {
  if (!onToast || !message) return;
  const now = Date.now();
  const last = lastToastTs.get(key) || 0;
  if (now - last < TOAST_COOLDOWN_MS) return;
  lastToastTs.set(key, now);
  onToast(message, type);
};

const SOURCES: Record<
  string,
  {
    cg?: string;
    cc?: string;
    av?: string;
  }
> = {
  BTC: { cg: "bitcoin", cc: "BTC", av: "BTC" },
  ETH: { cg: "ethereum", cc: "ETH", av: "ETH" },
  IBIT: { av: "IBIT" },
  FBTC: { av: "FBTC" },
  ARKB: { av: "ARKB" },
  BITB: { av: "BITB" },
  HODL: { av: "HODL" },
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

const fetchCg = async (id: string) => {
  const res = await safeFetch<{ prices?: [number, number][] }>(CG(id), { serviceName: "ETF_CORR_PRIMARY" });
  return res?.prices?.map((p) => p[1]) ?? [];
};

const fetchCc = async (sym: string) => {
  const res = await safeFetch<{ Data?: { Data?: { close: number }[] } }>(CC(sym), { serviceName: "ETF_CORR_FALLBACK" });
  return res?.Data?.Data?.map((d) => d.close) ?? [];
};

const fetchAv = async (sym: string) => {
  const res = await safeFetch<{ "Time Series (Daily)"?: Record<string, { "4. close": string }> }>(AV(sym), { serviceName: "ETF_CORR_FALLBACK" });
  const series = res?.["Time Series (Daily)"] || {};
  return Object.entries(series)
    .map(([date, val]) => ({ date, close: Number(val["4. close"]) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((e) => e.close)
    .slice(-30);
};

const takeAligned = (a: number[], b: number[]) => {
  const len = Math.min(a.length, b.length);
  return len ? [a.slice(-len), b.slice(-len)] : [[], []];
};

async function fetchSeries(symbol: string): Promise<number[]> {
  const src = SOURCES[symbol] || {};
  let closes: number[] = [];
  if (src.cg) {
    try {
      closes = await fetchCg(src.cg);
    } catch (err) {
      closes = [];
    }
  }
  if (!closes.length && src.cc) {
    try {
      closes = await fetchCc(src.cc);
    } catch (err) {
      closes = [];
    }
  }
  if (!closes.length && src.av) {
    try {
      closes = await fetchAv(src.av);
    } catch (err) {
      closes = [];
    }
  }
  return closes;
}

export async function fetchEtfCorrelationsLive(onHealthUpdate?: HealthFn, onToast?: ToastFn): Promise<CorrelationResult> {
  const etfs = ["IBIT", "FBTC", "ARKB", "BITB", "HODL"];
  const assets = ["BTC", "ETH"];
  try {
    const symbols = [...etfs, ...assets];
    const series = await Promise.all(symbols.map((s) => fetchSeries(s)));
    const map: Record<string, number[]> = {};
    symbols.forEach((s, idx) => {
      map[s] = series[idx] || [];
    });
    const data: CorrelationPoint[] = [];
    etfs.forEach((e) => {
      assets.forEach((a) => {
        const [sa, sb] = takeAligned(map[e] || [], map[a] || []);
        const corr30 = sa.length >= 30 ? pearson(sa.slice(-30), sb.slice(-30)) : null;
        const corr7 = sa.length >= 7 ? pearson(sa.slice(-7), sb.slice(-7)) : null;
        data.push({ pair: `${e}-${a}`, corr7d: corr7, corr30d: corr30 });
      });
    });
    onHealthUpdate?.("ETF_CORR_PRIMARY", "healthy");
    return { data, lastUpdated: new Date().toISOString() };
  } catch (err: any) {
    onHealthUpdate?.("ETF_CORR_PRIMARY", "degraded", err?.message);
    onHealthUpdate?.("ETF_CORR_FALLBACK", "degraded", err?.message);
    maybeToast("ETF_CORR_PRIMARY", onToast, "ETF-Korrelationen live: Daten derzeit nicht verfuegbar", "warn");
    return { data: [], lastUpdated: new Date().toISOString(), error: "unavailable" };
  }
}
