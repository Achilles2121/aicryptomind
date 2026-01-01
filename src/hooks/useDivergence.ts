/**
 * Vision AI Mind - Divergence Detection Hook
 * 
 * React Hook für die Erkennung von Preis-Indikator Divergenzen.
 * Erkennt Regular und Hidden Divergenzen für RSI und MACD.
 * 
 * Features:
 * - Automatische Divergenz-Analyse bei Candle-Updates
 * - Konfigurierbare Lookback-Periode
 * - Kombinierter Divergenz-Score
 * - Signal-Generierung bei starken Divergenzen
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import { useMemo } from 'react';
import { useCandleStore, type Timeframe } from '../stores/useCandleStore';
import { 
  analyzeDivergences, 
  type DivergenceAnalysis, 
  type DivergenceType,
  getDivergenceColor,
  getDivergenceIcon 
} from '../lib/divergenceEngine';

// ============================================
// TYPES
// ============================================

export interface DivergenceSignal {
  type: DivergenceType;
  direction: 'BULLISH' | 'BEARISH' | 'NONE';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  confidence: number;
  description: string;
  tradingAdvice: string;
}

export interface DivergenceHookResult {
  analysis: DivergenceAnalysis | null;
  signal: DivergenceSignal | null;
  isLoading: boolean;
  hasDivergence: boolean;
  
  // Quick access
  rsiDivergence: DivergenceType | null;
  macdDivergence: DivergenceType | null;
  combinedScore: number;
  
  // Helpers
  getColor: () => string;
  getIcon: () => string;
}

export interface UseDivergenceOptions {
  lookbackPeriod?: number;
  minConfidence?: number;
  rsiPeriod?: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDivergenceDirection = (type: DivergenceType | null): 'BULLISH' | 'BEARISH' | 'NONE' => {
  if (!type || type === 'none') return 'NONE';
  if (type.includes('bullish')) return 'BULLISH';
  if (type.includes('bearish')) return 'BEARISH';
  return 'NONE';
};

const getDivergenceStrength = (confidence: number): 'STRONG' | 'MODERATE' | 'WEAK' => {
  if (confidence >= 80) return 'STRONG';
  if (confidence >= 60) return 'MODERATE';
  return 'WEAK';
};

const generateDescription = (analysis: DivergenceAnalysis): string => {
  const parts: string[] = [];
  
  if (analysis.rsiDivergence && analysis.rsiDivergence.detected) {
    const rsiType = analysis.rsiDivergence.type.replace('_', ' ');
    parts.push(`RSI ${rsiType} (${Math.round(analysis.rsiDivergence.confidence * 100)}% confidence)`);
  }
  
  if (analysis.macdDivergence && analysis.macdDivergence.detected) {
    const macdType = analysis.macdDivergence.type.replace('_', ' ');
    parts.push(`MACD ${macdType} (${Math.round(analysis.macdDivergence.confidence * 100)}% confidence)`);
  }
  
  if (parts.length === 0) {
    return 'No divergence detected';
  }
  
  return parts.join(' | ');
};

const generateTradingAdvice = (analysis: DivergenceAnalysis): string => {
  const { combined, rsiDivergence, macdDivergence } = analysis;
  
  if (!combined.hasDivergence) {
    return 'No divergence signals - follow trend direction';
  }
  
  // Both indicators show divergence
  if (rsiDivergence.detected && macdDivergence.detected) {
    const rsiDir = getDivergenceDirection(rsiDivergence.type);
    const macdDir = getDivergenceDirection(macdDivergence.type);
    
    if (rsiDir === macdDir) {
      if (rsiDir === 'BULLISH') {
        return `🟢 STRONG BULLISH DIVERGENCE: Price reversal to upside likely. Consider long entries. Combined confidence: ${Math.round(combined.confidence * 100)}%`;
      } else {
        return `🔴 STRONG BEARISH DIVERGENCE: Price reversal to downside likely. Consider short entries or take profits. Combined confidence: ${Math.round(combined.confidence * 100)}%`;
      }
    } else {
      return `⚠️ MIXED DIVERGENCE: RSI shows ${rsiDir}, MACD shows ${macdDir}. Wait for confirmation.`;
    }
  }
  
  // Only RSI divergence
  if (rsiDivergence.detected) {
    const dir = getDivergenceDirection(rsiDivergence.type);
    const isHidden = rsiDivergence.type.includes('hidden');
    
    if (dir === 'BULLISH') {
      return isHidden
        ? `📈 Hidden bullish RSI divergence - trend continuation expected. Look for pullback entries.`
        : `📈 Regular bullish RSI divergence - potential reversal. Wait for price confirmation.`;
    } else {
      return isHidden
        ? `📉 Hidden bearish RSI divergence - downtrend continuation expected.`
        : `📉 Regular bearish RSI divergence - potential top forming.`;
    }
  }
  
  // Only MACD divergence
  if (macdDivergence.detected) {
    const dir = getDivergenceDirection(macdDivergence.type);
    const isHidden = macdDivergence.type.includes('hidden');
    
    if (dir === 'BULLISH') {
      return isHidden
        ? `📈 Hidden bullish MACD divergence - momentum supports uptrend continuation.`
        : `📈 Regular bullish MACD divergence - momentum weakening in downtrend.`;
    } else {
      return isHidden
        ? `📉 Hidden bearish MACD divergence - momentum supports downtrend continuation.`
        : `📉 Regular bearish MACD divergence - momentum weakening in uptrend.`;
    }
  }
  
  return 'Monitor for developing divergence patterns';
};

// ============================================
// HOOK
// ============================================

export function useDivergence(
  assetId: string,
  timeframe: Timeframe = '1h',
  options: UseDivergenceOptions = {}
): DivergenceHookResult {
  const { 
    lookbackPeriod = 50, 
    minConfidence = 50,
    rsiPeriod = 14 
  } = options;
  
  // Get candle data from store
  const getCandles = useCandleStore((state) => state.getCandles);
  const candles = getCandles(assetId, timeframe);
  
  // Analyze divergences
  const analysis = useMemo((): DivergenceAnalysis | null => {
    if (!candles || candles.length < lookbackPeriod) {
      return null;
    }
    
    // Get last N candles for analysis
    const recentCandles = candles.slice(-lookbackPeriod);
    
    try {
      return analyzeDivergences(recentCandles, {
        swingLookback: Math.min(lookbackPeriod, 30), // Swing point lookback
        rsiPeriod,
      });
    } catch (error) {
      console.error('[useDivergence] Analysis error:', error);
      return null;
    }
  }, [candles, lookbackPeriod, rsiPeriod]);
  
  // Generate trading signal
  const signal = useMemo((): DivergenceSignal | null => {
    if (!analysis || !analysis.combined.hasDivergence) {
      return null;
    }
    
    if (analysis.combined.confidence * 100 < minConfidence) {
      return null;
    }
    
    const primaryDivergence = analysis.rsiDivergence.detected ? analysis.rsiDivergence : analysis.macdDivergence;
    if (!primaryDivergence.detected) return null;
    
    return {
      type: primaryDivergence.type,
      direction: getDivergenceDirection(primaryDivergence.type),
      strength: getDivergenceStrength(analysis.combined.confidence * 100),
      confidence: analysis.combined.confidence * 100,
      description: generateDescription(analysis),
      tradingAdvice: generateTradingAdvice(analysis),
    };
  }, [analysis, minConfidence]);
  
  // Check if there's a divergence
  const hasDivergence = analysis?.combined.hasDivergence ?? false;
  const combinedScore = (analysis?.combined.confidence ?? 0) * 100;
  
  return {
    analysis,
    signal,
    isLoading: !candles || candles.length === 0,
    hasDivergence,
    
    // Quick access
    rsiDivergence: analysis?.rsiDivergence?.detected ? analysis.rsiDivergence.type : null,
    macdDivergence: analysis?.macdDivergence?.detected ? analysis.macdDivergence.type : null,
    combinedScore,
    
    // Helpers
    getColor: () => {
      if (!hasDivergence) return '#6B7280'; // gray
      const primaryType = analysis?.rsiDivergence?.detected 
        ? analysis.rsiDivergence.type 
        : analysis?.macdDivergence?.type;
      return primaryType && primaryType !== 'none' ? getDivergenceColor(primaryType) : '#6B7280';
    },
    getIcon: () => {
      if (!hasDivergence) return '➖';
      const primaryType = analysis?.rsiDivergence?.detected 
        ? analysis.rsiDivergence.type 
        : analysis?.macdDivergence?.type;
      return primaryType && primaryType !== 'none' ? getDivergenceIcon(primaryType) : '➖';
    },
  };
}

export default useDivergence;
