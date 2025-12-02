export function detectOrderBlocks(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { buySide: [], sellSide: [] };
  }

  const buySide = [];
  const sellSide = [];

  for (let i = 2; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const current = candles[i];
    const before = candles[i - 2];
    if (!prev || !current || !before) continue;

    const isBullishBreaker =
      before.close < before.open &&
      prev.close > prev.open &&
      current.close > current.open &&
      current.close > before.high;
    if (isBullishBreaker) {
      buySide.push({
        start: prev.time ?? 0,
        end: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
      });
    }

    const isBearishBreaker =
      before.close > before.open &&
      prev.close < prev.open &&
      current.close < current.open &&
      current.close < before.low;
    if (isBearishBreaker) {
      sellSide.push({
        start: prev.time ?? 0,
        end: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
      });
    }
  }

  return { buySide, sellSide };
}
