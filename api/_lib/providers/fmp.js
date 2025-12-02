import { fetchJson, HttpError } from "../http.js";

const BASE_URL = "https://financialmodelingprep.com/api";

const getKey = () => process.env.FMP_API_KEY || process.env.VITE_FMP_KEY || process.env.FMP_KEY;

const withKey = (path) => {
  const key = getKey();
  if (!key) throw new HttpError("FMP_API_KEY missing", 500);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}apikey=${key}`;
};

export async function fetchEtfNews(limit = 20) {
  const clamped = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return fetchJson(withKey(`${BASE_URL}/v3/stock_news?limit=${clamped}`), { timeoutMs: 7000, retries: 1 });
}

export async function fetchHistoricalMarketCap(symbol) {
  const data = await fetchJson(withKey(`${BASE_URL}/v3/historical-market-capitalization/${symbol}`), {
    timeoutMs: 7000,
    retries: 1,
  });
  let list = [];
  if (Array.isArray(data?.historical)) list = data.historical;
  else if (Array.isArray(data)) list = data;
  return list
    .map((row) => ({
      date: row.date || row.dateTime || row.timestamp || row.calendarDate,
      value: Number(row.marketCap || row.aum || row.value || row.nav) || 0,
    }))
    .filter((entry) => entry.date);
}

export const fetchEtfHoldingsSeries = async (symbol) => {
  const history = await fetchHistoricalMarketCap(symbol);
  return history.map((row) => ({ date: row.date, aumUsd: row.value }));
};
