/**
 * Weekly Strategy Optimization Cron Job
 * Vision AI Mind - Vision AI Mind
 * 
 * Runs every Sunday at 00:00 UTC via Vercel Cron
 * Re-optimizes strategies for all major assets
 * 
 * Schedule: 0 0 * * 0 (Every Sunday midnight UTC)
 */

// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Assets to optimize
const ASSETS_TO_OPTIMIZE = ['BTC', 'ETH', 'SPX', 'DAX', 'Gold', 'EURUSD'];

interface OptimizationResult {
  asset: string;
  previousWinRate: number;
  newWinRate: number;
  improvement: number;
  bestStrategy: any;
  timestamp: number;
}

// Simple in-memory storage for strategy parameters
// In production, use a proper database (e.g., Vercel KV, Supabase)
const STRATEGY_CACHE: Record<string, { strategy: any; winRate: number; updatedAt: number }> = {};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Verify cron secret (Vercel automatically adds this header for cron jobs)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  // Allow direct calls in development or with correct secret
  const isAuthorized =
    process.env.NODE_ENV === 'development' ||
    !cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    req.query.secret === cronSecret;

  if (!isAuthorized) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  console.log('[Cron] Starting weekly strategy optimization...');
  console.log(`[Cron] Timestamp: ${new Date().toISOString()}`);

  const results: OptimizationResult[] = [];
  const errors: { asset: string; error: string }[] = [];

  // Calculate date range (last 6 months)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const asset of ASSETS_TO_OPTIMIZE) {
    try {
      console.log(`[Cron] Optimizing ${asset}...`);

      // Get previous win rate from cache
      const previousData = STRATEGY_CACHE[asset];
      const previousWinRate = previousData?.winRate || 55; // Default baseline

      // Call optimize API internally
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset,
          startDate,
          endDate,
          quickMode: false, // Full grid search on cron
        }),
      });

      if (!response.ok) {
        throw new Error(`Optimize API returned ${response.status}`);
      }

      const optimizationData = await response.json();

      if (optimizationData.bestStrategy) {
        const newWinRate = optimizationData.bestStrategy.winRate;

        // Store optimized strategy in cache
        STRATEGY_CACHE[asset] = {
          strategy: optimizationData.bestStrategy.strategy,
          winRate: newWinRate,
          updatedAt: Date.now(),
        };

        results.push({
          asset,
          previousWinRate,
          newWinRate,
          improvement: parseFloat((newWinRate - previousWinRate).toFixed(1)),
          bestStrategy: optimizationData.bestStrategy.strategy,
          timestamp: Date.now(),
        });

        console.log(`[Cron] ${asset}: ${previousWinRate}% -> ${newWinRate}% (${newWinRate > previousWinRate ? '+' : ''}${(newWinRate - previousWinRate).toFixed(1)}%)`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Cron] Failed to optimize ${asset}:`, errorMessage);
      errors.push({ asset, error: errorMessage });
    }
  }

  // Calculate summary
  const summary = {
    totalAssets: ASSETS_TO_OPTIMIZE.length,
    successfulOptimizations: results.length,
    failedOptimizations: errors.length,
    avgImprovement: results.length > 0
      ? parseFloat((results.reduce((sum, r) => sum + r.improvement, 0) / results.length).toFixed(1))
      : 0,
    avgNewWinRate: results.length > 0
      ? parseFloat((results.reduce((sum, r) => sum + r.newWinRate, 0) / results.length).toFixed(1))
      : 0,
  };

  console.log('[Cron] Optimization complete!');
  console.log(`[Cron] Summary: ${summary.successfulOptimizations}/${summary.totalAssets} assets optimized`);
  console.log(`[Cron] Average Win-Rate: ${summary.avgNewWinRate}% (${summary.avgImprovement >= 0 ? '+' : ''}${summary.avgImprovement}%)`);

  res.status(200).json({
    success: true,
    message: 'Weekly optimization complete',
    executedAt: new Date().toISOString(),
    summary,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

// Export optimized strategies for other APIs to use
export function getOptimizedStrategy(asset: string): any | null {
  const cached = STRATEGY_CACHE[asset];
  if (!cached) return null;

  // Check if strategy is stale (older than 7 days)
  const isStale = Date.now() - cached.updatedAt > 7 * 24 * 60 * 60 * 1000;
  if (isStale) {
    console.log(`[Strategy] Cached strategy for ${asset} is stale`);
  }

  return cached.strategy;
}

export function getOptimizedWinRate(asset: string): number | null {
  return STRATEGY_CACHE[asset]?.winRate || null;
}


