/**
 * @param {{candles?: Array<any>, newsScore?: number, socialScore?: number}} params
 */
export function computeSentiment({ candles = [], newsScore = 0, socialScore = 0 }) {
  if (!Array.isArray(candles)) {
    return { fearGreed: 50, sentiment: 0 };
  }
  const closes = candles.map((c) => c.close ?? 0);
  const change = closes.length > 1 ? (closes[closes.length - 1] - closes[0]) / Math.max(1, closes[0]) : 0;
  const momentum = closes.slice(-10).reduce((a, b, i, arr) => (i === 0 ? 0 : a + (arr[i] - arr[i - 1])), 0);
  const priceScore = Math.max(-20, Math.min(20, change * 100));
  const momentumScore = Math.max(-15, Math.min(15, momentum / 10));
  const combined = priceScore + momentumScore + newsScore * 0.4 + socialScore * 0.6;
  const sentiment = Math.max(-100, Math.min(100, combined));
  const fearGreed = Math.max(0, Math.min(100, 50 + sentiment / 2));
  return { fearGreed, sentiment };
}
