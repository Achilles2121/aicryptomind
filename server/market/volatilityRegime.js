/**
 * @param {Array<any>} candles
 */
export function assessRegime(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { regimeScore: 0.5, regimeLabel: "neutral" };
  }
  const closes = candles.map((c) => c.close ?? 0);
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    returns.push(Math.log(Math.max(1e-6, closes[i] / Math.max(1e-6, closes[i - 1]))));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(returns.length, 1);
  const variance =
    returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(returns.length, 1);
  const vol = Math.sqrt(Math.max(variance, 0)) * Math.sqrt(252);
  const normalized = Math.max(0, Math.min(1, vol / 1.5)); // scale
  const regimeScore = Number(normalized.toFixed(2));
  const regimeLabel =
    regimeScore > 0.66 ? "high-vol" : regimeScore < 0.33 ? "low-vol" : "neutral";
  return { regimeScore, regimeLabel };
}
