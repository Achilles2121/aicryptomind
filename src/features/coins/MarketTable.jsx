// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, RefreshCw, Shield } from "lucide-react";
import { usePriceStore } from "../../stores/usePriceStore";
import { useUnifiedPrice } from "../../hooks/useUnifiedPrice";
import { computeEdgeScore, computeVolatilityScore } from "../../lib/strategyEngineV3";
import SparklineCanvas from "./SparklineCanvas";
import supportedCoins, { isSafeHavenAsset } from "../../config/supportedCoins";
import { 
  getAssetIcon, 
  getUniversalAssetConfig, 
  getTradingViewWidgetSymbol,
  ASSET_CLASS 
} from "../../config/universalMapping";
import { safeFixed } from "../../lib/safeFixed";

const TOP_LIMIT = supportedCoins.length;
const REST_POLL_MS = 30000;
const SPARKLINE_INTERVAL = 60;
const SPARKLINE_LIMIT = 24;
const INTEGRITY_SAMPLE_SIZE = 8;
const INTEGRITY_THRESHOLD = 0.005;
const FETCH_CONCURRENCY = 6;
const COIN_BATCH_IDS = supportedCoins.map((coin) => coin.id);

// ============================================
// LETTER ICON GENERATOR (Fallback for missing images)
// ============================================

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/**
 * Generate stylish letter-based SVG icon
 * Automatically creates gradient icons for assets without images
 */
