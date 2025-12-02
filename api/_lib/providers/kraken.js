import { fetchJson } from "../http.js";

export async function fetchKrakenOhlc(pair = "XXBTZUSD", interval = 60, limit = 120) {
  const safeLimit = Math.min(Math.max(Number(limit) || 120, 10), 720);
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${interval}`;
  const data = await fetchJson(url, { timeoutMs: 9000, retries: 1 });
  const key = Object.keys(data?.result || {}).find((k) => k !== "last");
  const series = data?.result?.[key] || [];
  return series.slice(-safeLimit).map((row) => ({
    time: Number(row[0]) || 0,
    open: Number(row[1]) || 0,
    high: Number(row[2]) || 0,
    low: Number(row[3]) || 0,
    close: Number(row[4]) || 0,
    volume: Number(row[6]) || 0,
    provider: "kraken",
  }));
}
