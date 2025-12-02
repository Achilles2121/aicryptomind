export function atr(candles, period = 14) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const trs = [];
  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prevClose = candles[i - 1]?.close ?? current.close ?? 0;
    const tr = Math.max(
      (current.high ?? 0) - (current.low ?? 0),
      Math.abs((current.high ?? 0) - prevClose),
      Math.abs((current.low ?? 0) - prevClose)
    );
    trs.push(tr);
  }
  if (trs.length === 0) return [];
  const out = [];
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(prev);
  for (let i = period; i < trs.length; i += 1) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out.push(prev);
  }
  return out;
}