const generateLetterIcon = (symbol, assetClass = "crypto") => {
  const label = String(symbol).toUpperCase().slice(0, 4);
  const hash = hashString(symbol);
  
  // Color schemes by asset class
  const colorSchemes = {
    crypto: { hue1: hash % 360, hue2: (hash + 40) % 360 },
    commodity: { hue1: 45, hue2: 35 }, // Golden
    forex: { hue1: 220, hue2: 260 }, // Blue-Purple
  };
  
  const colors = colorSchemes[assetClass] || colorSchemes.crypto;
  
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs>
      <linearGradient id='bg_${hash}' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='hsl(${colors.hue1},70%,45%)'/>
        <stop offset='1' stop-color='hsl(${colors.hue2},70%,55%)'/>
      </linearGradient>
    </defs>
    <rect width='64' height='64' rx='14' fill='url(#bg_${hash})'/>
    <text x='32' y='40' text-anchor='middle' font-size='${label.length > 3 ? 16 : 20}' 
          font-family='system-ui, -apple-system, sans-serif' fill='white' font-weight='700'>
      ${label}
    </text>
  </svg>`;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// Premium SVG Icons for Gold/Forex
const PREMIUM_ICONS = {
  XAUUSD: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='gold' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#fbbf24'/><stop offset='0.3' stop-color='#f59e0b'/>
      <stop offset='0.7' stop-color='#d97706'/><stop offset='1' stop-color='#b45309'/>
    </linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#1e1b4b'/>
    <path d='M16 40 L22 28 L42 28 L48 40 Z' fill='url(#gold)' stroke='#92400e'/>
    <text x='32' y='54' text-anchor='middle' font-size='10' fill='#fbbf24' font-weight='600'>XAU/USD</text>
  </svg>`)}`,
  
  GOLD: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='gold' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#fbbf24'/><stop offset='0.5' stop-color='#f59e0b'/><stop offset='1' stop-color='#d97706'/>
    </linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#1e1b4b'/>
    <circle cx='32' cy='30' r='16' fill='url(#gold)'/>
    <text x='32' y='35' text-anchor='middle' font-size='12' fill='#1e1b4b' font-weight='bold'>AU</text>
    <text x='32' y='54' text-anchor='middle' font-size='10' fill='#fbbf24' font-weight='600'>GOLD</text>
  </svg>`)}`,
  
  XAGUSD: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='silver' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#e2e8f0'/><stop offset='0.5' stop-color='#94a3b8'/><stop offset='1' stop-color='#64748b'/>
    </linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#0f172a'/>
    <circle cx='32' cy='30' r='16' fill='url(#silver)'/>
    <text x='32' y='35' text-anchor='middle' font-size='12' fill='#0f172a' font-weight='bold'>AG</text>
    <text x='32' y='54' text-anchor='middle' font-size='9' fill='#94a3b8' font-weight='600'>SILVER</text>
  </svg>`)}`,
  
  EURUSD: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='eu' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#3b82f6'/><stop offset='1' stop-color='#1d4ed8'/></linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#0f172a'/>
    <circle cx='32' cy='30' r='16' fill='url(#eu)'/>
    <text x='32' y='35' text-anchor='middle' font-size='14' fill='white' font-weight='bold'>€</text>
    <text x='32' y='54' text-anchor='middle' font-size='9' fill='#3b82f6' font-weight='600'>EUR/USD</text>
  </svg>`)}`,
  
  GBPUSD: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='gbp' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#8b5cf6'/><stop offset='1' stop-color='#6d28d9'/></linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#0f172a'/>
    <circle cx='32' cy='30' r='16' fill='url(#gbp)'/>
    <text x='32' y='35' text-anchor='middle' font-size='14' fill='white' font-weight='bold'>£</text>
    <text x='32' y='54' text-anchor='middle' font-size='9' fill='#8b5cf6' font-weight='600'>GBP/USD</text>
  </svg>`)}`,
  
  USDJPY: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs><linearGradient id='jpy' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ef4444'/><stop offset='1' stop-color='#dc2626'/></linearGradient></defs>
    <rect width='64' height='64' rx='14' fill='#0f172a'/>
    <circle cx='32' cy='30' r='16' fill='url(#jpy)'/>
    <text x='32' y='35' text-anchor='middle' font-size='14' fill='white' font-weight='bold'>¥</text>
    <text x='32' y='54' text-anchor='middle' font-size='9' fill='#ef4444' font-weight='600'>USD/JPY</text>
  </svg>`)}`,
};

/**
 * Get best available icon for an asset
 * Priority: CoinGecko image > Premium SVG > Generated Letter Icon
 */
const getAssetIconUrl = (symbol, coinGeckoImage, assetClass = "crypto") => {
  // 1. Use CoinGecko image if available
  if (coinGeckoImage && !coinGeckoImage.includes("missing")) {
    return coinGeckoImage;
  }
  
  // 2. Check for premium icons (Gold/Forex)
  const upperSymbol = String(symbol).toUpperCase();
  if (PREMIUM_ICONS[upperSymbol]) {
    return PREMIUM_ICONS[upperSymbol];
  }
  
  // 3. Generate letter icon as fallback
  return generateLetterIcon(symbol, assetClass);
};

// Fallback images (kept for backwards compatibility)
const GOLD_ICON = PREMIUM_ICONS.XAUUSD;
const FOREX_ICON = PREMIUM_ICONS.EURUSD;
const FALLBACK_IMAGE = generateLetterIcon("COIN", "crypto");

// Premium styling for safe-haven assets (Gold, JPY)
const getSafeHavenStyles = (symbolOrId) => {
  if (!isSafeHavenAsset(symbolOrId)) return {};
  return {
    borderClass: "border-amber-500/30 hover:border-amber-400/50",
    glowClass: "shadow-amber-500/10",
    textClass: "text-amber-300",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  };
};
const FALLBACK_META = supportedCoins.reduce((acc, coin) => {
  acc[coin.id] = { symbol: coin.symbol, name: coin.name };
  return acc;
}, {});
const SUPPORTED_IDS = new Set(COIN_BATCH_IDS);
const GRID_LAYOUT = "grid grid-cols-6 gap-4 items-center";

const titleCase = (value) =>
  value
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");

const buildFallbackAsset = (id) => {
  const meta = FALLBACK_META[id] || { symbol: id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase(), name: titleCase(id) };
  const assetId = meta.symbol.endsWith("USD") ? meta.symbol : `${meta.symbol}USD`;
  const binanceSymbol = meta.symbol.endsWith("USDT") ? meta.symbol : `${meta.symbol}USDT`;
  return {
    id,
    assetId,
    symbol: meta.symbol,
    name: meta.name,
    image: FALLBACK_IMAGE,
    marketCap: 0,
    basePrice: null,
    change24h: null,
    binanceSymbol,
  };
};

const FALLBACK_ASSETS = COIN_BATCH_IDS.slice(0, TOP_LIMIT).map((id) => buildFallbackAsset(id));

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1e12) return `$${safeFixed(Number(value / 1e12) || 0, 2)}T`;
  if (value >= 1e9) return `$${safeFixed(Number(value / 1e9) || 0, 2)}B`;
  if (value >= 1e6) return `$${safeFixed(Number(value / 1e6) || 0, 2)}M`;
  if (value >= 1e3) return `$${safeFixed(Number(value / 1e3) || 0, 2)}K`;
  return `$${safeFixed(Number(value) || 0, 2)}`;
};

const formatPrice = (value, placeholder = "--") => {
  if (!Number.isFinite(value)) return placeholder;
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${safeFixed(Number(value) || 0, 2)}`;
  if (value >= 0.01) return `$${safeFixed(Number(value) || 0, 4)}`;
  return `$${safeFixed(Number(value) || 0, 6)}`;
};

