import { ema } from "./ema.js";

export function macd(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { macdLine: [], signal: [], histogram: [] };
  }
  const ema12 = ema(values, 12);
  const ema26 = ema(values, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macdLine, 9);
  const histogram = macdLine.map((v, i) => v - signal[i]);
  return { macdLine, signal, histogram };
}
