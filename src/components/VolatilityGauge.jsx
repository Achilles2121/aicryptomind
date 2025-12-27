/**
 * Volatility Gauge Component
 * Vision AI Mind - VisionAIMnd
 * 
 * Visual gauge showing volatility score (0-100)
 * with color coding and recommendations
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Activity, AlertTriangle, TrendingUp, Pause } from 'lucide-react';

const VolatilityGauge = ({
  volatilityScore = 50,
  classification = 'MED',
  recommendation = 'CAUTION',
  metrics = {},
  assetType = 'crypto',
  sentiment = null,
  compact = false,
  showDetails = true,
  onRefresh = null,
}) => {
  // Color based on classification
  const colors = useMemo(() => {
    switch (classification) {
      case 'LOW':
        return {
          primary: '#10b981', // emerald-500
          bg: 'bg-emerald-500/20',
          border: 'border-emerald-500/40',
          text: 'text-emerald-400',
          gradient: 'from-emerald-500 to-green-400',
        };
      case 'MED':
        return {
          primary: '#f59e0b', // amber-500
          bg: 'bg-amber-500/20',
          border: 'border-amber-500/40',
          text: 'text-amber-400',
          gradient: 'from-amber-500 to-yellow-400',
        };
      case 'HIGH':
        return {
          primary: '#f97316', // orange-500
          bg: 'bg-orange-500/20',
          border: 'border-orange-500/40',
          text: 'text-orange-400',
          gradient: 'from-orange-500 to-red-400',
        };
      case 'EXTREME':
        return {
          primary: '#ef4444', // red-500
          bg: 'bg-red-500/20',
          border: 'border-red-500/40',
          text: 'text-red-400',
          gradient: 'from-red-500 to-red-600',
        };
      default:
        return {
          primary: '#64748b', // slate-500
          bg: 'bg-slate-500/20',
          border: 'border-slate-500/40',
          text: 'text-slate-400',
          gradient: 'from-slate-500 to-slate-400',
        };
    }
  }, [classification]);

  // Calculate gauge needle rotation (-90 to 90 degrees)
  const needleRotation = useMemo(() => {
    const clampedScore = Math.max(0, Math.min(100, volatilityScore));
    return (clampedScore / 100) * 180 - 90;
  }, [volatilityScore]);

  // Recommendation icon and text
  const recommendationDisplay = useMemo(() => {
    switch (recommendation) {
      case 'TRADE':
        return { icon: TrendingUp, text: 'Trading sicher', color: 'text-emerald-400' };
      case 'CAUTION':
        return { icon: AlertTriangle, text: 'Vorsicht geboten', color: 'text-amber-400' };
      case 'WAIT':
        return { icon: Pause, text: 'Warten empfohlen', color: 'text-red-400' };
      default:
        return { icon: Activity, text: 'Analysieren...', color: 'text-slate-400' };
    }
  }, [recommendation]);

  const RecommendationIcon = recommendationDisplay.icon;

  // Classification label in German
  const classificationLabel = useMemo(() => {
    switch (classification) {
      case 'LOW': return 'Niedrig';
      case 'MED': return 'Normal';
      case 'HIGH': return 'Hoch';
      case 'EXTREME': return 'Extrem';
      default: return classification;
    }
  }, [classification]);

  // Compact version
  if (compact) {
    return (
      <div className={`flex items-center gap-2 rounded-lg ${colors.bg} ${colors.border} border px-3 py-2`}>
        <Activity className={`h-4 w-4 ${colors.text}`} />
        <span className={`font-bold ${colors.text}`}>{Math.round(volatilityScore)}</span>
        <span className="text-xs text-slate-400">Vol</span>
        <span className={`text-xs ${colors.text}`}>{classificationLabel}</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className={`h-5 w-5 ${colors.text}`} />
          <span className="text-sm font-semibold text-slate-100">Volatilitäts-Index</span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            ↻ Aktualisieren
          </button>
        )}
      </div>

      {/* Gauge Visual */}
      <div className="relative w-36 h-20 mx-auto mb-4">
        <svg viewBox="0 0 100 55" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#334155"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Colored segments */}
          <path
            d="M 10 50 A 40 40 0 0 1 32 18"
            fill="none"
            stroke="#10b981"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M 32 18 A 40 40 0 0 1 68 18"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M 68 18 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#ef4444"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />

          {/* Active arc based on score */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={colors.primary}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(volatilityScore / 100) * 126} 126`}
          />
        </svg>

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 w-0.5 h-14 bg-white origin-bottom shadow-lg"
          style={{
            transform: `translateX(-50%) rotate(${needleRotation}deg)`,
            transition: 'transform 0.5s ease-out',
          }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
        </div>

        {/* Center circle */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-slate-700 rounded-full border-2 border-slate-600" />
      </div>

      {/* Score Display */}
      <div className="text-center mb-4">
        <span className={`text-3xl font-bold ${colors.text}`}>
          {Math.round(volatilityScore)}
        </span>
        <span className="text-lg text-slate-400">/100</span>
        <div className={`text-sm font-medium ${colors.text} mt-1`}>
          {classificationLabel}
        </div>
      </div>

      {/* Recommendation Badge */}
      <div className={`flex items-center justify-center gap-2 rounded-lg ${colors.bg} ${colors.border} border px-3 py-2 mb-4`}>
        <RecommendationIcon className={`h-4 w-4 ${recommendationDisplay.color}`} />
        <span className={`text-sm font-medium ${recommendationDisplay.color}`}>
          {recommendationDisplay.text}
        </span>
      </div>

      {/* Details Section */}
      {showDetails && metrics && (
        <div className="space-y-2 text-xs border-t border-slate-700/50 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex justify-between">
              <span className="text-slate-400">ATR:</span>
              <span className="text-slate-200 font-medium">
                {metrics.atrPercent?.toFixed(2) || '-'}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">BB Width:</span>
              <span className="text-slate-200 font-medium">
                {metrics.bollingerBandwidth?.toFixed(1) || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hist. Vol:</span>
              <span className="text-slate-200 font-medium">
                {metrics.historicalVol?.toFixed(0) || '-'}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Prognose 4h:</span>
              <span className="text-slate-200 font-medium">
                {metrics.garchForecast4h?.toFixed(1) || '-'}%
              </span>
            </div>
          </div>

          {/* Prognose 24h */}
          <div className="flex justify-between pt-1 border-t border-slate-700/30">
            <span className="text-slate-400">Prognose 24h:</span>
            <span className="text-slate-200 font-medium">
              {metrics.garchForecast24h?.toFixed(1) || '-'}% Vol
            </span>
          </div>

          {/* Sentiment (if available) */}
          {sentiment && sentiment.fearGreed !== null && (
            <div className="flex justify-between pt-1 border-t border-slate-700/30">
              <span className="text-slate-400">Fear & Greed:</span>
              <span className={`font-medium ${
                sentiment.fearGreed < 30 ? 'text-red-400' :
                sentiment.fearGreed > 70 ? 'text-green-400' :
                'text-amber-400'
              }`}>
                {sentiment.fearGreed}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Asset Type Badge */}
      <div className="mt-3 text-center">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">
          {assetType} • Volatilität
        </span>
      </div>
    </div>
  );
};

VolatilityGauge.propTypes = {
  volatilityScore: PropTypes.number,
  classification: PropTypes.oneOf(['LOW', 'MED', 'HIGH', 'EXTREME']),
  recommendation: PropTypes.oneOf(['TRADE', 'WAIT', 'CAUTION']),
  metrics: PropTypes.shape({
    atr: PropTypes.number,
    atrPercent: PropTypes.number,
    bollingerBandwidth: PropTypes.number,
    historicalVol: PropTypes.number,
    garchForecast4h: PropTypes.number,
    garchForecast24h: PropTypes.number,
  }),
  assetType: PropTypes.string,
  sentiment: PropTypes.shape({
    fearGreed: PropTypes.number,
    fundingRate: PropTypes.number,
    liquidations24h: PropTypes.number,
  }),
  compact: PropTypes.bool,
  showDetails: PropTypes.bool,
  onRefresh: PropTypes.func,
};

export default VolatilityGauge;
