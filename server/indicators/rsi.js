export function rsi(values, period = 14) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const deltas = values.slice(1).map((c, i) => c - values[i]);
  let gains = 0;
  let losses = 0;
  deltas.slice(0, period).forEach((d) => {
    if (d >= 0) gains += d;
    else losses -= d;
  });
  const result = Array(values.length).fill(50);
  let avgGain = gains / period;
  let avgLoss = losses / period || 1;
  for (let i = period; i < deltas.length; i += 1) {
    const delta = deltas[i];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period || 1;
    const rs = avgGain / avgLoss;
    result[i + 1] = 100 - 100 / (1 + rs);
  }
  return result;
}