const buildAssetFromCoin = (coin) => {
  const rawSymbol = (coin?.symbol || "").toUpperCase();
  const baseSymbol = rawSymbol.endsWith("USD") ? rawSymbol.slice(0, -3) : rawSymbol;
  const assetId = (coin?.assetId || (baseSymbol ? `${baseSymbol}USD` : rawSymbol)).toUpperCase();
  const binanceSymbol = baseSymbol ? `${baseSymbol}USDT` : rawSymbol.endsWith("USDT") ? rawSymbol : `${rawSymbol}USDT`;
  const basePrice = Number(coin?.current_price);
  const change24h = Number(coin?.price_change_percentage_24h);
  return {
    id: coin?.id,
    assetId,
    symbol: baseSymbol || rawSymbol,
    name: coin?.name,
    image: coin?.image,
    marketCap: Number(coin?.market_cap) || 0,
    basePrice: Number.isFinite(basePrice) ? basePrice : null,
    change24h: Number.isFinite(change24h) ? change24h : null,
    priceSource: coin?.price_source || coin?.provider || null,
    binanceSymbol,
  };
};

const runQueue = async (items, worker, concurrency = FETCH_CONCURRENCY, signal) => {
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      if (signal?.aborted) return;
      const item = items[index];
      if (!item) continue;
      try {
        await worker(item);
      } catch {
        // Swallow per-item errors to keep the queue alive.
      }
    }
  });
  await Promise.all(workers);
};

const pickSample = (list, count) => {
  if (list.length <= count) return list;
  const sample = [];
  for (let i = 0; i < count; i += 1) {
    sample.push(list[Math.floor(Math.random() * list.length)]);
  }
  return sample;
};

const computeAtrPct = (candles) => {
  if (!Array.isArray(candles) || candles.length < 2) return null;
  let trSum = 0;
  let trCount = 0;
  for (let i = 1; i < candles.length; i += 1) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const prevClose = Number(prev?.c ?? prev?.close);
    const high = Number(curr?.h ?? curr?.high);
    const low = Number(curr?.l ?? curr?.low);
    if (!Number.isFinite(prevClose) || !Number.isFinite(high) || !Number.isFinite(low)) continue;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
    trCount += 1;
  }
  if (!trCount) return null;
  const atr = trSum / trCount;
  const last = candles[candles.length - 1];
  const lastClose = Number(last?.c ?? last?.close);
  if (!Number.isFinite(lastClose) || lastClose === 0) return null;
  return (atr / lastClose) * 100;
};

const getMarketSentiment = (change24h, signalScore) => {
  if (!Number.isFinite(change24h) && !Number.isFinite(signalScore)) return "Neutral - Loading";
  const change = Number.isFinite(change24h) ? change24h : 0;
  const score = Number.isFinite(signalScore) ? signalScore : 50;
  if (change >= 3 && score >= 70) return "Whale Accumulation";
  if (change >= 1.2) return "Bullish Momentum";
  if (change <= -3 && score <= 45) return "Distribution Pressure";
  if (change <= -1.2) return "Risk Off";
  return "Neutral Range";
};

const getVolatilityStatus = ({ atrPct, volatilityScore } = {}) => {
  if (!Number.isFinite(atrPct)) return "Volatility Loading";
  if (volatilityScore >= 0.85) return "Low-Risk Entry";
  if (atrPct >= 4) return "Overheated - Caution";
  if (atrPct <= 0.4) return "Low Volatility";
  if (volatilityScore >= 0.6) return "Active Range";
  return "Balanced";
};

const getTrendConfirmation = (change24h, sparkline) => {
  if (!Array.isArray(sparkline) || sparkline.length < 2) return "RSI/MACD Loading";
  const start = sparkline[0];
  const end = sparkline[sparkline.length - 1];
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "RSI/MACD Loading";
  const slope = end - start;
  const change = Number.isFinite(change24h) ? change24h : 0;
  if (slope > 0 && change > 0) return "RSI/MACD Confirmed";
  if (slope < 0 && change < 0) return "RSI/MACD Bear Confirm";
  return "RSI/MACD Divergence";
};

