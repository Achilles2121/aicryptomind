/**
 * @param {Array<any>} candles
 */
export function scanLiquidations(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const levels = [];
  const closes = candles.map((c) => c.close ?? 0);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const std =
    Math.sqrt(
      closes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(closes.length, 1)
    ) || 1;
  const bands = [mean - std, mean, mean + std];
  bands.forEach((level, idx) => {
    levels.push({
      price: Number(level.toFixed(2)),
      size: Math.max(1, Math.round(std * (idx + 1))),
      side: idx < 1 ? "long" : idx > 1 ? "short" : "mixed",
    });
  });
  return levels;
}
