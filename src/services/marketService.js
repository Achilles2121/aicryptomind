import { api } from "../lib/api";

const normalizePrice = (res) => {
  if (res?.ok === false) {
    return { value: null, change24h: null, source: "Proxy", updatedAt: null, status: res.status, error: res.error };
  }
  return res?.data ?? res ?? null;
};

const normalizeOhlc = (res) => {
  if (res?.ok === false) {
    return { candles: [], status: res.status, error: res.error };
  }
  const rows = Array.isArray(res?.data) ? res.data : res?.candles || res || [];
  return { candles: rows };
};

export const marketService = {
  getPrice: (symbol) => api.get("/price", { symbol }).then(normalizePrice),
  getOhlc: (symbol, interval = "1h", limit = 120) => api.get("/ohlc", { symbol, interval, limit }).then(normalizeOhlc),
  getIndicators: (symbol, interval = "1h", limit = 180) =>
    api.get("/indicators", { symbol, interval, limit }),
  getEtfNews: () => api.get("/etfNews"),
  getEtfFlows: () => api.get("/etfFlows"),
  getEtfHoldings: (symbol) => api.get("/etfHoldings", { symbol }),
  getCorrelations: () => api.get("/correlations"),
};
