import { api } from "../lib/api";

export const marketService = {
  getPrice: (symbol) => api.get("/price", { symbol }),
  getOhlc: (symbol, interval = "1h", limit = 120) =>
    api.get("/ohlc", { symbol, interval, limit }),
  getIndicators: (symbol, interval = "1h", limit = 180) =>
    api.get("/indicators", { symbol, interval, limit }),
  getEtfNews: () => api.get("/etfNews"),
  getEtfFlows: () => api.get("/etfFlows"),
  getEtfHoldings: (symbol) => api.get("/etfHoldings", { symbol }),
  getCorrelations: () => api.get("/correlations"),
};
