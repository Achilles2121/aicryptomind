export function buildLiquidityHeatmap(candles = [], buckets = 10) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const highs = candles.map((c) => c.high ?? 0);
  const lows = candles.map((c) => c.low ?? 0);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  if (max === min) return [];

  const step = (max - min) / buckets;
  const heatmap = Array.from({ length: buckets }, (_, idx) => {
    const start = min + idx * step;
    const end = start + step;
    return {
      level: Number(((start + end) / 2).toFixed(2)),
      liquidity: 0,
    };
  });

  candles.forEach((candle) => {
    const volume = candle.volume ?? 0;
    const mid = ((candle.high ?? 0) + (candle.low ?? 0)) / 2;
    const index = Math.min(
      heatmap.length - 1,
      Math.max(0, Math.floor(((mid - min) / (max - min)) * buckets))
    );
    heatmap[index].liquidity += volume;
  });

  const maxLiquidity = Math.max(...heatmap.map((h) => h.liquidity));
  return heatmap.map((h) => ({
    ...h,
    intensity: maxLiquidity ? Number((h.liquidity / maxLiquidity).toFixed(3)) : 0,
  }));
}
