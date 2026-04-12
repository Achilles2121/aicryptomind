import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { Card } from "../../components/Card";
import { TrendingUp, TrendingDown, Activity, Gauge, Target, Shield, BarChart3, Zap } from "lucide-react";
import { usePriceStore } from "../../stores/usePriceStore";

const safeFixed = (val, decimals = 2) => {
  if (!Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
};

const getRsiColor = (rsi) => {
  if (rsi < 30) return "text-emerald-400";
  if (rsi > 70) return "text-red-400";
  return "text-yellow-400";
};

const getRsiLabel = (rsi) => {
  if (rsi < 30) return "Oversold";
  if (rsi > 70) return "Overbought";
  return "Neutral";
};

// Helper functions for styling to avoid nested ternaries
const getSignalBgClass = (direction) => {
  if (direction === "BUY") return "bg-emerald-500/10 border-emerald-500/30";
  if (direction === "SELL") return "bg-red-500/10 border-red-500/30";
  return "bg-yellow-500/10 border-yellow-500/30";
};

const getSignalTextClass = (direction) => {
  if (direction === "BUY") return "text-emerald-400";
  if (direction === "SELL") return "text-red-400";
  return "text-yellow-400";
};

const getTrendClass = (trend) => {
  if (trend === "bullish") return "text-emerald-400";
  if (trend === "bearish") return "text-red-400";
  return "text-yellow-400";
};

const getTrendLabel = (trend) => {
  if (trend === "bullish") return "↑ Bullish";
  if (trend === "bearish") return "↓ Bearish";
  return "→ Neutral";
};

const getStochClass = (stochK) => {
  if (stochK < 20) return "text-emerald-400";
  if (stochK > 80) return "text-red-400";
  return "text-white";
};

/**
 * IndicatorCards - Real-time Technical Indicators Dashboard
 * Connects to /api/indicators endpoint for live data
 */
export function IndicatorCards({ symbol = "BTC", interval = 60 }) {
  const [indicators, setIndicators] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get selected asset from store
  const selectedAssetId = usePriceStore((state) => state.selectedAssetId);
  const assetSymbol = useMemo(() => {
    const raw = selectedAssetId || symbol;
    return String(raw).toUpperCase().replace(/USD$/, "");
  }, [selectedAssetId, symbol]);

  const fetchIndicators = useCallback(async (signal) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/indicators?asset=${encodeURIComponent(assetSymbol)}&interval=${interval}&type=all`,
        { signal }
      );
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const payload = await response.json();
      
      if (payload.ok && payload.data) {
        setIndicators(payload.data);
      } else {
        throw new Error(payload.error || "No data");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("[IndicatorCards] Fetch failed:", err.message);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [assetSymbol, interval]);

  // Initial fetch and polling
  useEffect(() => {
    const controller = new AbortController();
    fetchIndicators(controller.signal);
    
    // Refresh every 30 seconds
    const timer = setInterval(() => {
      fetchIndicators(controller.signal);
    }, 30000);
    
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fetchIndicators]);

  if (loading && !indicators) {
    return (
      <Card title="Indicator Engine V4" icon={Activity}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
              <div className="h-4 w-16 bg-slate-700 rounded mb-2" />
              <div className="h-6 w-12 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error && !indicators) {
    return (
      <Card title="Indicator Engine V4" icon={Activity}>
        <p className="text-xs text-amber-400/80 mb-3">
          ⚠️ {error}
        </p>
      </Card>
    );
  }

  const data = indicators || {};
  const signal = data.signal || {};

  return (
    <Card 
      title={`Indicator Engine V4 - ${assetSymbol}`} 
      icon={Activity}
      actions={
        <span className="text-xs text-slate-400">
          {loading ? "Updating..." : `Last: ${new Date(data.timestamp || Date.now()).toLocaleTimeString()}`}
        </span>
      }
    >
      {/* Signal Summary */}
      <div className={`mb-4 p-3 rounded-lg border ${getSignalBgClass(signal.direction)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {signal.direction === "BUY" && <TrendingUp className="w-5 h-5 text-emerald-400" />}
            {signal.direction === "SELL" && <TrendingDown className="w-5 h-5 text-red-400" />}
            {signal.direction === "HOLD" && <Activity className="w-5 h-5 text-yellow-400" />}
            <span className={`font-bold ${getSignalTextClass(signal.direction)}`}>
              {signal.direction || "ANALYZING"}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm text-slate-300">Score: {safeFixed(signal.score, 1)}/5</span>
            <span className="ml-2 text-sm text-cyan-400">{signal.confidence || 0}% Confidence</span>
          </div>
        </div>
        {signal.reasons?.length > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            {signal.reasons.slice(0, 3).join(" • ")}
          </div>
        )}
      </div>

      {/* Indicator Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* RSI */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Gauge className="w-3 h-3" />
            RSI
          </div>
          <p className={`text-lg font-semibold ${getRsiColor(data.rsi)}`}>
            {safeFixed(data.rsi, 1)}
          </p>
          <p className={`text-xs ${getRsiColor(data.rsi)}`}>
            {getRsiLabel(data.rsi)}
          </p>
        </div>

        {/* MACD */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <BarChart3 className="w-3 h-3" />
            MACD
          </div>
          <p className={`text-lg font-semibold ${data.macd > data.macdSignal ? "text-emerald-400" : "text-red-400"}`}>
            {safeFixed(data.macd, 2)}
          </p>
          <p className="text-xs text-slate-400">
            Signal: {safeFixed(data.macdSignal, 2)}
          </p>
        </div>

        {/* Trend */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Zap className="w-3 h-3" />
            Trend
          </div>
          <p className={`text-lg font-semibold ${getTrendClass(data.trend)}`}>
            {getTrendLabel(data.trend)}
          </p>
        </div>

        {/* ATR (Volatility) */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Activity className="w-3 h-3" />
            ATR
          </div>
          <p className="text-lg font-semibold text-white">
            {safeFixed(data.atr, 2)}
          </p>
          <p className="text-xs text-slate-400">
            Vol: {safeFixed(data.volatility, 2)}%
          </p>
        </div>

        {/* Support */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            Support
          </div>
          <p className="text-lg font-semibold text-emerald-400">
            ${safeFixed(data.support, 0)}
          </p>
        </div>

        {/* Resistance */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Target className="w-3 h-3 text-red-400" />
            Resistance
          </div>
          <p className="text-lg font-semibold text-red-400">
            ${safeFixed(data.resistance, 0)}
          </p>
        </div>

        {/* Momentum */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <TrendingUp className="w-3 h-3" />
            Momentum
          </div>
          <p className={`text-lg font-semibold ${data.momentum > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {data.momentum > 0 ? "+" : ""}{safeFixed(data.momentum, 2)}%
          </p>
        </div>

        {/* Stochastic */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            <Gauge className="w-3 h-3" />
            Stoch %K
          </div>
          <p className={`text-lg font-semibold ${getStochClass(data.stochK)}`}>
            {safeFixed(data.stochK, 1)}
          </p>
        </div>

        {/* EMA Status */}
        <div className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3">
          <div className="flex items-center gap-1 text-slate-400 text-sm mb-1">
            EMA Cross
          </div>
          <p className="text-sm text-white">
            8: {safeFixed(data.ema8, 0)}
          </p>
          <p className="text-xs text-slate-400">
            21: {safeFixed(data.ema21, 0)}
          </p>
        </div>
      </div>

      {/* Fibonacci Levels */}
      {data.fibLevels && (
        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <h4 className="text-sm font-medium text-violet-400 mb-2">Fibonacci Levels</h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {Object.entries(data.fibLevels).map(([level, price]) => (
              <div key={level} className="text-center">
                <span className="text-slate-400">{level}</span>
                <p className="text-white font-mono">${safeFixed(price, 0)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

IndicatorCards.propTypes = {
  symbol: PropTypes.string,
  interval: PropTypes.number,
};
