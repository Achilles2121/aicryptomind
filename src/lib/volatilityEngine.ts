/**
 * Volatility Engine - Client-Side
 * Vision AI Mind - VisionAIMnd
 * 
 * Client-side volatility analysis with:
 * - API caching (1 minute TTL)
 * - Signal adjustment based on volatility
 * - Adaptive TP/SL calculation
 * - Win-rate optimization logic
 */

import { safeFixed } from "./safeFixed";

// ============================================
// TYPES
// ============================================

export interface VolatilityMetrics {
  atr: number;
  atrPercent: number;
  bollingerBandwidth: number;
  historicalVol: number;
  garchForecast4h: number;
  garchForecast24h: number;
}

export interface VolatilityData {
  symbol: string;
  timestamp: number;
  volatilityScore: number;
  metrics: VolatilityMetrics;
  classification: 'LOW' | 'MED' | 'HIGH' | 'EXTREME';
  recommendation: 'TRADE' | 'WAIT' | 'CAUTION';
  confidence: number;
  assetType: string;
  sentiment?: {
    fearGreed: number | null;
    fundingRate: number | null;
    liquidations24h: number | null;
  };
}

export interface Signal {
  action: string;
  direction?: string;
  reason: string;
  reasoning?: string[];
  confidence: number;
  entry?: number;
  tp: number | null;
  sl: number | null;
  volatility?: VolatilityData;
  meta?: Record<string, unknown>;
}

export interface AdaptiveTPSL {
  tp: number;
  sl: number;
  tpPercent: number;
  slPercent: number;
  ratio: number;
}

// ============================================
// VOLATILITY ENGINE CLASS
// ============================================

