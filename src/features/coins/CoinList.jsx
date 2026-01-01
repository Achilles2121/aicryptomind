// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowUp, 
  ArrowDown, 
  Search, 
  RefreshCw
} from 'lucide-react';
import { safeFixed } from "../../lib/safeFixed";

// Sparkline mini chart component
function Sparkline({ data, positive }) {
  if (!data?.length) return <div className="w-24 h-8 bg-slate-800 rounded animate-pulse" />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((v, i) => 
    `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 80 - 10}`
  ).join(' ');
  
  return (
    <svg viewBox="0 0 100 100" className="w-24 h-8" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Format large numbers
function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1e12) return `$${safeFixed(num / 1e12, decimals)}T`;
  if (num >= 1e9) return `$${safeFixed(num / 1e9, decimals)}B`;
  if (num >= 1e6) return `$${safeFixed(num / 1e6, decimals)}M`;
  if (num >= 1e3) return `$${safeFixed(num / 1e3, decimals)}K`;
  return `$${safeFixed(num, decimals)}`;
}

// Format price with appropriate decimals
function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${safeFixed(price, 2)}`;
  if (price >= 0.01) return `$${safeFixed(price, 4)}`;
  return `$${safeFixed(price, 8)}`;
}

// Percentage change component
function PriceChange({ value }) {
  if (value === null || value === undefined) return <span className="text-slate-500">-</span>;
  
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  
  return (
    <span className={`flex items-center gap-1 ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {safeFixed(Math.abs(value), 2)}%
    </span>
  );
}

// Loading skeleton row
function SkeletonRow() {
  return (
    <tr className="border-b border-slate-800/50 animate-pulse">
      <td className="p-4"><div className="h-4 w-8 bg-slate-700 rounded" /></td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full" />
          <div className="h-4 w-24 bg-slate-700 rounded" />
        </div>
      </td>
      <td className="p-4"><div className="h-4 w-20 bg-slate-700 rounded" /></td>
      <td className="p-4"><div className="h-4 w-16 bg-slate-700 rounded" /></td>
      <td className="p-4"><div className="h-4 w-16 bg-slate-700 rounded" /></td>
      <td className="p-4"><div className="h-4 w-24 bg-slate-700 rounded" /></td>
      <td className="p-4"><div className="h-8 w-24 bg-slate-700 rounded" /></td>
    </tr>
  );
}

export default function CoinList() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('market_cap_rank');
  const [sortDir, setSortDir] = useState('asc');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch coins data
  const fetchCoins = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const response = await fetch('/api/coins');
      const data = await response.json();
      
      if (data.success) {
        setCoins(data.data);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch coins');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCoins();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchCoins(false), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter and sort coins
  const filteredCoins = useMemo(() => {
    let result = [...coins];
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.symbol.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      // Handle null values
      if (aVal === null || aVal === undefined) aVal = 0;
      if (bVal === null || bVal === undefined) bVal = 0;
      
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [coins, search, sortBy, sortDir]);

  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'market_cap_rank' ? 'asc' : 'desc');
    }
  };

  // Sort indicator
  const SortIndicator = ({ field }) => {
    if (sortBy !== field) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Market stats summary
  const marketStats = useMemo(() => {
    if (!coins.length) return null;
    
    const totalMarketCap = coins.reduce((sum, c) => sum + (c.market_cap || 0), 0);
    const totalVolume = coins.reduce((sum, c) => sum + (c.total_volume || 0), 0);
    const btcDominance = coins[0]?.market_cap ? (coins[0].market_cap / totalMarketCap * 100) : 0;
    const gainers = coins.filter(c => (c.price_change_percentage_24h || 0) > 0).length;
    
    return { totalMarketCap, totalVolume, btcDominance, gainers };
  }, [coins]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Top 100 Cryptocurrencies
        </h1>
        <p className="text-slate-400">
          Live prices, market caps, and 7-day performance charts
        </p>
      </div>

      {/* Market Stats */}
      {marketStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">Total Market Cap</div>
            <div className="text-xl font-bold text-white">
              {formatNumber(marketStats.totalMarketCap, 2)}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">24h Volume</div>
            <div className="text-xl font-bold text-white">
              {formatNumber(marketStats.totalVolume, 2)}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">BTC Dominance</div>
            <div className="text-xl font-bold text-amber-400">
              {safeFixed(marketStats.btcDominance, 1)}%
            </div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="text-slate-400 text-sm mb-1">Gainers/Losers</div>
            <div className="text-xl font-bold">
              <span className="text-emerald-400">{marketStats.gainers}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-red-400">{coins.length - marketStats.gainers}</span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search coins by name or symbol..."
            className="w-full pl-10 pr-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => fetchCoins(true)}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Coins Table */}
      <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-slate-400 text-sm border-b border-slate-700/50 bg-slate-800/50">
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('market_cap_rank')}
                >
                  # <SortIndicator field="market_cap_rank" />
                </th>
                <th className="p-4 font-medium">Coin</th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('current_price')}
                >
                  Price <SortIndicator field="current_price" />
                </th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('price_change_percentage_24h')}
                >
                  24h % <SortIndicator field="price_change_percentage_24h" />
                </th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-white transition-colors hidden md:table-cell"
                  onClick={() => toggleSort('price_change_percentage_7d_in_currency')}
                >
                  7d % <SortIndicator field="price_change_percentage_7d_in_currency" />
                </th>
                <th 
                  className="p-4 font-medium cursor-pointer hover:text-white transition-colors hidden sm:table-cell"
                  onClick={() => toggleSort('market_cap')}
                >
                  Market Cap <SortIndicator field="market_cap" />
                </th>
                <th className="p-4 font-medium hidden lg:table-cell">7d Chart</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filteredCoins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    {search ? 'No coins found matching your search' : 'No coins available'}
                  </td>
                </tr>
              ) : (
                filteredCoins.map((coin) => (
                  <tr 
                    key={coin.id} 
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-4 text-slate-400 font-medium">
                      {coin.market_cap_rank || '-'}
                    </td>
                    <td className="p-4">
                      <Link 
                        to={`/asset/${coin.symbol.toUpperCase()}`} 
                        className="flex items-center gap-3 hover:text-cyan-400 transition-colors group"
                      >
                        <img 
                          src={coin.image} 
                          alt={coin.name} 
                          className="w-8 h-8 rounded-full"
                          loading="lazy"
                        />
                        <div>
                          <div className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                            {coin.name}
                          </div>
                          <div className="text-sm text-slate-500 uppercase">
                            {coin.symbol}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 font-medium text-white">
                      {formatPrice(coin.current_price)}
                    </td>
                    <td className="p-4">
                      <PriceChange value={coin.price_change_percentage_24h} />
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <PriceChange value={coin.price_change_percentage_7d_in_currency} />
                    </td>
                    <td className="p-4 text-slate-300 hidden sm:table-cell">
                      {formatNumber(coin.market_cap)}
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <Sparkline 
                        data={coin.sparkline_in_7d?.price} 
                        positive={(coin.price_change_percentage_7d_in_currency || 0) >= 0}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-6 text-center text-sm text-slate-500">
        Data provided by CoinGecko • Updates every 60 seconds
      </div>
    </div>
  );
}