const PriceChange = ({ value }) => {
  if (!Number.isFinite(value)) return <span className="text-slate-500">--</span>;
  const positive = value >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 ${positive ? "text-emerald-400" : "text-red-400"}`}>
      <Icon className="w-3 h-3" />
      {safeFixed(Number(Math.abs(value)) || 0, 2)}%
    </span>
  );
};

PriceChange.propTypes = {
  value: PropTypes.number,
};

const MarketRow = React.memo(({ asset, index, sparkline, signalScore, isLoading, onAssetSelect }) => {
  const navigate = useNavigate();
  const setSelectedAssetId = usePriceStore((state) => state.setSelectedAssetId);
  const prevPriceRef = useRef(null);
  const [tick, setTick] = useState(null);

  // Get universal asset config for proper TradingView symbol
  const assetConfig = useMemo(() => getUniversalAssetConfig(asset.symbol || asset.assetId), [asset.symbol, asset.assetId]);
  const assetClass = assetConfig.assetClass;
  const isSafeHaven = assetConfig.isSafeHaven;
  
  // Resolve icon - use universal mapping for Gold/Forex, generated letter icons for missing
  const resolvedIcon = useMemo(() => {
    const symbol = asset.symbol || asset.assetId;
    const upperSymbol = String(symbol).toUpperCase();
    
    // Priority 1: Premium icons for Gold/Forex
    if (PREMIUM_ICONS[upperSymbol]) {
      return PREMIUM_ICONS[upperSymbol];
    }
    
    // Priority 2: CoinGecko image for crypto
    if (asset.image && !asset.image.includes("missing") && assetClass === ASSET_CLASS.CRYPTO) {
      return asset.image;
    }
    
    // Priority 3: Universal mapping
    if (assetClass !== ASSET_CLASS.CRYPTO) {
      return getAssetIcon(symbol);
    }
    
    // Priority 4: Generate letter icon
    return getAssetIconUrl(symbol, asset.image, assetClass);
  }, [asset.symbol, asset.image, asset.assetId, assetClass]);

  // SINGLE SOURCE OF TRUTH - Use unified price for consistency
  const unifiedPrice = useUnifiedPrice(asset.assetId, asset.basePrice);
  const displayPrice = unifiedPrice.lastPrice;
  
  // Get additional price state for 24h change
  const priceState = usePriceStore((state) => state.selectPriceAsset(asset.assetId));
  const change24h = Number.isFinite(priceState.restChange24h) ? priceState.restChange24h : asset.change24h;
  const integrityWarning = priceState.integrityWarning;
  const priceLabel = formatPrice(displayPrice, isLoading ? "Loading..." : "N/A");

  const tickPrice = displayPrice;

  // Optimized tick animation - uses useLayoutEffect for synchronous DOM updates
  // Prevents visual hiccups from React batching
  useLayoutEffect(() => {
    if (!Number.isFinite(tickPrice)) return;
    
    const prevPrice = prevPriceRef.current;
    if (prevPrice === null) {
      prevPriceRef.current = tickPrice;
      return;
    }

    // Only trigger animation if price actually changed
    if (tickPrice === prevPrice) return;

    // Use requestAnimationFrame to schedule state update (avoids sync setState in effect)
    const direction = tickPrice > prevPrice ? "up" : "down";
    const rafId = window.requestAnimationFrame(() => {
      setTick(direction);
    });
    prevPriceRef.current = tickPrice;

    // Clear animation after 400ms
    const timeout = setTimeout(() => setTick(null), 400);
    return () => {
      window.cancelAnimationFrame(rafId);
      clearTimeout(timeout);
    };
  }, [tickPrice]);

  const sparklineColor = change24h >= 0 ? "#10b981" : "#ef4444";
  const scoreLabel = Number.isFinite(signalScore) ? `${signalScore}` : "--";

  // Deep-link navigation with correct TradingView ticker
  const handleNavigate = useCallback(() => {
    const routeSymbol = asset.symbol || asset.assetId;
    const tvSymbol = getTradingViewWidgetSymbol(routeSymbol);
    
    if (onAssetSelect) {
      // Pass full config for TradingView integration
      onAssetSelect(routeSymbol, { tvSymbol, assetClass, isSafeHaven });
      return;
    }
    setSelectedAssetId(asset.assetId);
    // Navigate with TradingView symbol in state
    navigate(`/trading/${routeSymbol}`, { 
      state: { tvSymbol, assetClass, isSafeHaven } 
    });
  }, [asset.assetId, asset.symbol, navigate, onAssetSelect, setSelectedAssetId, assetClass, isSafeHaven]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate]
  );

  const rowFlashClass =
    tick === "up" ? "bg-emerald-500/10" : tick === "down" ? "bg-red-500/10" : "";
  
  // Premium styling for safe-haven assets
  const safeHavenClass = isSafeHaven 
    ? "border-l-2 border-l-amber-500/50" 
    : "";

  return (
    <tr
      className={`${GRID_LAYOUT} border-b border-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer ${rowFlashClass} ${safeHavenClass}`}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Open ${asset.name}`}
    >
      <td className="px-4 py-3 text-sm text-slate-500">{index + 1}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 group">
          {/* Universal icon resolution - SVG for Gold/Forex, URL for Crypto */}
          {typeof resolvedIcon === 'string' && resolvedIcon.startsWith('<svg') ? (
            <div 
              className="w-8 h-8 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: resolvedIcon }}
            />
          ) : (
            <img src={resolvedIcon} alt={asset.name} className="w-8 h-8 rounded-full" loading="lazy" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium group-hover:text-cyan-300 transition-colors">{asset.name}</span>
              {isSafeHaven && <Shield className="w-4 h-4 text-amber-400" title="Safe Haven Asset" />}
            </div>
            <div className="text-xs text-slate-500 uppercase flex items-center gap-1">
              {asset.symbol}
              {assetClass !== ASSET_CLASS.CRYPTO && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400">
                  {assetClass}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold transition-colors ${tick === "up" ? "text-emerald-300" : tick === "down" ? "text-red-300" : "text-white"
              }`}
          >
            {priceLabel}
          </span>
          {priceState.wsStatus === "live" && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          {integrityWarning && <span className="h-2 w-2 rounded-full bg-amber-400" title="REST vs WS mismatch" />}
        </div>
        <div className="mt-2">
          <SparklineCanvas data={sparkline} stroke={sparklineColor} />
        </div>
      </td>
      <td className="px-4 py-3">
        <PriceChange value={change24h} />
      </td>
      <td className="px-4 py-3 text-slate-300">{formatNumber(asset.marketCap)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700/70 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-100 hover:text-cyan-200 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              handleNavigate();
            }}
          >
            Trade
          </button>
          <span className="text-xs text-cyan-300">AI {scoreLabel}</span>
        </div>
      </td>
    </tr>
  );
});

MarketRow.displayName = "MarketRow";

MarketRow.propTypes = {
  asset: PropTypes.shape({
    assetId: PropTypes.string.isRequired,
    symbol: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    marketCap: PropTypes.number,
    basePrice: PropTypes.number,
    change24h: PropTypes.number,
  }).isRequired,
  index: PropTypes.number.isRequired,
  sparkline: PropTypes.arrayOf(PropTypes.number),
  signalScore: PropTypes.number,
  isLoading: PropTypes.bool,
  onAssetSelect: PropTypes.func,
};

export default function MarketTable({ onAssetSelect }) {
  const connectMany = usePriceStore((state) => state.connectMany);
  const disconnectMany = usePriceStore((state) => state.disconnectMany);
  const setRestSnapshot = usePriceStore((state) => state.setRestSnapshot);
  const setIntegrityWarning = usePriceStore((state) => state.setIntegrityWarning);
  const getMarketDataCache = usePriceStore((state) => state.getMarketDataCache);
  const setMarketDataCache = usePriceStore((state) => state.setMarketDataCache);
  const [assets, setAssets] = useState([]);
  const [sparklineMap, setSparklineMap] = useState({});
  const [signalScores, setSignalScores] = useState({});
  const [volatilityMap, setVolatilityMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const wsKeyRef = useRef("");
  const assetsRef = useRef([]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    const title = "Live Crypto Market Signals | Vision AI Mind";
    const description = "Echtzeit-Preise und AI-Signale fuer die Top 55 Cryptos";
    document.title = title;
    let tag = document.querySelector("meta[name='description']");
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description);
  }, []);

  const subscribeToPriceUpdates = useCallback(
    (list) => {
      if (!Array.isArray(list) || !list.length) return;
      const nextKey = list.map((asset) => asset.assetId).join(",");
      if (wsKeyRef.current === nextKey) return;
      wsKeyRef.current = nextKey;
      connectMany(
        list.map((asset) => ({
          assetId: asset.assetId,
          binanceSymbol: asset.binanceSymbol,
          isCrypto: true,
        }))
      );
    },
    [connectMany]
  );

  // Helper to build Gold/Forex assets from API response
  const buildGoldForexAsset = (item) => ({
    id: item.id,
    symbol: item.symbol,
    name: item.name,
    assetId: item.symbol,
    binanceSymbol: null, // Gold/Forex not on Binance
    tradingViewSymbol: item.tradingViewSymbol,
    image: PREMIUM_ICONS[item.symbol] || null,
    basePrice: item.price,
    change24h: item.change24h,
    marketCap: null, // Not applicable for forex
    priceSource: item.assetClass === "commodity" ? "oanda" : "fx_idc",
    assetClass: item.assetClass,
    isSafeHaven: item.isSafeHaven,
    rank: item.symbol === "XAUUSD" ? 100 : item.symbol === "XAGUSD" ? 104 : 101,
  });

  const loadAssets = useCallback(
    async (signal, showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      try {
        const cached = getMarketDataCache();
        if (cached?.length) {
          setAssets(cached);
          subscribeToPriceUpdates(cached.filter(a => a.binanceSymbol)); // Only crypto for WS
          cached.forEach((asset) => {
            setRestSnapshot(asset.assetId, {
              price: asset.basePrice,
              change24h: asset.change24h,
              provider: asset.priceSource,
              latencyMs: null,
              updatedAt: Date.now(),
            });
          });
          setError("");
          return;
        }

        // Fetch crypto, gold, and forex in parallel
        const startedAt = Date.now();
        const idsParam = COIN_BATCH_IDS.slice(0, TOP_LIMIT).join(",");
        
        const [cryptoRes, goldRes, forexRes] = await Promise.all([
          fetch(`/api/coins?ids=${encodeURIComponent(idsParam)}`, { signal }),
          fetch("/api/gold", { signal }).catch(() => ({ ok: false })),
          fetch("/api/forex", { signal }).catch(() => ({ ok: false })),
        ]);
        
        const latencyMs = Date.now() - startedAt;
        let allAssets = [];
        const updatedAt = Date.now();

        // Process crypto response
        if (cryptoRes.ok) {
          const rawText = await cryptoRes.text();
          let payload = null;
          try {
            payload = rawText ? JSON.parse(rawText) : null;
          } catch (parseError) {
            console.error("Invalid crypto JSON:", rawText.slice(0, 160));
          }
          if (payload?.success) {
            const cryptoList = (payload.data || [])
              .filter((coin) => SUPPORTED_IDS.has(coin.id))
              .slice(0, TOP_LIMIT)
              .map((coin) => buildAssetFromCoin(coin))
              .filter((asset) => asset.id && asset.symbol);
            allAssets = [...allAssets, ...cryptoList];
          }
        }

        // Process gold response
        if (goldRes.ok) {
          try {
            const goldPayload = await goldRes.json();
            if (goldPayload?.ok && Array.isArray(goldPayload.data)) {
              const goldAssets = goldPayload.data.map(buildGoldForexAsset);
              allAssets = [...allAssets, ...goldAssets];
            }
          } catch (err) {
            console.error("Failed to parse gold data:", err);
          }
        }

        // Process forex response
        if (forexRes.ok) {
          try {
            const forexPayload = await forexRes.json();
            if (forexPayload?.ok && Array.isArray(forexPayload.data)) {
              const forexAssets = forexPayload.data.map(buildGoldForexAsset);
              allAssets = [...allAssets, ...forexAssets];
            }
          } catch (err) {
            console.error("Failed to parse forex data:", err);
          }
        }

        // Sort by rank (crypto first, then gold/forex)
        allAssets.sort((a, b) => (a.rank || 999) - (b.rank || 999));
        
        if (allAssets.length === 0) {
          throw new Error("No assets loaded from any source");
        }

        setAssets(allAssets);
        setMarketDataCache(allAssets, updatedAt);
        
        // Subscribe only crypto assets to WebSocket (Gold/Forex use REST polling)
        const cryptoAssets = allAssets.filter(a => a.binanceSymbol);
        subscribeToPriceUpdates(cryptoAssets);
        
        allAssets.forEach((asset) => {
          setRestSnapshot(asset.assetId, {
            price: asset.basePrice,
            change24h: asset.change24h,
            provider: asset.priceSource,
            latencyMs,
            updatedAt,
          });
        });
        setError("");
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Fetch Error:", err);
        setError(err?.message || "Failed to load assets");
        if (!assetsRef.current.length) {
          setAssets(FALLBACK_ASSETS);
          subscribeToPriceUpdates(FALLBACK_ASSETS);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getMarketDataCache, setMarketDataCache, setRestSnapshot, subscribeToPriceUpdates]
  );

  const loadRestSnapshots = useCallback(
    async (list, signal) => {
      if (!list.length) return;
      const cached = getMarketDataCache();
      if (cached?.length) {
        cached.forEach((asset) => {
          setRestSnapshot(asset.assetId, {
            price: asset.basePrice,
            change24h: asset.change24h,
            provider: asset.priceSource,
            latencyMs: null,
            updatedAt: Date.now(),
          });
        });
        return;
      }
      const idsParam = list
        .map((asset) => asset.id)
        .filter(Boolean)
        .join(",");
      if (!idsParam) return;
      try {
        const startedAt = Date.now();
        const response = await fetch(`/api/coins?ids=${encodeURIComponent(idsParam)}`, { signal });
        const rawText = await response.text();
        const latencyMs = Date.now() - startedAt;
        let payload = null;
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
          throw new Error(`Invalid JSON response: ${rawText.slice(0, 160)}`);
        }
        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
        }
        if (!payload?.success) throw new Error(payload?.error || "Failed to load market snapshots");
        const timestampMs = payload?.timestamp ? Date.parse(payload.timestamp) : NaN;
        const updatedAt = Number.isFinite(timestampMs) ? timestampMs : Date.now();
        const coinMap = new Map(
          (payload.data || [])
            .filter((coin) => SUPPORTED_IDS.has(coin.id))
            .map((coin) => [coin.id, buildAssetFromCoin(coin)])
        );
        const nextAssets = list.map((asset) => coinMap.get(asset.id) ?? asset);
        setMarketDataCache(nextAssets, updatedAt);
        nextAssets.forEach((asset) => {
          setRestSnapshot(asset.assetId, {
            price: asset.basePrice,
            change24h: asset.change24h,
            provider: asset.priceSource,
            latencyMs,
            updatedAt,
          });
        });
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Market snapshot error:", err);
      }
    },
    [getMarketDataCache, setMarketDataCache, setRestSnapshot]
  );

  const loadSparklines = useCallback(async (list, signal) => {
    await runQueue(
      list,
      async (asset) => {
        try {
          const params = new URLSearchParams({
            asset: asset.assetId,
            interval: String(SPARKLINE_INTERVAL),
            limit: String(SPARKLINE_LIMIT),
          });
          const response = await fetch(`/api/ohlc?${params.toString()}`, { signal });
          const payload = await response.json();
          if (!payload?.ok || !Array.isArray(payload.data)) return;
          const closes = payload.data
            .map((row) => Number(row?.c ?? row?.close))
            .filter((value) => Number.isFinite(value));
          if (closes.length) {
            setSparklineMap((prev) => ({ ...prev, [asset.assetId]: closes }));
          }
          const atrPct = computeAtrPct(payload.data);
          if (Number.isFinite(atrPct)) {
            const volScore = computeVolatilityScore(atrPct);
            setVolatilityMap((prev) => ({ ...prev, [asset.assetId]: { atrPct, volatilityScore: volScore } }));
          }
          
          // Fetch real AI signal score from backend 8-point algorithm
          try {
            const signalResponse = await fetch(`/api/signal?asset=${asset.assetId}`, { signal });
            const signalPayload = await signalResponse.json();
            if (signalPayload?.ok && signalPayload?.data) {
              // Use confidence from 8-point algorithm (0-100 scale)
              const confidence = signalPayload.data.confidence ?? 50;
              // Combine with buy/sell score for final AI score
              const buyScore = signalPayload.data.buyScore ?? 0;
              const sellScore = signalPayload.data.sellScore ?? 0;
              const signalDirection = signalPayload.data.signal;
              
              // Calculate composite score: higher = more bullish signal
              let aiScore = 50; // neutral default
              if (signalDirection === "BUY") {
                aiScore = Math.min(95, 50 + confidence * 0.45);
              } else if (signalDirection === "SELL") {
                aiScore = Math.max(5, 50 - confidence * 0.45);
              } else {
                // HOLD - slight adjustment based on net score
                const netScore = buyScore - sellScore;
                aiScore = Math.max(30, Math.min(70, 50 + netScore * 0.1));
              }
              setSignalScores((prev) => ({ ...prev, [asset.assetId]: Math.round(aiScore) }));
            } else {
              // Fallback to volatility-based score if signal API fails
              const atrPct = computeAtrPct(payload.data);
              if (Number.isFinite(atrPct)) {
                const volScore = computeVolatilityScore(atrPct);
                const edgeScore = computeEdgeScore({ technical: volScore, fundamental: 0.5, liquidity: 0.5 });
                setSignalScores((prev) => ({ ...prev, [asset.assetId]: Math.round(edgeScore * 100) }));
              }
            }
          } catch (signalErr) {
            // Silent fallback to volatility score
            const atrPct = computeAtrPct(payload.data);
            if (Number.isFinite(atrPct)) {
              const volScore = computeVolatilityScore(atrPct);
              const edgeScore = computeEdgeScore({ technical: volScore, fundamental: 0.5, liquidity: 0.5 });
              setSignalScores((prev) => ({ ...prev, [asset.assetId]: Math.round(edgeScore * 100) }));
            }
          }
        } catch (err) {
          if (err?.name === "AbortError") return;
          throw err;
        }
      },
      FETCH_CONCURRENCY,
      signal
    );
  }, []);

  const verifyDataIntegrity = useCallback(
    (assetIds) => {
      const store = usePriceStore.getState();
      const sample = pickSample(assetIds, INTEGRITY_SAMPLE_SIZE);
      sample.forEach((assetId) => {
        const state = store.assets?.[assetId];
        const live = state?.livePrice;
        const rest = state?.restPrice;
        if (!Number.isFinite(live) || !Number.isFinite(rest) || rest <= 0) return;
        const delta = Math.abs(live - rest) / rest;
        setIntegrityWarning(assetId, delta > INTEGRITY_THRESHOLD, delta);
      });
    },
    [setIntegrityWarning]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAssets(controller.signal);
    return () => controller.abort();
  }, [loadAssets]);

  useEffect(() => {
    if (!error) return undefined;
    const controller = new AbortController();
    const retry = () => loadAssets(controller.signal);
    const timer = setInterval(retry, REST_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [error, loadAssets]);

  useEffect(() => {
    return () => {
      wsKeyRef.current = "";
      disconnectMany();
    };
  }, [disconnectMany]);

  useEffect(() => {
    if (!assets.length) return;
    const controller = new AbortController();
    loadSparklines(assets, controller.signal);
    return () => controller.abort();
  }, [assets, loadSparklines]);

  useEffect(() => {
    if (!assets.length) return;
    const controller = new AbortController();
    const assetIds = assets.map((asset) => asset.assetId);
    const poll = async () => {
      await loadRestSnapshots(assets, controller.signal);
      verifyDataIntegrity(assetIds);
    };
    poll();
    const timer = setInterval(poll, REST_POLL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [assets, loadRestSnapshots, verifyDataIntegrity]);

  const sortedAssets = useMemo(() => {
    const list = [...assets];
    list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return list;
  }, [assets]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Market Hub</h1>
          <p className="text-slate-400">Top 55 coins with live WebSocket ticks and integrity checks.</p>
        </div>
        <button
          onClick={() => loadAssets(new AbortController().signal, true)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-2 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]" aria-label="Market assets">
            <thead>
              <tr className={`${GRID_LAYOUT} text-left text-xs font-semibold uppercase text-slate-400 border-b border-slate-800/70 bg-slate-900/70`}>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">24h %</th>
                <th className="px-4 py-3">Market Cap</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={`${GRID_LAYOUT}`}>
                  <td className="col-span-6 px-4 py-6 text-center text-slate-500">Loading market data...</td>
                </tr>
              ) : sortedAssets.length === 0 ? (
                <tr className={`${GRID_LAYOUT}`}>
                  <td className="col-span-6 px-4 py-6 text-center text-slate-500">No assets available.</td>
                </tr>
              ) : (
                sortedAssets.map((asset, index) => (
                  <MarketRow
                    key={asset.assetId}
                    asset={asset}
                    index={index}
                    sparkline={sparklineMap[asset.assetId]}
                    signalScore={signalScores[asset.assetId]}
                    isLoading={loading}
                    onAssetSelect={onAssetSelect}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

MarketTable.propTypes = {
  onAssetSelect: PropTypes.func,
};
