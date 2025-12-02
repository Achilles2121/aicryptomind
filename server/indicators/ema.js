export function ema(values, period = 14) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const k = 2 / (period + 1);
  const out = [];
  values.forEach((value, idx) => {
    if (idx === 0) {
      out.push(value);
    } else {
      const prev = out[idx - 1];
      out.push(value * k + prev * (1 - k));
    }
  });
  return out;
}
