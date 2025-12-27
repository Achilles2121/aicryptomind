// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Info, RefreshCw } from "lucide-react";
import { usePriceStore } from "../../stores/usePriceStore";
import { computeEdgeScore, computeVolatilityScore } from "../../lib/strategyEngineV3";
import SparklineCanvas from "./SparklineCanvas";

const TOP_LIMIT = 50;
const REST_POLL_MS = 30000;
const SPARKLINE_INTERVAL = 60;
const SPARKLINE_LIMIT = 24;
const INTEGRITY_SAMPLE_SIZE = 8;
const INTEGRITY_THRESHOLD = 0.005;
const FETCH_CONCURRENCY = 6;
const COIN_BATCH_IDS = [
  "bitcoin",
  "ethereum",
  "tether",
  "binancecoin",
  "ripple",
  "usd-coin",
  "solana",
  "tron",
  "staked-ether",
  "dogecoin",
  "figure-heloc",
  "cardano",
  "whitebit",
  "wrapped-steth",
  "bitcoin-cash",
  "wrapped-bitcoin",
  "wrapped-beacon-eth",
  "usds",
  "wrapped-eeth",
  "binance-bridged-usdt-bnb-smart-chain",
  "chainlink",
  "monero",
  "weth",
  "leo-token",
  "stellar",
  "zcash",
  "ethena-usde",
  "coinbase-wrapped-btc",
  "litecoin",
  "hyperliquid",
  "sui",
  "avalanche-2",
  "hedera-hashgraph",
  "susds",
  "dai",
  "usdt0",
  "shiba-inu",
  "paypal-usd",
  "uniswap",
  "crypto-com-chain",
  "the-open-network",
  "world-liberty-financial",
  "mantle",
  "ethena-staked-usde",
  "canton-network",
  "polkadot",
  "usd1-wlfi",
  "rain",
  "bitget-token",
  "tether-gold",
];
const FALLBACK_IMAGE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#34d399'/>
      <stop offset='1' stop-color='#22d3ee'/>
    </linearGradient>
  </defs>
  <circle cx='32' cy='32' r='28' fill='url(#g)'/>
  <circle cx='32' cy='32' r='16' fill='rgba(15,23,42,0.7)'/>
</svg>`;
const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(FALLBACK_IMAGE_SVG)}`;
const FALLBACK_META = {
  bitcoin: { symbol: "BTC", name: "Bitcoin" },
  ethereum: { symbol: "ETH", name: "Ethereum" },
  tether: { symbol: "USDT", name: "Tether" },
  binancecoin: { symbol: "BNB", name: "Binance Coin" },
  ripple: { symbol: "XRP", name: "XRP" },
  "usd-coin": { symbol: "USDC", name: "USD Coin" },
  solana: { symbol: "SOL", name: "Solana" },
  tron: { symbol: "TRX", name: "Tron" },
  "staked-ether": { symbol: "STETH", name: "Staked Ether" },
  dogecoin: { symbol: "DOGE", name: "Dogecoin" },
  "figure-heloc": { symbol: "FHL", name: "Figure Heloc" },
  cardano: { symbol: "ADA", name: "Cardano" },
  whitebit: { symbol: "WBT", name: "WhiteBIT" },
  "wrapped-steth": { symbol: "WSTETH", name: "Wrapped stETH" },
  "bitcoin-cash": { symbol: "BCH", name: "Bitcoin Cash" },
  "wrapped-bitcoin": { symbol: "WBTC", name: "Wrapped Bitcoin" },
  "wrapped-beacon-eth": { symbol: "WBETH", name: "Wrapped Beacon ETH" },
  usds: { symbol: "USDS", name: "USDS" },
  "wrapped-eeth": { symbol: "WEETH", name: "Wrapped eETH" },
  "binance-bridged-usdt-bnb-smart-chain": { symbol: "USDT", name: "Binance-Peg USDT" },
  chainlink: { symbol: "LINK", name: "Chainlink" },
  monero: { symbol: "XMR", name: "Monero" },
  weth: { symbol: "WETH", name: "WETH" },
  "leo-token": { symbol: "LEO", name: "LEO Token" },
  stellar: { symbol: "XLM", name: "Stellar" },
  zcash: { symbol: "ZEC", name: "Zcash" },
  "ethena-usde": { symbol: "USDE", name: "Ethena USDe" },
  "coinbase-wrapped-btc": { symbol: "CBBTC", name: "Coinbase Wrapped BTC" },
  litecoin: { symbol: "LTC", name: "Litecoin" },
  hyperliquid: { symbol: "HYPE", name: "Hyperliquid" },
  sui: { symbol: "SUI", name: "Sui" },
  "avalanche-2": { symbol: "AVAX", name: "Avalanche" },
  "hedera-hashgraph": { symbol: "HBAR", name: "Hedera" },
  susds: { symbol: "SUSDS", name: "sUSDS" },
  dai: { symbol: "DAI", name: "Dai" },
  usdt0: { symbol: "USDT0", name: "USDT0" },
  "shiba-inu": { symbol: "SHIB", name: "Shiba Inu" },
  "paypal-usd": { symbol: "PYUSD", name: "PayPal USD" },
  uniswap: { symbol: "UNI", name: "Uniswap" },
  "crypto-com-chain": { symbol: "CRO", name: "Cronos" },
  "the-open-network": { symbol: "TON", name: "Toncoin" },
  "world-liberty-financial": { symbol: "WLFI", name: "World Liberty Financial" },
  mantle: { symbol: "MNT", name: "Mantle" },
  "ethena-staked-usde": { symbol: "SUSDE", name: "Ethena Staked USDe" },
  "canton-network": { symbol: "CANT", name: "Canton Network" },
  polkadot: { symbol: "DOT", name: "Polkadot" },
  "usd1-wlfi": { symbol: "USD1", name: "USD1 WLFI" },
  rain: { symbol: "RAIN", name: "Rain" },
  "bitget-token": { symbol: "BGB", name: "Bitget Token" },
  "tether-gold": { symbol: "XAUT", name: "Tether Gold" },
};

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
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const formatPrice = (value, placeholder = "--") => {
  if (!Number.isFinite(value)) return placeholder;
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
};

