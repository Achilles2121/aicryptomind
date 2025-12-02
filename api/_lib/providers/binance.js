import { fetchJson } from "../http.js";

const BASE_URL = "https://api.binance.com";

export async function fetchBinanceTicker(symbol = "BTCUSDT") {
  const data = await fetchJson(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`, {
    timeoutMs: 6000,
    retries: 1,
  });
  const price = Number(data?.lastPrice);
  const changePercent = Number(data?.priceChangePercent);
  return {
    price: Number.isFinite(price) ? price : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    provider: "binance",
  };
}

export async function fetchBinanceKlines(symbol = "BTCUSDT", { limit = 120, interval = "1h" } = {}) {
  const params = new URLSearchParams({ symbol: symbol.toUpperCase(), interval, limit: String(limit) });
  const rows = await fetchJson(`${BASE_URL}/api/v3/klines?${params.toString()}`, { timeoutMs: 7000, retries: 1 });
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    openTime: Number(row[0]) || 0,
    closeTime: Number(row[6]) || 0,
    open: Number(row[1]) || 0,
    high: Number(row[2]) || 0,
    low: Number(row[3]) || 0,
    close: Number(row[4]) || 0,
    volume: Number(row[5]) || 0,
    provider: "binance",
  }));
}
