export function detectWhaleMoves(candles = [], thresholdMultiplier = 3) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const volumes = candles.map((c) => c.volume ?? 0);
  const avg =
    volumes.reduce((a, b) => a + b, 0) / (volumes.length || 1);
  const threshold = avg * thresholdMultiplier;
  const alerts = [];
  candles.forEach((candle) => {
    const volume = candle.volume ?? 0;
    if (volume >= threshold) {
      alerts.push({
        time: candle.time ?? 0,
        side: (candle.close ?? 0) >= (candle.open ?? 0) ? "buy" : "sell",
        volume,
        price: candle.close ?? candle.high ?? candle.low ?? 0,
      });
    }
  });
  return alerts;
}
