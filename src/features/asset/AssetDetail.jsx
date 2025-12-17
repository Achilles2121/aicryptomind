// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowUp, 
  ArrowDown, 
  TrendingUp,
  Activity,
  DollarSign,
  BarChart3,
  Clock,
  Globe,
  FileText,
  Github
} from 'lucide-react';

// Format helpers
function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(decimals)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
  return `$${num.toFixed(decimals)}`;
}

function formatSupply(num) {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toLocaleString();
}

// Price change component
function PriceChange({ value, large = false }) {
  if (value === null || value === undefined) return <span className="text-slate-500">-</span>;
  
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  const bgClass = isPositive ? 'bg-emerald-400/10' : 'bg-red-400/10';
  
  return (
    <span className={`inline-flex items-center gap-1 ${colorClass} ${large ? `${bgClass} px-3 py-1 rounded-lg` : ''}`}>
      <Icon className={large ? 'w-4 h-4' : 'w-3 h-3'} />
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// Stat card component
function StatCard({ icon: Icon, label, value, subValue }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {subValue && <div className="text-sm text-slate-500 mt-1">{subValue}</div>}
    </div>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-8 w-24 bg-slate-700 rounded mb-8" />
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-slate-700 rounded-full" />
        <div>
          <div className="h-8 w-48 bg-slate-700 rounded mb-2" />
          <div className="h-4 w-24 bg-slate-700 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-700 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function AssetDetail() {
  const { symbol } = useParams();
  const [coin, setCoin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCoinData() {
      setLoading(true);
      try {
        // First try to get from coins list
        const listResponse = await fetch('/api/coins');
        const listData = await listResponse.json();
        
        if (listData.success && listData.data) {
          const found = listData.data.find(
            c => c.symbol.toUpperCase() === symbol.toUpperCase()
          );
          
          if (found) {
            // Fetch detailed data from CoinGecko
            const detailResponse = await fetch(
              `https://api.coingecko.com/api/v3/coins/${found.id}?localization=false&tickers=false&community_data=true&developer_data=true&sparkline=true`
            );
            
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              setCoin({ ...found, ...detailData });
            } else {
              setCoin(found);
            }
          } else {
            setError(`Coin "${symbol}" not found`);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (symbol) {
      fetchCoinData();
    }
  }, [symbol]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link to="/coins" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Coins
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <Link to="/coins" className="mt-4 inline-block text-cyan-400 hover:underline">
            Browse all coins
          </Link>
        </div>
      </div>
    );
  }

  if (!coin) return null;

  const priceChange24h = coin.price_change_percentage_24h || coin.market_data?.price_change_percentage_24h || 0;
  const priceChange7d = coin.price_change_percentage_7d_in_currency || coin.market_data?.price_change_percentage_7d || 0;
  const priceChange30d = coin.market_data?.price_change_percentage_30d || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back button */}
      <Link to="/coins" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Coins
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <img 
            src={coin.image?.large || coin.image} 
            alt={coin.name} 
            className="w-16 h-16 rounded-full"
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{coin.name}</h1>
              <span className="px-2 py-1 bg-slate-700 rounded text-slate-300 text-sm uppercase">
                {coin.symbol}
              </span>
              {coin.market_cap_rank && (
                <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">
                  Rank #{coin.market_cap_rank}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {coin.links?.homepage?.[0] && (
                <a 
                  href={coin.links.homepage[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm"
                >
                  <Globe className="w-4 h-4" />
                  Website
                </a>
              )}
              {coin.links?.whitepaper && (
                <a 
                  href={coin.links.whitepaper} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Whitepaper
                </a>
              )}
              {coin.links?.repos_url?.github?.[0] && (
                <a 
                  href={coin.links.repos_url.github[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-sm"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Current Price */}
        <div className="text-right">
          <div className="text-4xl font-bold text-white">
            {formatPrice(coin.current_price || coin.market_data?.current_price?.usd)}
          </div>
          <div className="flex items-center gap-4 justify-end mt-2">
            <PriceChange value={priceChange24h} large />
          </div>
        </div>
      </div>

      {/* Price Changes */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-sm mb-1">24h Change</div>
          <PriceChange value={priceChange24h} />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-sm mb-1">7d Change</div>
          <PriceChange value={priceChange7d} />
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-center">
          <div className="text-slate-400 text-sm mb-1">30d Change</div>
          <PriceChange value={priceChange30d} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard 
          icon={DollarSign}
          label="Market Cap"
          value={formatNumber(coin.market_cap || coin.market_data?.market_cap?.usd)}
        />
        <StatCard 
          icon={BarChart3}
          label="24h Volume"
          value={formatNumber(coin.total_volume || coin.market_data?.total_volume?.usd)}
        />
        <StatCard 
          icon={Activity}
          label="Circulating Supply"
          value={formatSupply(coin.circulating_supply || coin.market_data?.circulating_supply)}
          subValue={coin.symbol?.toUpperCase()}
        />
        <StatCard 
          icon={TrendingUp}
          label="All-Time High"
          value={formatPrice(coin.ath || coin.market_data?.ath?.usd)}
          subValue={coin.ath_change_percentage ? `${coin.ath_change_percentage.toFixed(1)}% from ATH` : null}
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {coin.max_supply && (
          <StatCard 
            icon={Clock}
            label="Max Supply"
            value={formatSupply(coin.max_supply)}
          />
        )}
        {coin.market_data?.fully_diluted_valuation?.usd && (
          <StatCard 
            icon={DollarSign}
            label="Fully Diluted Valuation"
            value={formatNumber(coin.market_data.fully_diluted_valuation.usd)}
          />
        )}
        {coin.market_data?.high_24h?.usd && (
          <StatCard 
            icon={ArrowUp}
            label="24h High"
            value={formatPrice(coin.market_data.high_24h.usd)}
          />
        )}
        {coin.market_data?.low_24h?.usd && (
          <StatCard 
            icon={ArrowDown}
            label="24h Low"
            value={formatPrice(coin.market_data.low_24h.usd)}
          />
        )}
      </div>

      {/* Description */}
      {coin.description?.en && (
        <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">About {coin.name}</h2>
          <div 
            className="text-slate-300 prose prose-invert max-w-none prose-a:text-cyan-400"
            dangerouslySetInnerHTML={{ 
              __html: coin.description.en.split('. ').slice(0, 5).join('. ') + '.' 
            }}
          />
        </div>
      )}

      {/* Trade CTA */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/30 p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Ready to Trade {coin.symbol?.toUpperCase()}?</h3>
        <p className="text-slate-400 mb-4">Get trading signals with our Ultra Signal Engine (75-82% Win Rate)</p>
        <Link 
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors"
        >
          <TrendingUp className="w-5 h-5" />
          View Signals on Dashboard
        </Link>
      </div>
    </div>
  );
}
