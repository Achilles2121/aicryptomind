import { fetchJson } from "../http.js";

const BASE_URL = "https://min-api.cryptocompare.com";

export async function fetchCryptoComparePrice(symbol = "BTC", vs = "USD") {
  const data = await fetchJson(`${BASE_URL}/data/price?fsym=${symbol.toUpperCase()}&tsyms=${vs.toUpperCase()}`, {
    timeoutMs: 6000,
    retries: 1,
  });
  const value = Number(data?.[vs.toUpperCase()]);
  return Number.isFinite(value) ? value : null;
}

export async function fetchCryptoCompareDaily(symbol = "BTC", vs = "USD", limit = 30) {
  const data = await fetchJson(
    `${BASE_URL}/data/v2/histoday?fsym=${symbol.toUpperCase()}&tsym=${vs.toUpperCase()}&limit=${limit}`,
    { timeoutMs: 9000, retries: 1 }
  );
  const rows = data?.Data?.Data;
  return Array.isArray(rows)
    ? rows.map((row) => ({ time: Number(row.time) * 1000, close: Number(row.close || 0) }))
    : [];
}
