export const clampNumber = (value, { min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
  if (Number.isNaN(Number(value))) return min;
  return Math.min(Math.max(Number(value), min), max);
};

export const mapBinanceInterval = (minutes = 60) => {
  const map = {
    1: "1m",
    3: "3m",
    5: "5m",
    15: "15m",
    30: "30m",
    60: "1h",
    120: "2h",
    240: "4h",
    360: "6h",
    720: "12h",
    1440: "1d",
  };
  return map[minutes] || "1h";
};

export const normalizeCandles = (rows = []) =>
  rows.map((row) => ({
    time: row.time || Math.floor((row.openTime || row.closeTime || Date.now()) / 1000),
    open: Number(row.open) || 0,
    high: Number(row.high) || 0,
    low: Number(row.low) || 0,
    close: Number(row.close) || 0,
    volume: Number(row.volume ?? row.vol) || 0,
    provider: row.provider || "unknown",
  }));
