/**
 * @param {Array<any>} candles
 */
export function detectAnomalies(candles = []) {
  if (!Array.isArray(candles) || candles.length === 0) {
    return { anomalyScore: 0, volumeSpikes: [], spreadAnomalies: [] };
  }
  const volumes = candles.map((c) => c.volume ?? 0);
  const highs = candles.map((c) => c.high ?? 0);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volumeSpikes = candles
    .map((c, idx) => ({ idx, volume: c.volume ?? 0, time: c.time ?? 0 }))
    .filter((c) => c.volume >= avgVolume * 2);

  const spreadAnomalies = candles
    .map((c, idx) => ({ idx, spread: (c.high ?? 0) - (c.low ?? 0), time: c.time ?? 0 }))
    .filter((c) => c.spread > Math.max(...highs) * 0.01);

  const anomalyScore = Math.max(0, Math.min(100, (volumeSpikes.length + spreadAnomalies.length) * 10));
  return { anomalyScore, volumeSpikes, spreadAnomalies };
}
