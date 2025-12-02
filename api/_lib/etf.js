const dateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const lastNDates = (n) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

export const fillSeries = (points = [], days = 30) => {
  const map = new Map();
  for (const point of points) {
    const key = dateKey(point.date);
    if (!key) continue;
    map.set(key, { ...point, date: key });
  }
  return lastNDates(days).map((day) => map.get(day) || { date: day, aumUsd: 0, shares: null });
};

export const fillFlowSeries = (points = [], days = 30) => {
  const map = new Map();
  for (const point of points) {
    const key = dateKey(point.date);
    if (!key) continue;
    map.set(key, { ...point, date: key });
  }
  return lastNDates(days).map((day) => map.get(day) || { date: day, netFlowUsd: 0, aumUsd: null });
};

export const computeChange = (series, window) => {
  if (!Array.isArray(series) || !series.length) return null;
  const sorted = [...series].sort((a, b) => new Date(a.date) - new Date(b.date));
  const last = sorted.at(-1)?.aumUsd;
  const past = sorted.at(-Math.min(window, sorted.length))?.aumUsd;
  if (!Number.isFinite(last) || !Number.isFinite(past)) return null;
  return last - past;
};

export const sumRange = (points, days) =>
  points.slice(-days).reduce((acc, point) => acc + (Number.isFinite(point.netFlowUsd) ? point.netFlowUsd : 0), 0);

export const normalizeFlowRow = (row = {}) => ({
  symbol: (row.symbol || row.ticker || row.code || "").toUpperCase(),
  date: row.date || row.time || row.updatedAt || new Date().toISOString(),
  netFlowUsd: Number(row.netFlowUsd || row.net_flow || row.net_inflow || row.flow || row.net || row.value || 0),
  aumUsd: Number(row.aumUsd || row.aum || row.nav || row.marketCap || 0) || null,
});

export const computeFlowsFromAum = (series = []) => {
  if (!Array.isArray(series) || series.length < 2) return [];
  const sorted = [...series].sort((a, b) => new Date(a.date) - new Date(b.date));
  const flows = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    flows.push({
      date: curr.date,
      netFlowUsd: Number(curr.value ?? curr.aumUsd ?? 0) - Number(prev.value ?? prev.aumUsd ?? 0),
      aumUsd: Number(curr.value ?? curr.aumUsd ?? 0),
    });
  }
  return flows;
};

export const upsertMarketShare = (holdings = []) => {
  const total = holdings.reduce((acc, holding) => acc + (Number.isFinite(holding.aumUsd) ? holding.aumUsd : 0), 0);
  if (total <= 0) return holdings;
  return holdings.map((holding) => ({
    ...holding,
    marketShare: holding.aumUsd ? (holding.aumUsd / total) * 100 : null,
  }));
};
