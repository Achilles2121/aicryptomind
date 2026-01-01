import { safeFixed } from "./safeFixed";

export const computeZ = (values = []) => {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length || 1;
  const std = Math.sqrt(variance) || 1;
  const last = values.at(-1) ?? 0;
  return (last - mean) / std;
};

export const normalizeScore = (value) => {
  const clipped = Math.max(-3, Math.min(3, value));
  return Number(safeFixed(0.5 + clipped / 6, 4));
};

export const mapDerivativesRiskLevel = (score) => {
  if (!Number.isFinite(score)) return "neutral";
  if (score >= 1.2) return "hot";
  if (score <= -1) return "cool";
  return "neutral";
};

export const computeDerivativesComposite = (fundingDelta = [], oiDelta = []) => {
  const fundingZ = computeZ(fundingDelta.filter((v) => Number.isFinite(v)));
  const oiZ = computeZ(oiDelta.filter((v) => Number.isFinite(v)));
  const composite = 0.6 * oiZ + 0.4 * fundingZ;
  const score = normalizeScore(composite);
  const riskLevel = mapDerivativesRiskLevel(composite);
  return { fundingZ, oiZ, composite, score, riskLevel };
};
