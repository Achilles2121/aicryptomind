import { api } from "../lib/api";

const normalizePriceEnvelope = (envelope) => {
  if (!envelope || envelope.ok === false || !envelope.data) {
    const status = envelope?.status || "upstream_error";
    const error = envelope?.error || "Price data temporarily unavailable";
    return {
      ok: false,
      value: null,
      price: null,
      change24h: null,
      source: envelope?.provider || "Proxy",
      updatedAt: null,
      status,
      error,
    };
  }
  const data = envelope.data;
  return {
    ok: true,
    value: data.value ?? data.price ?? null,
    price: data.value ?? data.price ?? null,
    change24h: data.change24h ?? null,
    source: data.source || envelope.provider || "Proxy",
    updatedAt: data.updatedAt || envelope.generatedAt || new Date().toISOString(),
    status: envelope.status || "ok",
    error: null,
  };
};

const normalizeOhlcEnvelope = (envelope) => {
  const rows = Array.isArray(envelope?.data)
    ? envelope.data
    : Array.isArray(envelope?.candles)
      ? envelope.candles
      : Array.isArray(envelope)
        ? envelope
        : [];
  if (!envelope || envelope.ok === false || rows.length === 0) {
    return {
      ok: false,
      candles: [],
      status: envelope?.status || "upstream_error",
      error: envelope?.error || "OHLC data temporarily unavailable",
      provider: envelope?.provider || null,
    };
  }
  return {
    ok: true,
    candles: rows,
    status: envelope.status || "ok",
    error: null,
    provider: envelope.provider || rows[0]?.provider || null,
  };
};

export const marketService = {
  getPrice: async (symbol, vs = "USD") => {
    try {
      const envelope = await api.get("/price", { asset: symbol, vs });
      return normalizePriceEnvelope(envelope);
    } catch (err) {
      return normalizePriceEnvelope({ ok: false, status: "upstream_error", error: err?.message || "Price unavailable" });
    }
  },
  getOhlc: async (symbol, interval = "1h", limit = 120) => {
    try {
      const envelope = await api.get("/ohlc", { symbol, interval, limit });
      return normalizeOhlcEnvelope(envelope);
    } catch (err) {
      return normalizeOhlcEnvelope({ ok: false, status: "upstream_error", error: err?.message || "OHLC unavailable" });
    }
  },
  // Disabled - indicators endpoint not available on Hobby plan
  getIndicators: () => Promise.resolve({ frames: {}, status: "disabled" }),
  // ETF endpoints - correct paths
  getEtfNews: () => api.get("/etf/news"),
  getEtfFlows: () => api.get("/etf/flows"),
  getEtfHoldings: (symbol) => api.get("/etf/holdings", { symbol }),
  // Disabled - correlations endpoint not available on Hobby plan
  getCorrelations: () => Promise.resolve({ status: "disabled", data: [] }),
};
