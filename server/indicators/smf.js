export function smartMoneyFlow(candles) {
  if (!Array.isArray(candles) || candles.length === 0) return 0;
  let flow = 0;
  candles.forEach((candle) => {
    const high = candle.high ?? 0;
    const low = candle.low ?? 0;
    const close = candle.close ?? 0;
    const volume = candle.volume ?? 0;
    const multiplier = high === low ? 0 : ((close - low) - (high - close)) / (high - low);
    flow += multiplier * volume;
  });
  return flow;
}
