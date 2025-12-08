// Minimal fundamental scaffolding to blend with the technical engine.

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const buildFundamentalSnapshot = (row = {}, derivativesRisk) => {
  const volumeSpike = Number.isFinite(row.volumeSpike) ? row.volumeSpike : null;
  const atrPct = Number.isFinite(row.atrPct) ? row.atrPct : null;
  const liquidityScore = volumeSpike !== null ? clamp01(volumeSpike / 1.5) : 0.5;
  const stabilityFromAtr = atrPct !== null ? clamp01(1 - Math.min(atrPct, 5) / 6) : 0.5;
  const derivativesPenalty = derivativesRisk?.riskLevel === "hot" ? 0.35 : derivativesRisk?.riskLevel === "cool" ? -0.05 : 0;
  const stabilityScore = clamp01(stabilityFromAtr - derivativesPenalty);

  return {
    liquidityScore,
    stabilityScore,
    narrativeScore: 0.5, // placeholder for future on-chain / sentiment integration
  };
};

export const fetchFundamentalSnapshot = async (symbol, context = {}) => {
  // Lightweight placeholder: derive from provided context (volume, spread, atrPct, derivativesRisk).
  // No external calls to keep dev/prod stable without extra deps.
  const { volume = null, spreadPct = null, atrPct = null, derivativesRisk } = context;
  const liquidityScore = clamp01(
    Number.isFinite(volume) && volume > 0
      ? Math.min(1, Math.log10(volume + 1) / 10) * (spreadPct ? clamp01(1 - Math.min(spreadPct, 5) / 5) : 1)
      : 0.5
  );
  const stabilityBase = Number.isFinite(atrPct) ? clamp01(1 - Math.min(atrPct, 5) / 6) : 0.5;
  const derivativesPenalty = derivativesRisk?.riskLevel === "hot" ? 0.35 : derivativesRisk?.riskLevel === "cool" ? -0.05 : 0;
  const stabilityScore = clamp01(stabilityBase - derivativesPenalty);
  return {
    symbol,
    liquidityScore,
    stabilityScore,
    narrativeScore: 0.5,
  };
};

export const computeFundamentalScore = (snapshot) => {
  if (!snapshot) return 0.5;
  const liquidity = clamp01(snapshot.liquidityScore ?? 0.5);
  const stability = clamp01(snapshot.stabilityScore ?? 0.5);
  const narrative = clamp01(snapshot.narrativeScore ?? 0.5);
  return clamp01(0.4 * liquidity + 0.45 * stability + 0.15 * narrative);
};
