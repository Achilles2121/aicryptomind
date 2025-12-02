import { fetchJson } from "../http.js";

const BASE_URL = "https://api.coingecko.com/api/v3";

export async function fetchCoingeckoSimplePrice(ids = [], vsCurrency = "usd") {
  const params = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: vsCurrency,
    include_24hr_change: "true",
  });
  return fetchJson(`${BASE_URL}/simple/price?${params.toString()}`, { timeoutMs: 9000, retries: 1 });
}

export async function fetchCoingeckoOhlc(id = "bitcoin", { vsCurrency = "usd", days = 1 } = {}) {
  const params = new URLSearchParams({ vs_currency: vsCurrency, days: String(days) });
  const rows = await fetchJson(`${BASE_URL}/coins/${id}/ohlc?${params.toString()}`, { timeoutMs: 9000, retries: 1 });
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000) || 0,
    open: Number(row[1]) || 0,
    high: Number(row[2]) || 0,
    low: Number(row[3]) || 0,
    close: Number(row[4]) || 0,
    volume: Number(row[5]) || 0,
    provider: "coingecko",
  }));
}

export async function fetchCoingeckoMarketChart(id = "bitcoin", { vsCurrency = "usd", days = 30, interval = "daily" } = {}) {
  const params = new URLSearchParams({ vs_currency: vsCurrency, days: String(days), interval });
  const data = await fetchJson(`${BASE_URL}/coins/${id}/market_chart?${params.toString()}`, { timeoutMs: 9000, retries: 1 });
  return Array.isArray(data?.prices) ? data.prices : [];
}
