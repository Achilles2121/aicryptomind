import assert from "node:assert";
import { computeStopAndTarget, computePositionSize, computeDailyRiskGate } from "../src/lib/riskEngine.js";
import { buildFundamentalSnapshot, computeFundamentalScore } from "../src/lib/fundamentals.js";
import { computeEdgeScore } from "../src/lib/strategyEngineV3.js";
import { fetchEtfSeriesSafe } from "../api/etf/correlations.ts";
import { computeDerivativesComposite, mapDerivativesRiskLevel } from "../src/lib/derivativesRisk.js";

// Stop/Target
{
  const { sl, tp, rr } = computeStopAndTarget({ entry: 100, direction: "long", atrPct: 2, regimeLabel: "Bull", setupType: "trend" });
  assert.ok(sl < 100 && tp > 100, "Stops should bracket entry");
  assert.ok(rr > 0, "RR should be positive");
}

// Position size
{
  const size = computePositionSize({ equity: 10000, riskPct: 0.01, entry: 100, sl: 97 });
  assert.ok(size > 0, "Position size should be positive");
}

// Daily gate
{
  const gate = computeDailyRiskGate({ dayPnlPct: -0.05, limitPct: -0.03 });
  assert.strictEqual(gate.allowed, false, "Gate should block beyond limit");
}

// Fundamentals
{
  const snapshot = buildFundamentalSnapshot({ volumeSpike: 1, atrPct: 1 }, { riskLevel: "neutral" });
  const score = computeFundamentalScore(snapshot);
  assert.ok(score >= 0 && score <= 1, "Fundamental score within bounds");
}

// Derivatives risk mapping
{
  const composite = computeDerivativesComposite([0, 1, 2], [0, 2, 4]);
  assert.ok(mapDerivativesRiskLevel(composite.composite) !== undefined, "Risk level computed");
}

// EdgeScore reacts to fundamentals
{
  const high = computeEdgeScore({ technical: 0.8, fundamental: 0.9, liquidity: 0.9 });
  const low = computeEdgeScore({ technical: 0.8, fundamental: 0.2, liquidity: 0.2 });
  assert.ok(high > low, "EdgeScore should decrease with weak fundamentals");
  assert.ok(high <= 1 && high >= 0 && low >= 0, "EdgeScore within [0,1]");
}

// ETF fallback (no key) returns empty data without throw
{
  const trackerMock = { set: () => {}, toArray: () => [] };
  const res = await fetchEtfSeriesSafe("IBIT", trackerMock, { forceMock: true });
  assert.ok(Array.isArray(res), "ETF fallback returns array");
  assert.strictEqual(res.length, 0, "ETF fallback returns empty series when mocked");
}

console.log("Engine unit checks passed.");
