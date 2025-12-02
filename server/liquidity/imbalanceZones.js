export function detectImbalanceZones(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const zones = [];
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const current = candles[i];
    if (!prev || !current) continue;
    const bodyPrev = Math.abs((prev.close ?? 0) - (prev.open ?? 0));
    const bodyCurr = Math.abs((current.close ?? 0) - (current.open ?? 0));
    const wickPrev = Math.abs((prev.high ?? 0) - (prev.low ?? 0));
    const wickCurr = Math.abs((current.high ?? 0) - (current.low ?? 0));
    const imbalance = (bodyPrev + bodyCurr) / Math.max(1, wickPrev + wickCurr);
    if (imbalance > 0.6) {
      zones.push({
        time: current.time ?? 0,
        high: Math.max(prev.high ?? 0, current.high ?? 0),
        low: Math.min(prev.low ?? 0, current.low ?? 0),
        side: current.close > current.open ? "buy" : "sell",
      });
    }
  }
  return zones;
}
