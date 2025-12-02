import { fetchJson } from "../http.js";

const BASE_URL = "https://api.coinstats.app/public/v1";

export async function fetchCoinstatsFlows() {
  const data = await fetchJson(`${BASE_URL}/etf/flows`, { timeoutMs: 7000, retries: 1 });
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function fetchCoinstatsNews({ skip = 0, limit = 15 } = {}) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  const data = await fetchJson(`${BASE_URL}/news?${params.toString()}`, { timeoutMs: 6000, retries: 1 });
  return data?.news || [];
}

export async function fetchCoinstatsHoldingsSnapshot() {
  const rows = await fetchCoinstatsFlows();
  return rows.map((row) => ({
    symbol: (row.symbol || row.ticker || "").toUpperCase(),
    date: row.date || row.time || new Date().toISOString(),
    aumUsd: Number(row.aum || row.nav || row.value || 0),
    shares: Number(row.share || row.shares || row.qty || 0) || null,
    netFlowUsd: Number(row.net || row.inflow || row.value || 0),
  }));
}
