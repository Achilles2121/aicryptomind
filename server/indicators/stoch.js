export function stochastic(candles, period = 14, smoothing = 3) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { k: [], d: [] };
  }
  const values = [];
  for (let i = period; i <= candles.length; i += 1) {
    const slice = candles.slice(i - period, i);
    const high = Math.max(...slice.map((c) => c.high ?? 0));
    const low = Math.min(...slice.map((c) => c.low ?? 0));
    const lastClose = slice[slice.length - 1]?.close ?? 0;
    const k = high === low ? 50 : ((lastClose - low) / (high - low)) * 100;
    values.push(k);
  }
  const d = smooth(values, smoothing);
  return { k: values, d };
}

function smooth(values, period) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const out = [];
  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - period + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(avg);
  }
  return out;
}
