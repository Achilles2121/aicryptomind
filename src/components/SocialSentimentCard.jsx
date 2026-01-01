// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  BarChart3,
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { safeFixed } from "../lib/safeFixed";

const SENTIMENT_CACHE_KEY = 'visionai_sentiment_cache';
const CACHE_TTL = 30000; // 30 seconds
const POLL_INTERVAL = 60000; // 1 minute

/**
 * SocialSentimentCard - Real-time market sentiment dashboard
 * Shows Long/Short ratios, Top Trader positions, and Fear & Greed
 */
const SocialSentimentCard = ({ onSentimentChange, minTier: _minTier = 'basic' }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchSentiment = useCallback(async () => {
    try {
      // Check localStorage cache first
      const cached = localStorage.getItem(SENTIMENT_CACHE_KEY);
      if (cached) {
        const { data: cachedData, expires } = JSON.parse(cached);
        if (Date.now() < expires) {
          setData(cachedData);
          setLoading(false);
          return;
        }
      }

      const response = await fetch('/api/sentiment');
      const result = await response.json();
      
      if (result.ok && result.data) {
        setData(result.data);
        setError(null);
        setLastUpdate(new Date());
        
        // Cache in localStorage
        localStorage.setItem(SENTIMENT_CACHE_KEY, JSON.stringify({
          data: result.data,
          expires: Date.now() + CACHE_TTL
        }));
        
        // Notify parent component
        if (onSentimentChange) {
          onSentimentChange(result.data);
        }
      } else {
        throw new Error(result.error || 'Failed to fetch sentiment');
      }
    } catch (err) {
      console.error('[SocialSentimentCard] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onSentimentChange]);

  useEffect(() => {
    fetchSentiment();
    const interval = setInterval(fetchSentiment, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSentiment]);

  // Sentiment color based on score
  const getSentimentColor = (score) => {
    if (score <= 20) return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    if (score <= 40) return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' };
    if (score <= 60) return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' };
    if (score <= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
  };

  // Gauge component for sentiment visualization
  const SentimentGauge = ({ score, label, size = 'large' }) => {
    const colors = getSentimentColor(score);
    const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees
    
    return (
      <div className="relative flex flex-col items-center">
        {/* Semi-circular gauge */}
        <div className={`relative ${size === 'large' ? 'w-32 h-16' : 'w-20 h-10'} overflow-hidden`}>
          {/* Background arc */}
          <div className={`absolute inset-0 ${size === 'large' ? 'border-8' : 'border-4'} border-slate-700 rounded-t-full`} />
          
          {/* Colored arc based on score */}
          <div 
            className={`absolute inset-0 ${size === 'large' ? 'border-8' : 'border-4'} rounded-t-full transition-all duration-500`}
            style={{
              borderColor: score <= 40 ? '#ef4444' : score <= 60 ? '#64748b' : '#10b981',
              clipPath: `polygon(0 100%, ${score}% 100%, ${score}% 0, 0 0)`
            }}
          />
          
          {/* Needle */}
          <div 
            className="absolute bottom-0 left-1/2 origin-bottom transition-transform duration-700 ease-out"
            style={{ 
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              width: '2px',
              height: size === 'large' ? '56px' : '36px',
              background: 'linear-gradient(to top, #22d3ee, #22d3ee 70%, transparent)'
            }}
          />
          
          {/* Center dot */}
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 ${size === 'large' ? 'w-3 h-3' : 'w-2 h-2'} bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50`} />
        </div>
        
        {/* Score */}
        <div className={`mt-2 ${colors.text} font-bold ${size === 'large' ? 'text-2xl' : 'text-lg'}`}>
          {score}
        </div>
        
        {/* Label */}
        <div className={`text-xs ${colors.text} font-medium px-2 py-0.5 rounded-full ${colors.bg}`}>
          {label}
        </div>
      </div>
    );
  };

  // Stat row component
  const StatRow = ({ icon: Icon, label, value, subValue, trend }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200">{value}</span>
        {subValue && <span className="text-xs text-slate-500">{subValue}</span>}
        {trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
      </div>
    </div>
  );

  if (loading && !data) {
    return (
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-slate-700 rounded" />
          <div className="h-5 bg-slate-700 rounded w-32" />
        </div>
        <div className="flex justify-center py-8">
          <div className="w-32 h-20 bg-slate-700 rounded-t-full" />
        </div>
        <div className="space-y-3 mt-4">
          <div className="h-8 bg-slate-700/50 rounded" />
          <div className="h-8 bg-slate-700/50 rounded" />
          <div className="h-8 bg-slate-700/50 rounded" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-slate-900/50 border border-red-500/30 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Sentiment nicht verfügbar</span>
        </div>
        <p className="text-sm text-slate-400">{error}</p>
        <button 
          onClick={fetchSentiment}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Erneut versuchen
        </button>
      </div>
    );
  }

  const longShortTrend = data.longShortRatio > 1 ? 'up' : data.longShortRatio < 1 ? 'down' : null;
  const sentimentColors = getSentimentColor(data.combinedScore);

  return (
    <div className={`bg-slate-900/50 border ${sentimentColors.border} rounded-xl p-6 transition-colors duration-500`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-slate-200">Market Sentiment</h3>
          <span className="px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-xs text-cyan-400">
            LIVE
          </span>
        </div>
        <button 
          onClick={fetchSentiment}
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded-lg transition"
          title="Aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Gauge */}
      <div className="flex justify-center py-4">
        <SentimentGauge 
          score={data.combinedScore} 
          label={data.combinedLabel}
          size="large"
        />
      </div>

      {/* Signal Integration Hint */}
      {data.combinedScore <= 25 && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
          <Zap className="w-4 h-4 text-red-400" />
          <span className="text-xs text-red-300">
            <strong>Extreme Fear</strong> - Potenzielle Kaufgelegenheit bei technischer Bestätigung
          </span>
        </div>
      )}
      {data.combinedScore >= 75 && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-300">
            <strong>Extreme Greed</strong> - Vorsicht bei Long-Positionen, Gewinnmitnahmen erwägen
          </span>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Long/Short Ratio */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">Long/Short</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${data.longShortRatio > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
              {safeFixed(data.longShortRatio, 2)}
            </span>
            {longShortTrend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
            {longShortTrend === 'down' && <TrendingDown className="w-3 h-3 text-red-400" />}
          </div>
          <div className="flex gap-1 mt-2">
            <div 
              className="h-1.5 bg-emerald-500 rounded-l" 
              style={{ width: `${data.longPercent}%` }}
            />
            <div 
              className="h-1.5 bg-red-500 rounded-r" 
              style={{ width: `${data.shortPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>{safeFixed(data.longPercent, 1)}% Long</span>
            <span>{safeFixed(data.shortPercent, 1)}% Short</span>
          </div>
        </div>

        {/* Top Traders */}
        <div className="bg-slate-800/30 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-1">Top Trader Ratio</div>
          <div className={`text-lg font-bold ${data.topTraderLongShortRatio > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
            {safeFixed(data.topTraderLongShortRatio, 2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            {data.topTraderLongShortRatio > 1.5 
              ? '🐋 Wale sind bullish' 
              : data.topTraderLongShortRatio < 0.7 
                ? '🐋 Wale sind bearish'
                : '🐋 Wale sind neutral'}
          </div>
        </div>
      </div>

      {/* Detail Stats */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <StatRow 
          icon={BarChart3}
          label="Fear & Greed (24h)"
          value={data.dailyFearGreed}
          subValue={data.dailyFearGreedLabel}
        />
        <StatRow 
          icon={Users}
          label="Echtzeit-Sentiment"
          value={data.realTimeSentiment}
          subValue={data.realTimeSentimentLabel}
        />
        <StatRow 
          icon={Activity}
          label="Open Interest"
          value={`${safeFixed(data.openInterest / 1000, 1)}K BTC`}
        />
      </div>

      {/* Last Update */}
      <div className="mt-3 text-[10px] text-slate-600 text-center">
        Aktualisiert: {lastUpdate ? lastUpdate.toLocaleTimeString('de-DE') : '-'}
        {' • '}Quelle: Binance + Alternative.me
      </div>
    </div>
  );
};

SocialSentimentCard.propTypes = {
  onSentimentChange: PropTypes.func,
  minTier: PropTypes.string,
};

export default SocialSentimentCard;
