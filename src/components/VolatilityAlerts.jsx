/**
 * Volatility Alerts Component
 * Vision AI Mind - Elite Trader
 * 
 * Real-time volatility warnings and alerts
 * Integrates with the toast notification system
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, TrendingUp, TrendingDown, Zap, DollarSign, Activity, Clock } from 'lucide-react';

const VolatilityAlerts = ({
  volatilityData = null,
  showAll = false,
  maxAlerts = 5,
  className = '',
}) => {
  // Generate alerts based on volatility data
  const alerts = useMemo(() => {
    if (!volatilityData) return [];

    const alertList = [];
    const { volatilityScore, metrics, classification: _classification, recommendation, sentiment } = volatilityData;

    // Score-based alerts
    if (volatilityScore >= 85) {
      alertList.push({
        type: 'critical',
        icon: AlertTriangle,
        title: 'EXTREME VOLATILITÄT',
        message: 'Trading pausieren! Markt zu gefährlich.',
        priority: 1,
      });
    } else if (volatilityScore >= 70) {
      alertList.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Hohe Volatilität',
        message: 'Positionsgrößen reduzieren, Stops anpassen.',
        priority: 2,
      });
    } else if (volatilityScore <= 25) {
      alertList.push({
        type: 'info',
        icon: Activity,
        title: 'Niedrige Volatilität',
        message: 'Stabile Marktbedingungen - ideales Setup.',
        priority: 4,
      });
    }

    // ATR-based alerts
    if (metrics?.atrPercent > 4.5) {
      alertList.push({
        type: 'critical',
        icon: Zap,
        title: 'ATR Spike',
        message: `ATR bei ${metrics.atrPercent.toFixed(2)}% - extreme Bewegungen!`,
        priority: 1,
      });
    } else if (metrics?.atrPercent > 3) {
      alertList.push({
        type: 'warning',
        icon: Zap,
        title: 'Erhöhte ATR',
        message: `ATR bei ${metrics.atrPercent.toFixed(2)}% - vorsichtig traden.`,
        priority: 3,
      });
    }

    // GARCH forecast alerts
    if (metrics?.garchForecast4h > 4) {
      alertList.push({
        type: 'warning',
        icon: TrendingUp,
        title: 'Vol-Anstieg erwartet',
        message: `GARCH: ${metrics.garchForecast4h.toFixed(1)}% Vol in 4h prognostiziert.`,
        priority: 2,
      });
    } else if (metrics?.garchForecast4h < metrics?.historicalVol * 0.7) {
      alertList.push({
        type: 'info',
        icon: TrendingDown,
        title: 'Vol-Rückgang erwartet',
        message: 'Volatilität normalisiert sich - bessere Setups kommen.',
        priority: 4,
      });
    }

    // Recommendation-based alerts
    if (recommendation === 'WAIT') {
      alertList.push({
        type: 'critical',
        icon: Clock,
        title: 'WARTEN EMPFOHLEN',
        message: 'Kein Trading bis Volatilität sinkt.',
        priority: 1,
      });
    } else if (recommendation === 'CAUTION') {
      alertList.push({
        type: 'warning',
        icon: AlertTriangle,
        title: 'Vorsicht geboten',
        message: 'Nur erfahrene Trader mit reduzierten Positionen.',
        priority: 3,
      });
    }

    // Sentiment alerts (for crypto)
    if (sentiment) {
      if (sentiment.fearGreed !== null && sentiment.fearGreed < 20) {
        alertList.push({
          type: 'warning',
          icon: AlertTriangle,
          title: 'Extreme Fear',
          message: `Fear & Greed bei ${sentiment.fearGreed} - Panikverkäufe möglich.`,
          priority: 2,
        });
      } else if (sentiment.fearGreed !== null && sentiment.fearGreed > 85) {
        alertList.push({
          type: 'warning',
          icon: DollarSign,
          title: 'Extreme Greed',
          message: `Fear & Greed bei ${sentiment.fearGreed} - FOMO-Korrektur möglich.`,
          priority: 2,
        });
      }

      if (sentiment.fundingRate !== null && Math.abs(sentiment.fundingRate) > 0.08) {
        const direction = sentiment.fundingRate > 0 ? 'positiv' : 'negativ';
        alertList.push({
          type: 'info',
          icon: DollarSign,
          title: 'Hohe Funding Rate',
          message: `Funding ${direction}: ${sentiment.fundingRate.toFixed(3)}%`,
          priority: 3,
        });
      }
    }

    // Bollinger Bandwidth alerts
    if (metrics?.bollingerBandwidth > 7) {
      alertList.push({
        type: 'warning',
        icon: Activity,
        title: 'BB Expansion',
        message: 'Bollinger Bänder expandieren - Breakout oder Crash.',
        priority: 3,
      });
    } else if (metrics?.bollingerBandwidth < 2) {
      alertList.push({
        type: 'info',
        icon: Activity,
        title: 'BB Squeeze',
        message: 'Squeeze Formation - große Bewegung kommt.',
        priority: 3,
      });
    }

    // Sort by priority (1 = highest)
    return alertList.sort((a, b) => a.priority - b.priority).slice(0, maxAlerts);
  }, [volatilityData, maxAlerts]);

  // Don't render if no alerts
  if (alerts.length === 0 && !showAll) {
    return null;
  }

  // Get alert styling
  const getAlertStyle = (type) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-500/15',
          border: 'border-red-500/40',
          text: 'text-red-400',
          icon: 'text-red-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500/15',
          border: 'border-amber-500/40',
          text: 'text-amber-400',
          icon: 'text-amber-400',
        };
      case 'info':
        return {
          bg: 'bg-cyan-500/15',
          border: 'border-cyan-500/40',
          text: 'text-cyan-400',
          icon: 'text-cyan-400',
        };
      default:
        return {
          bg: 'bg-slate-500/15',
          border: 'border-slate-500/40',
          text: 'text-slate-400',
          icon: 'text-slate-400',
        };
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header if there are critical alerts */}
      {alerts.some(a => a.type === 'critical') && (
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertTriangle className="h-4 w-4 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Volatilitäts-Warnungen
          </span>
        </div>
      )}

      {/* Alert List */}
      {alerts.map((alert, index) => {
        const style = getAlertStyle(alert.type);
        const IconComponent = alert.icon;

        return (
          <div
            key={`${alert.title}-${index}`}
            className={`
              flex items-start gap-3 rounded-lg border p-3
              ${style.bg} ${style.border}
              transition-all duration-300 hover:scale-[1.01]
            `}
          >
            <IconComponent className={`h-4 w-4 mt-0.5 flex-shrink-0 ${style.icon}`} />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold ${style.text}`}>
                {alert.title}
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                {alert.message}
              </div>
            </div>
          </div>
        );
      })}

      {/* No alerts message */}
      {alerts.length === 0 && showAll && (
        <div className="flex items-center gap-2 text-slate-400 text-xs p-3 bg-slate-800/50 rounded-lg">
          <Activity className="h-4 w-4" />
          <span>Keine Volatilitäts-Warnungen aktiv</span>
        </div>
      )}
    </div>
  );
};

VolatilityAlerts.propTypes = {
  volatilityData: PropTypes.shape({
    volatilityScore: PropTypes.number,
    classification: PropTypes.string,
    recommendation: PropTypes.string,
    metrics: PropTypes.shape({
      atr: PropTypes.number,
      atrPercent: PropTypes.number,
      bollingerBandwidth: PropTypes.number,
      historicalVol: PropTypes.number,
      garchForecast4h: PropTypes.number,
      garchForecast24h: PropTypes.number,
    }),
    sentiment: PropTypes.shape({
      fearGreed: PropTypes.number,
      fundingRate: PropTypes.number,
      liquidations24h: PropTypes.number,
    }),
  }),
  showAll: PropTypes.bool,
  maxAlerts: PropTypes.number,
  className: PropTypes.string,
};

export default VolatilityAlerts;
