/**
 * Vision AI Mind - Multi-Timeframe Confluence Card
 * 
 * Zeigt die Übereinstimmung der Signale über mehrere Timeframes an.
 * Starke Signale erfordern Konfluenz aus mindestens 3 Timeframes.
 * 
 * Copyright (c) 2025 Vision AI Mind. All rights reserved.
 */

import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useMultiTimeframe, getConfluenceLabel, getConfluenceColor } from '../hooks/useMultiTimeframe';
import { getTimeframeLabel } from '../lib/confluenceEngine';

const ConfluenceCard = memo(function ConfluenceCard({
  assetId,
  symbol,
  className = '',
}) {
  const { confluence, isLoading, hasAllTimeframes, availableTimeframes } = useMultiTimeframe({
    assetId,
    symbol,
    enabled: true,
  });
  
  // Determine icon and colors based on recommendation
  const { icon: RecommendationIcon, bgClass, textClass, borderClass } = useMemo(() => {
    if (!confluence) {
      return {
        icon: Minus,
        bgClass: 'bg-slate-500/10',
        textClass: 'text-slate-400',
        borderClass: 'border-slate-500/30',
      };
    }
    
    switch (confluence.recommendation) {
      case 'STRONG_BUY':
        return {
          icon: Zap,
          bgClass: 'bg-emerald-500/20',
          textClass: 'text-emerald-400',
          borderClass: 'border-emerald-500/50',
        };
      case 'BUY':
        return {
          icon: TrendingUp,
          bgClass: 'bg-emerald-500/10',
          textClass: 'text-emerald-400',
          borderClass: 'border-emerald-500/30',
        };
      case 'STRONG_SELL':
        return {
          icon: Zap,
          bgClass: 'bg-red-500/20',
          textClass: 'text-red-400',
          borderClass: 'border-red-500/50',
        };
      case 'SELL':
        return {
          icon: TrendingDown,
          bgClass: 'bg-red-500/10',
          textClass: 'text-red-400',
          borderClass: 'border-red-500/30',
        };
      default:
        return {
          icon: Minus,
          bgClass: 'bg-yellow-500/10',
          textClass: 'text-yellow-400',
          borderClass: 'border-yellow-500/30',
        };
    }
  }, [confluence]);
  
  if (isLoading) {
    return (
      <div className={`rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-400">
          <Layers className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Lade Multi-TF Analyse...</span>
        </div>
      </div>
    );
  }
  
  if (!confluence) {
    return (
      <div className={`rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-slate-500">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Nicht genug Daten für Konfluenz-Analyse</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`rounded-xl ${bgClass} border ${borderClass} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-slate-200">Multi-TF Konfluenz</span>
        </div>
        <span className={`text-xs font-medium ${getConfluenceColor(confluence.strength)}`}>
          {getConfluenceLabel(confluence.strength)}
        </span>
      </div>
      
      {/* Main Signal */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${bgClass} border ${borderClass}`}>
          <RecommendationIcon className={`w-6 h-6 ${textClass}`} />
        </div>
        <div>
          <div className={`text-lg font-bold ${textClass}`}>
            {confluence.recommendation.replace('_', ' ')}
          </div>
          <div className="text-xs text-slate-400">
            Konfidenz: {Math.round(confluence.confidence * 100)}%
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-white">
            {confluence.confluenceScore}%
          </div>
          <div className="text-xs text-slate-500">Score</div>
        </div>
      </div>
      
      {/* Timeframe Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {confluence.signals.map((signal) => (
          <div 
            key={signal.timeframe}
            className={`text-center p-2 rounded-lg border ${
              signal.bias === 'bullish' 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : signal.bias === 'bearish'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-slate-500/10 border-slate-500/30'
            }`}
          >
            <div className="text-[10px] text-slate-400 mb-1">
              {getTimeframeLabel(signal.timeframe)}
            </div>
            <div className="flex justify-center">
              {signal.bias === 'bullish' ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : signal.bias === 'bearish' ? (
                <TrendingDown className="w-4 h-4 text-red-400" />
              ) : (
                <Minus className="w-4 h-4 text-slate-400" />
              )}
            </div>
            {signal.rsi !== null && (
              <div className="text-[10px] text-slate-500 mt-1">
                RSI {Math.round(signal.rsi)}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Summary */}
      <div className="flex items-center justify-between text-xs border-t border-slate-700/50 pt-2">
        <div className="flex items-center gap-1">
          {confluence.alignedTimeframes.length >= 3 ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <XCircle className="w-3 h-3 text-orange-400" />
          )}
          <span className="text-slate-400">
            {confluence.alignedTimeframes.length}/{confluence.signals.length} TFs aligned
          </span>
        </div>
        <span className="text-slate-500">
          {confluence.reason}
        </span>
      </div>
      
      {/* Missing Timeframes Warning */}
      {!hasAllTimeframes && (
        <div className="mt-2 flex items-center gap-1 text-xs text-orange-400">
          <AlertTriangle className="w-3 h-3" />
          <span>
            Fehlende TFs: {['15m', '1h', '4h', '1d']
              .filter(tf => !availableTimeframes.includes(tf))
              .join(', ')}
          </span>
        </div>
      )}
    </div>
  );
});

ConfluenceCard.propTypes = {
  assetId: PropTypes.string.isRequired,
  symbol: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default ConfluenceCard;