const buildAssetFromCoin = (coin) => {
  const symbol = (coin?.symbol || "").toUpperCase();
  const assetId = symbol.endsWith("USD") ? symbol : `${symbol}USD`;
  const binanceSymbol = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
  const basePrice = Number(coin?.current_price);
  const change24h = Number(coin?.price_change_percentage_24h);
  return {
    id: coin?.id,
    assetId,
    symbol,
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
      {Math.abs(value).toFixed(2)}%
    </span>
  );
};

PriceChange.propTypes = {
  value: PropTypes.number,
};

const MarketRow = React.memo(({ asset, sparkline, signalScore, isLoading, volatility }) => {
  const navigate = useNavigate();
  const priceAsset = usePriceStore((state) => state.selectPriceAsset(asset.assetId));
  const setSelectedAssetId = usePriceStore((state) => state.setSelectedAssetId);
  const prevPriceRef = useRef(null);
  const [tick, setTick] = useState(null);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPinned, setTooltipPinned] = useState(false);

  const livePrice = Number.isFinite(priceAsset.livePrice) ? priceAsset.livePrice : null;
  const restPrice = Number.isFinite(priceAsset.restPrice) ? priceAsset.restPrice : asset.basePrice;
  const displayPrice = Number.isFinite(livePrice) ? livePrice : restPrice;
  const change24h = Number.isFinite(priceAsset.restChange24h) ? priceAsset.restChange24h : asset.change24h;
  const integrityWarning = priceAsset.integrityWarning;
  const priceLabel = formatPrice(displayPrice, isLoading ? "Loading..." : "N/A");
  const sentimentLabel = getMarketSentiment(change24h, signalScore);
  const volatilityLabel = getVolatilityStatus(volatility);
  const trendLabel = getTrendConfirmation(change24h, sparkline);

  const openTooltip = () => setTooltipOpen(true);
  const closeTooltip = () => {
    if (!tooltipPinned) setTooltipOpen(false);
  };
  const toggleTooltip = (event) => {
    event.stopPropagation();
    setTooltipPinned((prev) => {
      const next = !prev;
      setTooltipOpen(next);
      return next;
    });
  };

  const tickPrice = Number.isFinite(livePrice) ? livePrice : null;

  useEffect(() => {
    if (!Number.isFinite(tickPrice)) return;
    if (prevPriceRef.current === null) {
      prevPriceRef.current = tickPrice;
      return;
    }

    // Prevent sync state update during render phase
    const updateTick = () => {
      if (tickPrice > prevPriceRef.current) setTick("up");
      else if (tickPrice < prevPriceRef.current) setTick("down");
      prevPriceRef.current = tickPrice;
    };

    // Using simple timeout 0 to defer update
    const defer = setTimeout(updateTick, 0);
    const timeout = setTimeout(() => setTick(null), 400);

    return () => {
      clearTimeout(defer);
      clearTimeout(timeout);
    };
  }, [tickPrice]);

  const sparklineColor = change24h >= 0 ? "#10b981" : "#ef4444";
  const scoreLabel = Number.isFinite(signalScore) ? `${signalScore}` : "--";

  const handleNavigate = useCallback(() => {
    setSelectedAssetId(asset.assetId);
    navigate(`/trading/${asset.assetId}`);
  }, [asset.assetId, navigate, setSelectedAssetId]);

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

  return (
    <tr
      className={`border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors cursor-pointer ${rowFlashClass}`}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
    >
      <td className="p-4 w-64">
        <div className="flex items-center gap-3 group">
          <img src={asset.image} alt={asset.name} className="w-8 h-8 rounded-full" loading="lazy" />
          <div>
            <div className="text-white font-medium group-hover:text-cyan-300 transition-colors">{asset.name}</div>
            <div className="text-xs text-slate-500 uppercase">{asset.symbol}</div>
          </div>
        </div>
      </td>
      <td className="p-4 w-40">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold transition-colors ${tick === "up" ? "text-emerald-300" : tick === "down" ? "text-red-300" : "text-white"
              }`}
          >
            {priceLabel}
          </span>
          {priceAsset.wsStatus === "live" && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
          {integrityWarning && <span className="h-2 w-2 rounded-full bg-amber-400" title="REST vs WS mismatch" />}
        </div>
        <div className="mt-2">
          <SparklineCanvas data={sparkline} stroke={sparklineColor} />
        </div>
      </td>
      <td className="p-4 w-32">
        <PriceChange value={change24h} />
      </td>
      <td className="p-4 w-48 text-slate-300">{formatNumber(asset.marketCap)}</td>
      <td className="p-4 w-32">
        <div className="relative inline-flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/60 px-3 py-1">
            <span className="text-xs text-slate-400">AI</span>
            <span className="text-sm font-semibold text-cyan-300">{scoreLabel}</span>
          </div>
          <div
            className="relative"
            onMouseEnter={openTooltip}
            onMouseLeave={closeTooltip}
            onFocus={openTooltip}
            onBlur={closeTooltip}
          >
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/70 bg-slate-900/80 text-slate-300 transition-colors hover:text-cyan-200"
              onClick={toggleTooltip}
              aria-label="AI Begruendung"
            >
              <Info size={14} />
            </button>
            {tooltipOpen && (
              <div className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-slate-700/70 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-lg">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">AI Insights</div>
                <div className="mt-2 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-400">Market Sentiment</span>
                    <span className="text-right text-slate-100">{sentimentLabel}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-400">Volatility</span>
                    <span className="text-right text-slate-100">{volatilityLabel}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-slate-400">Trend Status</span>
                    <span className="text-right text-slate-100">{trendLabel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

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
  sparkline: PropTypes.arrayOf(PropTypes.number),
  signalScore: PropTypes.number,
  isLoading: PropTypes.bool,
  volatility: PropTypes.shape({
    atrPct: PropTypes.number,
    volatilityScore: PropTypes.number,
  }),
};

export default function MarketTable() {
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
    const description = "Echtzeit-Preise und AI-Signale für die Top 50 Cryptos";
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

  const loadAssets = useCallback(
    async (signal, showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      try {
        const cached = getMarketDataCache();
        if (cached?.length) {
          setAssets(cached);
          subscribeToPriceUpdates(cached);
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
        const idsParam = COIN_BATCH_IDS.slice(0, TOP_LIMIT).join(",");
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
        if (!payload?.success) throw new Error(payload?.error || "Failed to load assets");
        const list = (payload.data || [])
          .slice(0, TOP_LIMIT)
          .map((coin) => buildAssetFromCoin(coin))
          .filter((asset) => asset.id && asset.symbol);
        const timestampMs = payload?.timestamp ? Date.parse(payload.timestamp) : NaN;
        const updatedAt = Number.isFinite(timestampMs) ? timestampMs : Date.now();
        setAssets(list);
        setMarketDataCache(list, updatedAt);
        subscribeToPriceUpdates(list);
        list.forEach((asset) => {
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
        const coinMap = new Map((payload.data || []).map((coin) => [coin.id, buildAssetFromCoin(coin)]));
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
            const edgeScore = computeEdgeScore({ technical: volScore, fundamental: 0.5, liquidity: 0.5 });
            setVolatilityMap((prev) => ({ ...prev, [asset.assetId]: { atrPct, volatilityScore: volScore } }));
            setSignalScores((prev) => ({ ...prev, [asset.assetId]: Math.round(edgeScore * 100) }));
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
          <p className="text-slate-400">Top 50 coins with live WebSocket ticks and integrity checks.</p>
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
          <table className="w-full min-w-[860px] table-fixed">
            <colgroup>
              <col className="w-64" />
              <col className="w-40" />
              <col className="w-32" />
              <col className="w-48" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-semibold uppercase text-slate-400 border-b border-slate-800/70 bg-slate-900/70">
                <th className="px-4 py-3 w-64">Asset</th>
                <th className="px-4 py-3 w-40">Price</th>
                <th className="px-4 py-3 w-32">24h Change</th>
                <th className="px-4 py-3 w-48">Market Cap</th>
                <th className="px-4 py-3 w-32">AI Signal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    Loading market data...
                  </td>
                </tr>
              ) : sortedAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No assets available.
                  </td>
                </tr>
              ) : (
                sortedAssets.map((asset) => (
                  <MarketRow
                    key={asset.assetId}
                    asset={asset}
                    sparkline={sparklineMap[asset.assetId]}
                    signalScore={signalScores[asset.assetId]}
                    isLoading={loading}
                    volatility={volatilityMap[asset.assetId]}
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