class VolatilityEngineClass {
  private cache: Map<string, { data: VolatilityData; timestamp: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache
  private pendingRequests: Map<string, Promise<VolatilityData>> = new Map();

  /**
   * Fetch volatility data for a symbol
   */
  async getVolatility(
    symbol: string,
    interval: string = '1h',
    lookback: number = 100
  ): Promise<VolatilityData> {
    const cacheKey = `${symbol}-${interval}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Prevent duplicate requests
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    // Fetch fresh data
    const request = this.fetchVolatility(symbol, interval, lookback);
    this.pendingRequests.set(cacheKey, request);

    try {
      const data = await request;
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Internal fetch method
   */
  private async fetchVolatility(
    symbol: string,
    interval: string,
    lookback: number
  ): Promise<VolatilityData> {
    try {
      const url = `/api/volatility?symbol=${encodeURIComponent(symbol)}&interval=${interval}&lookback=${lookback}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Volatility API failed: ${response.status}`);
      }

      const data = await response.json();
      return data as VolatilityData;
    } catch (error) {
      console.error('[VolatilityEngine] Fetch failed:', error);
      // Return default data on error
      return this.getDefaultVolatility(symbol);
    }
  }

  /**
   * Default volatility data for fallback
   */
  private getDefaultVolatility(symbol: string): VolatilityData {
    return {
      symbol,
      timestamp: Date.now(),
      volatilityScore: 50,
      metrics: {
        atr: 0,
        atrPercent: 2,
        bollingerBandwidth: 4,
        historicalVol: 50,
        garchForecast4h: 2.5,
        garchForecast24h: 2.5,
      },
      classification: 'MED',
      recommendation: 'CAUTION',
      confidence: 0.5,
      assetType: 'crypto',
    };
  }

  /**
   * Adjust signal confidence based on volatility
   * This is the KEY function for improving win-rate
   */
  adjustSignalForVolatility(
    originalSignal: Signal,
    volData: VolatilityData
  ): Signal {
    const adjusted = { ...originalSignal };
    const reasoning: string[] = [...(originalSignal.reasoning || [])];

    switch (volData.classification) {
      case 'LOW':
        // Low volatility = stable market = higher confidence
        adjusted.confidence = Math.min(originalSignal.confidence * 1.15, 0.95);
        reasoning.push(`✅ Vol-Score: ${safeFixed(volData.volatilityScore, 0)} (niedrig) - Signal verstärkt`);
        reasoning.push('📊 Stabile Marktbedingungen - höhere Signalqualität');
        break;

      case 'MED':
        // Normal volatility = standard confidence
        reasoning.push(`⚖️ Vol-Score: ${safeFixed(volData.volatilityScore, 0)} (normal) - Standardsignal`);
        break;

      case 'HIGH':
        // High volatility = reduce confidence, consider waiting
        adjusted.confidence = originalSignal.confidence * 0.70;
        reasoning.push(`⚠️ Vol-Score: ${safeFixed(volData.volatilityScore, 0)} (hoch) - Signal abgeschwächt`);
        reasoning.push(`📈 ATR: ${safeFixed(volData.metrics.atrPercent, 2)}% - erhöhte Schwankungen`);

        // Force wait if confidence drops below 55%
        if (adjusted.confidence < 0.55) {
          adjusted.action = 'Warten';
          adjusted.direction = 'WAIT';
          reasoning.push('🛑 Warten empfohlen - Markt zu volatil für sicheres Trading');
        }
        break;

      case 'EXTREME':
        // Extreme volatility = ALWAYS wait
        adjusted.action = 'Warten';
        adjusted.direction = 'WAIT';
        adjusted.confidence = 0.20;
        adjusted.reason = 'EXTREME VOLATILITÄT - Kein Trading';

        // Clear reasoning and add warning
        reasoning.length = 0;
        reasoning.push('🚨 EXTREME VOLATILITÄT ERKANNT');
        reasoning.push(`Vol-Score: ${safeFixed(volData.volatilityScore, 0)}/100`);
        reasoning.push(`ATR: ${safeFixed(volData.metrics.atrPercent, 2)}% (${volData.classification})`);
        reasoning.push(`Prognose 4h: ${safeFixed(volData.metrics.garchForecast4h, 1)}% Volatilität`);
        reasoning.push('⏳ Trading-Pause bis Markt stabiler wird');
        reasoning.push('💡 Check zurück in 4-6 Stunden');

        // Add sentiment if available
        if (volData.sentiment?.fearGreed !== undefined && volData.sentiment?.fearGreed !== null) {
          reasoning.push(`Fear & Greed: ${volData.sentiment.fearGreed}`);
        }
        break;
    }

    adjusted.reasoning = reasoning;
    adjusted.volatility = volData;

    return adjusted;
  }

  /**
   * Calculate adaptive TP/SL based on volatility
   * Wider stops in high vol, tighter in low vol
   */
  getAdaptiveTPSL(
    entry: number,
    volData: VolatilityData,
    direction: 'long' | 'short' = 'long'
  ): AdaptiveTPSL {
    // Base percentages
    let tpPercent = 0.04; // 4% default TP
    let slPercent = 0.025; // 2.5% default SL

    // Adjust based on volatility classification
    switch (volData.classification) {
      case 'LOW':
        // Low vol = tighter targets (market moves less)
        tpPercent = 0.03;
        slPercent = 0.018;
        break;

      case 'MED':
        // Normal vol = standard targets
        tpPercent = 0.04;
        slPercent = 0.025;
        break;

      case 'HIGH':
        // High vol = wider targets
        tpPercent = 0.055;
        slPercent = 0.035;
        break;

      case 'EXTREME':
        // Extreme vol = very wide targets (if trading at all)
        tpPercent = 0.08;
        slPercent = 0.05;
        break;
    }

    // Also adjust based on ATR percent directly
    const atrAdjustment = Math.max(0.5, Math.min(2, volData.metrics.atrPercent / 2));
    tpPercent *= atrAdjustment;
    slPercent *= atrAdjustment;

    // Calculate actual prices
    let tp: number;
    let sl: number;

    if (direction === 'long') {
      tp = entry * (1 + tpPercent);
      sl = entry * (1 - slPercent);
    } else {
      tp = entry * (1 - tpPercent);
      sl = entry * (1 + slPercent);
    }

    // Calculate R:R ratio
    const reward = Math.abs(tp - entry);
    const risk = Math.abs(entry - sl);
    const ratio = risk > 0 ? reward / risk : 1;

    return {
      tp: Math.round(tp * 100) / 100,
      sl: Math.round(sl * 100) / 100,
      tpPercent: Math.round(tpPercent * 10000) / 100,
      slPercent: Math.round(slPercent * 10000) / 100,
      ratio: Math.round(ratio * 100) / 100,
    };
  }

  /**
   * Get volatility-based position size recommendation
   */
  getPositionSizeMultiplier(volData: VolatilityData): number {
    switch (volData.classification) {
      case 'LOW':
        return 1.2; // Can use slightly larger position
      case 'MED':
        return 1.0; // Normal position size
      case 'HIGH':
        return 0.6; // Reduce position size
      case 'EXTREME':
        return 0.3; // Minimal position (or none)
      default:
        return 1.0;
    }
  }

  /**
   * Check if market is tradeable based on volatility
   */
  isTradeable(volData: VolatilityData): boolean {
    if (volData.classification === 'EXTREME') return false;
    if (volData.recommendation === 'WAIT') return false;
    if (volData.metrics.atrPercent > 5) return false;
    return true;
  }

  /**
   * Get volatility trend (increasing/decreasing)
   */
  getVolatilityTrend(volData: VolatilityData): 'increasing' | 'stable' | 'decreasing' {
    const current = volData.metrics.historicalVol;
    const forecast = volData.metrics.garchForecast4h;

    if (forecast > current * 1.15) return 'increasing';
    if (forecast < current * 0.85) return 'decreasing';
    return 'stable';
  }

  /**
   * Get alerts based on volatility state
   */
  getAlerts(volData: VolatilityData): string[] {
    const alerts: string[] = [];

    // Score-based alerts
    if (volData.volatilityScore >= 85) {
      alerts.push('🚨 EXTREME VOLATILITÄT: Trading pausieren!');
    } else if (volData.volatilityScore >= 70) {
      alerts.push('⚠️ Hohe Volatilität: Positionsgrößen reduzieren');
    }

    // ATR-based alerts
    if (volData.metrics.atrPercent > 4) {
      alerts.push('💥 ATR Spike: Starke Preisbewegungen aktiv');
    }

    // GARCH forecast alerts
    if (volData.metrics.garchForecast4h > 4) {
      alerts.push('📊 Volatilitäts-Anstieg in 4h erwartet');
    }

    // Sentiment alerts (for crypto)
    if (volData.sentiment) {
      if (volData.sentiment.fearGreed !== null && volData.sentiment.fearGreed < 25) {
        alerts.push('😱 Extreme Fear: Vorsicht bei Long-Positionen');
      }
      if (volData.sentiment.fearGreed !== null && volData.sentiment.fearGreed > 80) {
        alerts.push('🤑 Extreme Greed: Vorsicht bei FOMO-Trades');
      }
      if (volData.sentiment.fundingRate !== null && Math.abs(volData.sentiment.fundingRate) > 0.05) {
        alerts.push(`💰 Hohe Funding Rate: ${safeFixed(volData.sentiment.fundingRate, 3)}%`);
      }
    }

    // Trend alerts
    const trend = this.getVolatilityTrend(volData);
    if (trend === 'increasing') {
      alerts.push('📈 Volatilität steigt - Stops anpassen!');
    }

    return alerts;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const volatilityEngine = new VolatilityEngineClass();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get volatility color for UI
 */
export function getVolatilityColor(classification: string): string {
  switch (classification) {
    case 'LOW':
      return 'text-green-500';
    case 'MED':
      return 'text-yellow-500';
    case 'HIGH':
      return 'text-orange-500';
    case 'EXTREME':
      return 'text-red-500';
    default:
      return 'text-slate-400';
  }
}

/**
 * Get volatility background color for UI
 */
export function getVolatilityBgColor(classification: string): string {
  switch (classification) {
    case 'LOW':
      return 'bg-green-500/20';
    case 'MED':
      return 'bg-yellow-500/20';
    case 'HIGH':
      return 'bg-orange-500/20';
    case 'EXTREME':
      return 'bg-red-500/20';
    default:
      return 'bg-slate-500/20';
  }
}

/**
 * Get recommendation icon
 */
export function getRecommendationIcon(recommendation: string): string {
  switch (recommendation) {
    case 'TRADE':
      return '✅';
    case 'CAUTION':
      return '⚠️';
    case 'WAIT':
      return '🛑';
    default:
      return '❓';
  }
}

/**
 * Format volatility score for display
 */
export function formatVolatilityScore(score: number): string {
  return `${Math.round(score)}/100`;
}
