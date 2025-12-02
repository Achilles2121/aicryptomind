export function detectFairValueGaps(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  const gaps = [];
  for (let i = 2; i < candles.length; i += 1) {
    const a = candles[i - 2];
    const b = candles[i - 1];
    const c = candles[i];
    if (!a || !b || !c) continue;
    const bullishGap = (a.high ?? 0) < (c.low ?? 0) && (b.low ?? 0) > (a.high ?? 0);
    const bearishGap = (a.low ?? 0) > (c.high ?? 0) && (b.high ?? 0) < (a.low ?? 0);
    if (bullishGap || bearishGap) {
      gaps.push({
        start: b.time ?? 0,
        end: c.time ?? 0,
        upper: Math.max(a.high ?? 0, b.high ?? 0, c.high ?? 0),
        lower: Math.min(a.low ?? 0, b.low ?? 0, c.low ?? 0),
        type: bullishGap ? "bullish" : "bearish",
      });
    }
  }
  return gaps;
}
