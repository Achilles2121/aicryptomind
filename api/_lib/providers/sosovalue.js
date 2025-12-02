import { fetchJson } from "../http.js";

const BASE_URL = "https://sosovalue.com/api/v1";

export async function fetchSosoEtfFlow() {
  const data = await fetchJson(`${BASE_URL}/etf/flow`, { timeoutMs: 7000, retries: 1 });
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export async function fetchSosoHoldingsSnapshot() {
  const rows = await fetchSosoEtfFlow();
  return rows.map((row) => ({
    symbol: (row.code || row.symbol || row.ticker || "").toUpperCase(),
    date: row.date || row.time || row.update || new Date().toISOString(),
    aumUsd: Number(row.aum || row.nav || row.market_cap || row.value || 0),
    shares: Number(row.share || row.shares || row.qty || row.quantity || 0) || null,
    netFlowUsd: Number(row.net || row.netFlow || row.net_inflow || row.inflow || row.value || 0),
  }));
}
