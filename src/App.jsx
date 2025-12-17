// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Activity,
  AlertTriangle,
  Bell,
  Gauge,
  LineChart as LineChartIcon,
  PlugZap,
  RefreshCw,
  Shield,
  Signal,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { auth, login as fbLogin, signup as fbSignup, logout as fbLogout, saveUserTier } from "./firebase";
import { useUserTier } from "./context/UserTierContext";
import LockedCard from "./components/LockedCard";
import { APP_BRAND, APP_TAGLINE } from "./config/brand";
import { dataSources } from "./config/dataSources";
import { DEFAULT_MARKET_ID, MARKETS } from "./config/markets";
import CryptoEduChatCard from "./components/CryptoEduChatCard";
import FullScreenLoader from "./components/FullScreenLoader";
import { useEliteTrial } from "./hooks/useEliteTrial";
import { fetchEtfFlowSeriesLive } from "./services/etfFlowsLive";
const EtfHoldingsCard = lazy(() => import("./components/etf/EtfHoldingsCard"));
const EtfProviderQualityCard = lazy(() => import("./components/etf/EtfProviderQualityCard"));
import { fetchEtfHoldingsLive } from "./services/etfHoldingsLive";
const EtfCorrelationCard = lazy(() => import("./components/etf/EtfCorrelationCard"));
const TradingViewPanel = lazy(() => import("./components/TradingViewPanel"));
// TradingViewHeatmap is available for future use
import { safeFetch, subscribeToSourceHealth, getSourceHealthSnapshot } from "./lib/safeFetch";
import { loadChart, buildFallbackChart } from "./lib/chartLoader";
import { fetchHtfOhlc } from "./services/marketDataLive";
import { fetchDerivativesLive } from "./services/derivativesLive";
import {
  calculateEMA,
  calculateRSISeries,
  calculateMACDSeries,
  calculateBollingerBands,
  calculateStochRSI,
  calculateStochOsc,
  calculateCCI,
  calculateATR,
  calculateADX,
  calculateDonchian,
  calculateVWAP,
  calculateOBV,
  calculatePearson,
} from "./lib/indicators";
import { computeStopAndTarget } from "./lib/riskEngine";
import { buildAISignal, buildBacktestSignals, buildSignalsV3 } from "./lib/signalsV2";
import { runBacktestV3 } from "./lib/backtestV3";

const CACHE_TTL = 60 * 1000; // 60 seconds - faster updates for real-time feel
const OHLC_CACHE_TTL = 60 * 1000; // 60 seconds for candle data
const FNG_CACHE_TTL = 30 * 1000; // 30 seconds - Real-time sentiment updates
const POLL_INTERVAL = 15 * 1000; // 15 seconds - faster polling
const NEWS_REFRESH = 5 * 60 * 1000; // 5 minutes
const FLOWS_REFRESH = 5 * 60 * 1000; // 5 minutes
const DAY_MS = 24 * 60 * 60 * 1000;

const MARKET_OPTIONS = Object.values(MARKETS);
const ASSET_CLASS_LABELS = {
  crypto: "Crypto",
  index: "Indices",
  commodity: "Commodities",
  fx: "FX",
};

const _API_SOURCES_OLD = [
  {
    name: "DeFiLlama",
    desc: "DeFi-Yields, TVL, Chains - for Yield Tracker.",
    limit: "Unlimited free",
  },
  {
    name: "Santiment",
    desc: "On-Chain + Sentiment (Whale Alerts, Social Volume).",
    limit: "100 Calls/month free",
  },
  {
    name: "HuggingFace",
    desc: "AI-Predictions (Inference for Price-Forecast).",
    limit: "Free Inference",
  },
  {
    name: "Alpha Vantage",
    desc: "Vol-Forecast, Tech Indicators (ATR, Correlations).",
    limit: "25 Calls/Tag free",
  },
  {
    name: "FMP",
    desc: "Cross-Asset Data (Stocks/Crypto Corr).",
    limit: "250 Calls/Tag free",
  },
];

const API_SOURCES = [
  { name: "DeFiLlama", desc: "DeFi-Yields, TVL, Chains - fuer Yield Tracker.", limit: "Unlimited free" },
  { name: "Santiment", desc: "On-Chain + Sentiment (Whale Alerts, Social Volume).", limit: "100 Calls/Monat free" },
  { name: "HuggingFace", desc: "AI-Predictions (Inference fuer Price-Forecast).", limit: "Free Inference" },
  { name: "Alpha Vantage", desc: "Vol-Forecast, Tech Indicators (ATR, Correlations).", limit: "25 Calls/Tag free" },
  { name: "FMP", desc: "Cross-Asset Data (Stocks/Crypto Corr).", limit: "250 Calls/Tag free" },
];

const TIER_ORDER = ["basic", "pro", "elite"];
const SHOW_CRYPTO_EDU_CHAT = true;
const DATA_SOURCE_LIST = Object.values(dataSources || {});
const LOG_THROTTLE_WINDOW = 20000;

const Paywall = ({ minTier = "basic", userTier = "basic", isTrialActive = false, trialEndText = "", lockText = "Pro erforderlich", children }) => {
  const unlockedByTier = TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(minTier);
  const unlockedByTrial = isTrialActive && TIER_ORDER.indexOf("pro") >= TIER_ORDER.indexOf(minTier);
  const locked = !(unlockedByTier || unlockedByTrial);
  if (!locked) return children;
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-slate-950/70 backdrop-blur-[1px]" />
      <div className="pointer-events-none absolute inset-0 rounded-xl border border-amber-500/30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/60" />
      <div className="relative">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-lg border border-amber-400/60 bg-slate-900/95 px-4 py-3 text-center text-sm text-amber-200 shadow-lg space-y-1">
          <div>{lockText}</div>
          {trialEndText ? <div className="text-xs text-amber-300">{trialEndText}</div> : null}
        </div>
      </div>
    </div>
  );
};

Paywall.propTypes = {
  minTier: PropTypes.string,
  userTier: PropTypes.string,
  isTrialActive: PropTypes.bool,
  trialEndText: PropTypes.string,
  lockText: PropTypes.string,
  children: PropTypes.node.isRequired,
};

const formatterCache = new Map();
const getFormatter = (locale, opts) => {
  const key = `${locale}:${JSON.stringify(opts)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, opts));
  }
  return formatterCache.get(key);
};

let activeLocale = "de-DE";
const setActiveLocale = (locale) => {
  activeLocale = locale || "en-US";
};

const formatUSD = (value, locale) => {
  const loc = locale || activeLocale || "en-US";
  if (!Number.isFinite(value)) return "-";
  return getFormatter(loc, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
};

const formatPercent = (value, locale) => {
  const loc = locale || activeLocale || "en-US";
  if (!Number.isFinite(value)) return "-";
  const formatted = getFormatter(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  return `${value > 0 ? "+" : ""}${formatted}%`;
};

const clampNumber = (value, fallback = null) => (Number.isFinite(value) ? value : fallback);

const cryptoDataService = {
  async fetchOnChainMetrics(onHealthUpdate, onLog, onToast) {
    try {
      const data = await safeFetch("https://api.glassnode.com/v1/metrics/addresses/active_count?a=BTC&i=24h", {
        serviceName: "glassnode",
        timeoutMs: 9000,
        retries: 1,
        onHealthUpdate,
        onLog,
        onToast,
      });
      const last = Array.isArray(data) ? data.at(-1) : null;
      return {
        active: last?.v ?? null,
        supplyWhales: 0.62,
        supplyRetail: 0.38,
        updatedAt: last?.t ? Number(last.t) * 1000 : Date.now(),
      };
    } catch (err) {
      console.error("on-chain fallback", err);
      onHealthUpdate?.("glassnode", "degraded", err.message);
      return { active: 125000, supplyWhales: 0.6, supplyRetail: 0.4, updatedAt: Date.now() };
    }
  },
  async fetchSentiment(onHealthUpdate, onLog, onToast) {
    try {
      const data = await safeFetch("https://min-api.cryptocompare.com/data/social/coin/latest?fsym=BTC", {
        serviceName: "santiment",
        timeoutMs: 8000,
        retries: 1,
        onHealthUpdate,
        onLog,
        onToast,
      });
      const score = data?.Data?.General?.SocialScore ?? null;
      return { score, label: "Social Score", updatedAt: Date.now() };
    } catch (err) {
      console.error("sentiment fallback", err);
      onHealthUpdate?.("santiment", "degraded", err.message);
      return { score: 68, label: "Social Score", updatedAt: Date.now() };
    }
  },
  async fetchCorrelation(onHealthUpdate, onLog, onToast, ids = ["bitcoin", "ethereum", "solana", "ripple"]) {
    try {
      const series = await Promise.all(
        ids.map(async (id) => {
          const data = await safeFetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=3&interval=hourly`, {
            serviceName: "coingecko",
            timeoutMs: 9000,
            retries: 1,
            onHealthUpdate,
            onLog,
            onToast,
          });
          const prices = data?.prices?.map((p) => p[1]) ?? [];
          return { id, prices };
        })
      );
      const matrix = [];
      for (let i = 0; i < series.length; i += 1) {
        for (let j = i; j < series.length; j += 1) {
          const corr = calculatePearson(series[i].prices, series[j].prices);
          matrix.push({ pair: `${series[i].id}-${series[j].id}`, value: corr });
        }
      }
      return matrix;
    } catch (err) {
      console.error("correlation fallback", err);
      onHealthUpdate?.("coingecko", "degraded", err.message);
      return [
        { pair: "bitcoin-bitcoin", value: 1 },
        { pair: "bitcoin-ethereum", value: 0.76 },
        { pair: "bitcoin-solana", value: 0.58 },
        { pair: "bitcoin-ripple", value: 0.42 },
        { pair: "ethereum-ethereum", value: 1 },
        { pair: "ethereum-solana", value: 0.61 },
        { pair: "ethereum-ripple", value: 0.47 },
        { pair: "solana-solana", value: 1 },
        { pair: "solana-ripple", value: 0.35 },
        { pair: "ripple-ripple", value: 1 },
      ];
    }
  },
  async fetchFundingRates(onHealthUpdate, onLog, onToast, symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]) {
    try {
      const res = await Promise.all(
        symbols.map(async (sym) => {
          const d = await safeFetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`, {
            serviceName: "binance",
            timeoutMs: 8000,
            retries: 1,
            onHealthUpdate,
            onLog,
            onToast,
          });
          return { symbol: sym, rate: Number(d.lastFundingRate), mark: Number(d.markPrice) };
        })
      );
      return res;
    } catch (error_) {
      console.error("funding fallback", error_);
      onHealthUpdate?.("binance", "degraded", error_.message);
      return [
        { symbol: "BTCUSDT", rate: 0.00021, mark: null },
        { symbol: "ETHUSDT", rate: 0.00015, mark: null },
        { symbol: "SOLUSDT", rate: -0.0004, mark: null },
      ];
    }
  },
};

const formatClock = (ts) => {
  if (!ts) return "--:--";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
};

function LiveClock({ className = "" }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={`text-xs text-slate-400 tabular-nums ${className}`}>
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

LiveClock.propTypes = {
  className: PropTypes.string,
};

const TRANSLATIONS = {
  de: {
    action: "Aktion",
    reasonLabel: "Begruendung",
    confidence: "Konfidenz",
    tp: "TP",
    sl: "SL",
    tradesLookahead: "Trades (Lookahead 5)",
    winRate: "Win Rate",
    winsLosses: "Wins / Losses",
    avgRR: "� RR",
    status: "Status",
    loading: "Lade Daten...",
    livePrice: "Live Price",
    fearGreed: "Fear & Greed",
    indicators: "Indicators",
    reliability: "Reliability",
    liveMarket: "Live Market Analysis",
    fibMap: "Fib Map & Trade Levels",
    cryptoBubbles: "Crypto Bubbles",
    signals: "Signals",
    systemStatus: "System Status",
    manualControls: "Manual Controls",
    tpSl: "TP / SL Rechner (AI Assist)",
    aiSignal: "AI Signal (Heuristik, Open-Source Stil)",
    proSignals: "Pro Signals",
    backtest: "Backtest Snapshot",
    rsiChart: "RSI Verlauf",
    macdChart: "MACD Momentum",
    flowsCard: "Live Flows (Trades & Volumen)",
    dataIntegrity: "Data Integrity",
    apiPlaybook: "API Playbook",
    etfCard: "ETF Flows & News",
    trendStoch: "Trend Strength (Stoch)",
    cciCard: "CCI (20)",
    volatilityCard: "Volatility Regime",
    diary: "Trading Emotion Diary",
    refresh: "Refresh",
    langToggle: "DE / EN",
    tierBasic: "Basic (Free)",
    tierPro: "Pro ($9/Monat)",
    tierElite: "Elite ($29/Monat)",
    billing: "Billing",
    login: "Login",
    logout: "Logout",
    liveCheck: "Live-Check",
    liveLabel: "Live",
    keyNeeded: "Key noetig",
    errorLabel: "Fehler",
    liveData: "Live Data",
    reachable: "Erreichbar",
    unavailable: "Unavailable",
    proRequired: "Pro erforderlich",
    eliteRequired: "Elite erforderlich",
    apiKeyNeeded: "API Key noetig",
    demoUser: "trader@demo.app",
    aiTags: "AI-Tags",
    heroSubtitle: "Live Daten mit Multi-Source Fallback, Indikatoren & WebSocket Autoreconnect.",
    reliability1: "Multi-Source Fallback",
    reliability2: "5-Min Cache",
    reliability3: "Polling Backup 30s",
    reliability4: "WS Auto-Reconnect x5",
    manualPrice: "Preis neu laden",
    manualKraken: "Kraken neu laden",
    manualFG: "Fear & Greed",
    systemWs: "WebSocket",
    systemCache: "Cache TTL",
    systemPoll: "Polling Backup",
    systemError: "Last Error",
    systemNone: "keine",
    signalsLive: "Live Checks",
    signalsOversold: "RSI < 30 -> Oversold Alert",
    signalsOverbought: "RSI > 70 -> Overbought Alert",
    signalsFallback: "Fallback aktiv bei Primaerfehler",
    loadingCandles: "Candles werden geladen...",
    loadingFib: "Fib Map wird geladen...",
    noBubbles: "Keine Bubbles verfuegbar.",
    loadingRSI: "RSI wird geladen...",
    loadingMACD: "MACD wird geladen...",
    loadingFlows: "Volumen wird gesammelt...",
    waitingTrades: "Warte auf Trades...",
    loadingStoch: "Lade Daten...",
    loadingCCI: "Lade Daten...",
    loadingATR: "Lade Daten...",
    loadingETFNews: "Lade ETF News...",
    noETFNews: "Keine ETF News gefunden.",
    noETFLinks: "Keine ETF Flows gefunden.",
    apiLiveData: "Live Data",
    apiReachable: "Erreichbar",
    apiUnavailable: "Unavailable",
    marketRegimeDesc: "Basierend auf EMA200, ADX & Bollinger Band Width.",
    liquidityDesc: "Orderbuch-Staerke - Bids vs. Asks (letzte 1h).",
    onchainDesc: "Active Addresses & Supply Split.",
    sentimentDesc: "Social Score (CryptoCompare).",
    correlationDesc: "Coin-Korrelationen (CoinGecko).",
    fundingDesc: "Binance Premium Index.",
    dataIntegrity1: "CoinGecko to CryptoCompare, Polling Backup 30s, Cache 5m.",
    dataIntegrity2: "WebSocket Auto-Reconnect bis 5x, Volume & Candles von Kraken.",
    dataIntegrity3: "RSI (14), MACD (12/26/9), Bollinger (20, 2 std) live berechnet.",
    backtestNote: "Backtest V3: TP/SL, Fees & Slippage beruecksichtigt. Historische Trefferquote ist keine Garantie.",
    netFlowsLabel: "Net Flows",
    newsLabel: "News",
    smartAccum: "Smart Money: Accumulation Phase",
    smartDistr: "Smart Money: Distribution Detected",
    smartDirBuy: "Outflows (Bullish)",
    smartDirSell: "Inflows (Bearish)",
    smartNet: "Net Richtung",
    smartTrades: "Trades (3h)",
    smartBuys: "Buys",
    smartSells: "Sells",
    liquidityBid: "Bid Liquidity",
    liquidityAsk: "Ask Liquidity",
    liquidityImb: "Imbalance",
    liquidityHint: "Bullish, wenn Bids dominant",
    diFallback: "Fallback Pipeline",
    diResilience: "Resilience",
    diIndicators: "Indicators",
    backtestTrades: "Trades (Lookahead 5)",
    backtestWinRate: "Win Rate",
    backtestWinsLosses: "Wins / Losses",
    backtestAvgRR: "� RR",
    cardMarketRegime: "Market Regime Detector",
    cardSmartMoney: "Smart Money Flow",
    cardLiquidity: "Liquidity Heatmap",
    cardManualControls: "Manual Controls",
    cardDataIntegrity: "Data Integrity",
    fibGolden: "Golden Zone, TP/SL",
    liveMarketMeta: "Kraken OHLC � TF",
    tpEntryLabel: "Entry Price",
    tpQtyLabel: "Menge",
    tpTpLabel: "Take Profit %",
    tpSlLabel: "Stop Loss %",
    tpPrice: "TP Preis",
    slPrice: "SL Preis",
    profitAtTp: "Gewinn @TP",
    lossAtSl: "Verlust @SL",
    rrLabel: "Risk/Reward",
    aiHint: "Hinweis: Heuristik basiert auf RSI/MACD/Bollinger. Keine Garantie; Maerkte sind volatil.",
    fibTp: "TP",
    fibSl: "SL",
    fibNow: "Now",
    bubblesTop: "Top 10 Extrem RSI",
    tpAlarm: "TP Alarm",
    slAlarm: "SL Alarm",
    noEntries: "Noch keine Eintraege.",
    diarySave: "Speichern",
    diaryAutosave: "Autosave (local) - max 50 Eintraege",
    loadingTrades: "Warte auf Trades...",
    fetchFailPricePrimary: "Primaere Quelle ausgefallen - Fallback aktiv (CryptoCompare).",
    fetchFailPrice: "Preisquellen derzeit nicht erreichbar.",
    fetchFailFearGreed: "Fear & Greed Quelle nicht erreichbar.",
    fetchFailOHLC: "Kraken OHLCV konnte nicht geladen werden.",
    fetchFailETF: "ETF News derzeit nicht verfuegbar.",
    fetchFailETFFlows: "ETF Flows derzeit nicht verfuegbar.",
    tpSlTitle: "TP / SL Rechner (AI Assist)",
    aiSignalTitle: "AI Signal (Heuristik, Open-Source Stil)",
    proSignalsTitle: "Pro Signals",
    backtestTitle: "Backtest V3 Snapshot",
    dataIntegrityTitle: "Data Integrity",
    buyLabel: "Buy",
    sellLabel: "Sell",
    loginEmail: "E-Mail",
    loginPassword: "Passwort",
    signin: "Login",
    signup: "Signup",
    startTrial: "7 Tage Elite-Test",
    trialActive: "Elite Trial aktiv",
    madeBy: "Made by Oemer Alpay",
    consentText: "Wir verwenden optionale GeoIP-Tags fuer Meta/AI. Zustimmen?",
    consentAllow: "Erlauben",
    consentDeny: "Ablehnen",
    consentRevoke: "Opt-out",
    tierSaved: "Tier gespeichert",
    setupType: "Setup",
    regime: "Regime",
    checks: "Checks",
    checkTrend: "Trend",
    checkMomentum: "Momentum",
    checkFlow: "Flow",
    checkVol: "Volatilitaet",
    rrTarget: "Ziel-RR",
    setupTrend: "Trendfolge",
    setupBreakout: "Breakout",
    setupReversion: "Mean Reversion",
    setupWait: "Warten",
  },
  en: {
    action: "Action",
    reasonLabel: "Reason",
    confidence: "Confidence",
    tp: "TP",
    sl: "SL",
    tradesLookahead: "Trades (Lookahead 5)",
    winRate: "Win Rate",
    winsLosses: "Wins / Losses",
    avgRR: "Avg RR",
    status: "Status",
    loading: "Loading...",
    livePrice: "Live Price",
    fearGreed: "Fear & Greed",
    indicators: "Indicators",
    reliability: "Reliability",
    liveMarket: "Live Market Analysis",
    fibMap: "Fib Map & Trade Levels",
    cryptoBubbles: "Crypto Bubbles",
    signals: "Signals",
    systemStatus: "System Status",
    manualControls: "Manual Controls",
    tpSl: "TP / SL Calculator (AI Assist)",
    aiSignal: "AI Signal (Heuristic, Open-Source Style)",
    proSignals: "Pro Signals",
    backtest: "Backtest Snapshot",
    rsiChart: "RSI History",
    macdChart: "MACD Momentum",
    flowsCard: "Live Flows (Trades & Volume)",
    dataIntegrity: "Data Integrity",
    apiPlaybook: "API Playbook",
    etfCard: "ETF Flows & News",
    trendStoch: "Trend Strength (Stoch)",
    cciCard: "CCI (20)",
    volatilityCard: "Volatility Regime",
    diary: "Trading Emotion Diary",
    refresh: "Refresh",
    langToggle: "DE / EN",
    tierBasic: "Basic (Free)",
    tierPro: "Pro ($9/mo)",
    tierElite: "Elite ($29/mo)",
    billing: "Billing",
    login: "Login",
    logout: "Logout",
    liveCheck: "Live Check",
    liveLabel: "Live",
    keyNeeded: "Key required",
    errorLabel: "Error",
    liveData: "Live Data",
    reachable: "Reachable",
    unavailable: "Unavailable",
    proRequired: "Pro required",
    eliteRequired: "Elite required",
    apiKeyNeeded: "API Key required",
    demoUser: "trader@demo.app",
    aiTags: "AI-Tags",
    heroSubtitle: "Live data with multi-source fallback, indicators & WebSocket auto-reconnect.",
    reliability1: "Multi-source fallback",
    reliability2: "5-min cache",
    reliability3: "Polling backup 30s",
    reliability4: "WS auto-reconnect x5",
    manualPrice: "Reload price",
    manualKraken: "Reload Kraken",
    manualFG: "Fear & Greed",
    systemWs: "WebSocket",
    systemCache: "Cache TTL",
    systemPoll: "Polling Backup",
    systemError: "Last Error",
    systemNone: "none",
    signalsLive: "Live Checks",
    signalsOversold: "RSI < 30 -> Oversold Alert",
    signalsOverbought: "RSI > 70 -> Overbought Alert",
    signalsFallback: "Fallback active on primary failure",
    loadingCandles: "Loading candles...",
    loadingFib: "Loading Fib Map...",
    noBubbles: "No bubbles available.",
    loadingRSI: "Loading RSI...",
    loadingMACD: "Loading MACD...",
    loadingFlows: "Collecting volume...",
    waitingTrades: "Waiting for trades...",
    loadingStoch: "Loading data...",
    loadingCCI: "Loading data...",
    loadingATR: "Loading data...",
    loadingETFNews: "Loading ETF News...",
    noETFNews: "No ETF news found.",
    noETFLinks: "No ETF flows found.",
    apiLiveData: "Live Data",
    apiReachable: "Reachable",
    apiUnavailable: "Unavailable",
    marketRegimeDesc: "Based on EMA200, ADX & Bollinger Band Width.",
    liquidityDesc: "Orderbook strength � bids vs. asks (last 1h).",
    onchainDesc: "Active addresses & supply split.",
    sentimentDesc: "Social Score (CryptoCompare).",
    correlationDesc: "Coin correlations (CoinGecko).",
    fundingDesc: "Binance Premium Index.",
    dataIntegrity1: "CoinGecko to CryptoCompare, polling backup 30s, cache 5m.",
    dataIntegrity2: "WebSocket auto-reconnect up to 5x, volume & candles from Kraken.",
    dataIntegrity3: "RSI (14), MACD (12/26/9), Bollinger (20, 2 std) computed live.",
    backtestNote: "Backtest V3: includes TP/SL, fees & slippage. Past performance != future results.",
    netFlowsLabel: "Net Flows",
    newsLabel: "News",
    smartAccum: "Smart Money: Accumulation Phase",
    smartDistr: "Smart Money: Distribution Detected",
    smartDirBuy: "Outflows (Bullish)",
    smartDirSell: "Inflows (Bearish)",
    smartNet: "Net Direction",
    smartTrades: "Trades (3h)",
    smartBuys: "Buys",
    smartSells: "Sells",
    liquidityBid: "Bid Liquidity",
    liquidityAsk: "Ask Liquidity",
    liquidityImb: "Imbalance",
    liquidityHint: "Bullish when bids dominate",
    diFallback: "Fallback Pipeline",
    diResilience: "Resilience",
    diIndicators: "Indicators",
    backtestTrades: "Trades (Lookahead 5)",
    backtestWinRate: "Win Rate",
    backtestWinsLosses: "Wins / Losses",
    backtestAvgRR: "Avg RR",
    cardMarketRegime: "Market Regime Detector",
    cardSmartMoney: "Smart Money Flow",
    cardLiquidity: "Liquidity Heatmap",
    cardManualControls: "Manual Controls",
    cardDataIntegrity: "Data Integrity",
    fibGolden: "Golden Zone, TP/SL",
    liveMarketMeta: "Kraken OHLC � TF",
    tpEntryLabel: "Entry Price",
    tpQtyLabel: "Quantity",
    tpTpLabel: "Take Profit %",
    tpSlLabel: "Stop Loss %",
    tpPrice: "TP Price",
    slPrice: "SL Price",
    profitAtTp: "Profit @TP",
    lossAtSl: "Loss @SL",
    rrLabel: "Risk/Reward",
    aiHint: "Note: Heuristic based on RSI/MACD/Bollinger. No guarantee; markets are volatile.",
    fibTp: "TP",
    fibSl: "SL",
    fibNow: "Now",
    bubblesTop: "Top 10 Extreme RSI",
    tpAlarm: "TP Alarm",
    slAlarm: "SL Alarm",
    noEntries: "No entries yet.",
    diarySave: "Save",
    diaryAutosave: "Autosave (local) � max 50 entries",
    loadingTrades: "Waiting for trades...",
    fetchFailPricePrimary: "Primary source failed - fallback active (CryptoCompare).",
    fetchFailPrice: "Price sources not reachable.",
    fetchFailFearGreed: "Fear & Greed source not reachable.",
    fetchFailOHLC: "Kraken OHLCV could not be loaded.",
    fetchFailETF: "ETF News currently not available.",
    fetchFailETFFlows: "ETF Flows currently not available.",
    tpSlTitle: "TP / SL Calculator (AI Assist)",
    aiSignalTitle: "AI Signal (Heuristic, Open-Source Style)",
    proSignalsTitle: "Pro Signals",
    backtestTitle: "Backtest V3 Snapshot",
    dataIntegrityTitle: "Data Integrity",
    buyLabel: "Buy",
    sellLabel: "Sell",
    loginEmail: "Email",
    loginPassword: "Password",
    signin: "Login",
    signup: "Signup",
    startTrial: "7-day Elite Trial",
    trialActive: "Elite trial active",
    madeBy: "Made by Oemer Alpay",
    consentText: "We use optional GeoIP tags for Meta/AI. Allow?",
    consentAllow: "Allow",
    consentDeny: "Deny",
    consentRevoke: "Opt-out",
    tierSaved: "Tier saved",
    setupType: "Setup",
    regime: "Regime",
    checks: "Checks",
    checkTrend: "Trend",
    checkMomentum: "Momentum",
    checkFlow: "Flow",
    checkVol: "Volatility",
    rrTarget: "Target RR",
    setupTrend: "Trend Follow",
    setupBreakout: "Breakout",
    setupReversion: "Mean Reversion",
    setupWait: "Wait",
  },
};

const CandleLayer = ({ xAxisMap = {}, yAxisMap = {}, data = [], xAxisId = "x", yAxisId = "y" }) => {
  const xAxis = xAxisMap[xAxisId] || Object.values(xAxisMap)[0];
  const yAxis = yAxisMap[yAxisId] || Object.values(yAxisMap)[0];
  if (!xAxis || !yAxis || !data.length || typeof xAxis.scale !== "function") return null;
  const band = ((xAxis.bandSize || 10) ?? 10) * 0.7;
  return (
    <g>
      {data.map((d, idx) => {
        const x = xAxis.scale(d.label) - band / 2;
        const openY = yAxis.scale(d.open);
        const closeY = yAxis.scale(d.close);
        const highY = yAxis.scale(d.high);
        const lowY = yAxis.scale(d.low);
        const isUp = d.close >= d.open;
        const color = isUp ? "#22c55e" : "#ef4444";
        const top = Math.min(openY, closeY);
        const height = Math.max(Math.abs(closeY - openY), 1.5);
        return (
          <g key={`candle-${idx}`}>
            <line x1={x + band / 2} x2={x + band / 2} y1={highY} y2={lowY} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <rect x={x} y={top} width={band} height={height} rx={2} fill={color} stroke={color} opacity={0.9} />
          </g>
        );
      })}
    </g>
  );
};

CandleLayer.propTypes = {
  xAxisMap: PropTypes.object,
  yAxisMap: PropTypes.object,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      open: PropTypes.number,
      high: PropTypes.number,
      low: PropTypes.number,
      close: PropTypes.number,
    })
  ),
  xAxisId: PropTypes.string,
  yAxisId: PropTypes.string,
};
const IndicatorBadge = ({ label, value, intent }) => (
  <div
    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
      intent === "warn"
        ? "bg-red-500/10 text-red-200"
        : intent === "ok"
        ? "bg-emerald-500/10 text-emerald-200"
        : "bg-slate-800 text-slate-200"
    }`}
  >
    <Signal className="h-4 w-4" />
    <span className="font-semibold">{label}</span>
    <span className="text-slate-300">{value}</span>
  </div>
);

IndicatorBadge.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  intent: PropTypes.oneOf(["warn", "ok", "neutral"]).isRequired,
};

const Card = ({ title, icon: Icon, children, actions, tooltip }) => (
  <div
    className="w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg shadow-black/30 backdrop-blur"
    title={tooltip || title}
  >
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-slate-200">
        {Icon ? <Icon className="h-5 w-5 text-emerald-400" /> : null}
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <LiveClock className="text-[11px]" />
      </div>
    </div>
    {children}
  </div>
);

Card.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  actions: PropTypes.node,
  tooltip: PropTypes.string,
};

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-lg bg-slate-800/70 ${className}`} />;

Skeleton.propTypes = {
  className: PropTypes.string,
};

const useInViewOnce = (rootMargin = "200px") => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current || inView) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, rootMargin]);
  return [ref, inView];
};

const LazyRender = ({ placeholder, children, rootMargin }) => {
  const [ref, inView] = useInViewOnce(rootMargin);
  return <div ref={ref}>{inView ? children : placeholder}</div>;
};

LazyRender.propTypes = {
  placeholder: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
  rootMargin: PropTypes.string,
};

const renderLastDot = (count, color = "#22c55e") => {
  const LastDot = (props) => {
    if (props.index !== count - 1) return null;
    return <circle cx={props.cx} cy={props.cy} r={4} fill={color} className="pulse-soft" />;
  };
  LastDot.displayName = "LastDot";
  return LastDot;
};
const _sumFlows = (flows = [], days = 7) =>
  flows.slice(-days).reduce((acc, f) => acc + (Number.isFinite(f.flow ?? f.netFlowUsd) ? (f.flow ?? f.netFlowUsd) : 0), 0);
function App() {
  const isDevBuild = import.meta.env?.DEV ?? false;
  const {
    user: authUser,
    effectiveTier: ctxTier,
    loading: tierLoading,
    refreshUserTier,
  } = useUserTier();
  const { isTrialActive, trialExpiresAt, remainingMs, startedAt: localTrialStart } = useEliteTrial();
  const effectiveTier = isTrialActive && ctxTier !== "elite" ? "elite" : ctxTier;
  const marketOptions = useMemo(() => MARKET_OPTIONS, []);
  const [selectedAssetId, setSelectedAssetId] = useState(DEFAULT_MARKET_ID);
  const selectedMarket = useMemo(() => MARKETS[selectedAssetId] || MARKETS[DEFAULT_MARKET_ID], [selectedAssetId]);
  const groupedMarkets = useMemo(() => {
    return marketOptions.reduce((acc, market) => {
      const key = market.assetClass || "other";
      acc[key] = acc[key] || [];
      acc[key].push(market);
      return acc;
    }, {});
  }, [marketOptions]);
  const [priceState, setPriceState] = useState({ value: null, change24h: null, source: "CoinGecko", updatedAt: null });
  const [fearGreed, setFearGreed] = useState(null);
  const [ohlcv, setOhlcv] = useState([]);
  const [htfOhlcv, setHtfOhlcv] = useState({ h4: [], d1: [] });
  const [indicators, setIndicators] = useState({ rsi: null, macd: null, signal: null, histogram: null });
  const [wsStatus, setWsStatus] = useState("connecting");
  const [wsAttempts, setWsAttempts] = useState(0);
  const [livePrice, setLivePrice] = useState(null);
  const [trades, setTrades] = useState([]);
  const [lastError, setLastError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tpForm, setTpForm] = useState({ entry: null, quantity: 1, tpPct: 4, slPct: 3 });
  const [aiNote, setAiNote] = useState("");
  const [timeFrame, setTimeFrame] = useState("60");
  const [etfNews, setEtfNews] = useState([]);
  const [etfLoading, setEtfLoading] = useState(false);
  const [etfError, setEtfError] = useState("");
  const [etfFlows, setEtfFlows] = useState([]);
  const [etfFlowsError, setEtfFlowsError] = useState("");
  const [etfSelection, setEtfSelection] = useState(["IBIT", "FBTC", "ARKB"]);
  const [etfFlowSeries, setEtfFlowSeries] = useState([]);
  const [etfAumError, setEtfAumError] = useState("");
  const [etfAumLoading, setEtfAumLoading] = useState(false);
  const [etfLastUpdated, setEtfLastUpdated] = useState(null);
  const [etfHoldings, setEtfHoldings] = useState([]);
  const [etfHoldingsError, setEtfHoldingsError] = useState("");
  const [etfHoldingsLoading, setEtfHoldingsLoading] = useState(false);
  const [etfHoldingsLastUpdated, setEtfHoldingsLastUpdated] = useState("");
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalForm, setJournalForm] = useState({ date: "", mood: "Neutral", note: "" });
  const [lang, setLang] = useState("de");
  const [apiStatuses, setApiStatuses] = useState({});
  const [userEmail, setUserEmail] = useState("");
  const [, setGeoInfo] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  // geoInfo state removed - was unused
  const [highlightAuthCard, setHighlightAuthCard] = useState(false);
  const [consentGeo, setConsentGeo] = useState(() => localStorage.getItem("consent:geo") === "true");
  const [saveTierMessage, setSaveTierMessage] = useState("");
  const [isBeginner, setIsBeginner] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem("tutorial:shown") !== "true");
  const [aiPredict, setAiPredict] = useState({ forecast: null, confidence: null, trend: "neutral", refreshedAt: null });
  const [backtestStats, setBacktestStats] = useState({ trades: 0, wins: 0, losses: 0, winRate: null, avgRr: null, avgRR: null });
  const [mobileTab, setMobileTab] = useState("overview");
  const trialRemainingDays = Math.max(0, Math.floor(remainingMs / DAY_MS));
  const trialEnd = trialExpiresAt ? trialExpiresAt.toLocaleDateString() : null;
  const trialStart = localTrialStart;
  const trialExpired = !isTrialActive && Boolean(trialStart);
  const [apiHealth, setApiHealth] = useState({
    coingecko: { status: "ok", ts: Date.now() },
    cryptocompare: { status: "ok", ts: Date.now() },
    kraken: { status: "ok", ts: Date.now() },
    binance: { status: "ok", ts: Date.now() },
    glassnode: { status: "ok", ts: Date.now() },
    santiment: { status: "ok", ts: Date.now() },
    etfNews: { status: "ok", ts: Date.now() },
    etfFlows: { status: "ok", ts: Date.now() },
    etfFlowsFmp: { status: "ok", ts: Date.now() },
    etfFlowsSoso: { status: "ok", ts: Date.now() },
    ETF_FLOWS_FMP: { status: "ok", ts: Date.now() },
    ETF_FLOWS_SOSO: { status: "ok", ts: Date.now() },
    ETF_FLOWS_COINSTATS: { status: "ok", ts: Date.now() },
    ETF_CORR_PRIMARY: { status: "ok", ts: Date.now() },
    ETF_CORR_FALLBACK: { status: "ok", ts: Date.now() },
    ETF_HOLDINGS_FMP: { status: "ok", ts: Date.now() },
    ETF_HOLDINGS_SOSO: { status: "ok", ts: Date.now() },
    ETF_HOLDINGS_COINSTATS: { status: "ok", ts: Date.now() },
    ETFFLOWS: { status: "ok", ts: Date.now() },
    ETFNEWS: { status: "ok", ts: Date.now() },
    MARKET_HTF_PRIMARY: { status: "ok", ts: Date.now() },
    MARKET_HTF_FALLBACK: { status: "ok", ts: Date.now() },
    DERIVATIVES_PRIMARY: { status: "ok", ts: Date.now() },
    lastUpdated: Date.now(),
  });
  const [sourceHealth, setSourceHealth] = useState(() => getSourceHealthSnapshot() || {});
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});
  const toastRecent = useRef(new Map());
  const logMemoryRef = useRef(new Map());
  const desktopAuthRef = useRef(null);
  const mobileAuthRef = useRef(null);
  const desktopEmailRef = useRef(null);
  const mobileEmailRef = useRef(null);
  const t = useCallback((key) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.de[key] ?? key, [lang]);
  const [blink, setBlink] = useState(true);
  const trialActive = Boolean(isTrialActive);
  const hasProAccess = useMemo(() => TIER_ORDER.indexOf(effectiveTier) >= TIER_ORDER.indexOf("pro"), [effectiveTier]);
  const trialBadgeText = useMemo(() => {
    if (!trialActive) return null;
    const remainingHours = Number.isFinite(remainingMs) ? Math.floor((remainingMs / (1000 * 60 * 60)) % 24) : 0;
    const daysSuffix =
      Number.isFinite(trialRemainingDays) && trialRemainingDays >= 0
        ? lang === "de"
          ? ` (${trialRemainingDays} Tag${trialRemainingDays === 1 ? "" : "e"} ${remainingHours}h)`
          : ` (${trialRemainingDays}d ${remainingHours}h left)`
        : "";
    const endSuffix = trialEnd ? (lang === "de" ? ` Ende: ${trialEnd}` : ` Ends: ${trialEnd}`) : "";
    return lang === "de"
      ? `7-Tage-Test aktiv${daysSuffix}${endSuffix ? `.${endSuffix}` : ""}`
      : `7-day trial active${daysSuffix}${endSuffix ? `. ${endSuffix}` : ""}`;
  }, [trialActive, trialRemainingDays, remainingMs, trialEnd, lang]);

  const tierLabels = useMemo(
    () => ({
      basic: t("tierBasic"),
      pro: t("tierPro"),
      elite: t("tierElite"),
    }),
    [t]
  );

  useEffect(() => {
    setActiveLocale(lang === "de" ? "de-DE" : "en-US");
  }, [lang]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
  }, []);

  const addToast = useCallback((message, type = "error", opts = {}) => {
    const { allowInfoWarn = false } = opts;
    if (type !== "error" && !allowInfoWarn) return;
    const now = Date.now();
    const { key: customKey, cooldownMs = 20000 } = opts;
    const key = customKey || `${type}:${message}`;
    const last = toastRecent.current.get(key);
    if (last && now - last < cooldownMs) return;
    toastRecent.current.set(key, now);
    const id = `${now}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => {
      const next = [{ id, message, type, key }, ...prev.filter((t) => t.key !== key)];
      return next.slice(0, 3);
    });
    toastTimers.current[id] = setTimeout(() => removeToast(id), 5200);
  }, []);

  useEffect(
    () => () => {
      Object.values(toastTimers.current || {}).forEach((t) => clearTimeout(t));
    },
    []
  );

  useEffect(() => {
    const unsubscribe = subscribeToSourceHealth((snapshot) => setSourceHealth(snapshot || {}));
    return unsubscribe;
  }, []);

  // Bekannte API-Fehler die keine Toast-Meldung brauchen (Rate Limits, CORS, etc.)
  const isKnownApiIssue = (source, message) => {
    const msg = (message || "").toLowerCase();
    const src = (source || "").toLowerCase();
    // Rate limits und bekannte temporaere Fehler
    if (msg.includes("429") || msg.includes("rate limit")) return true;
    if (msg.includes("cors") || msg.includes("network")) return true;
    if (msg.includes("timeout") || msg.includes("abort")) return true;
    if (msg.includes("insufficient") || msg.includes("empty")) return true;
    if (msg.includes("fetch") || msg.includes("failed")) return true;
    // API/Proxy Fehler unterdruecken - wir haben Fallback-Logik
    if (src.includes("proxy") || src.includes("ohlc") || src.includes("price")) return true;
    if (src.includes("htf") || src.includes("derivatives") || src.includes("market")) return true;
    // Bekannte Services die oft temporaer ausfallen
    const knownFlaky = ["coingecko", "binance", "kraken", "glassnode", "santiment", "cryptocompare", "coinapi", "fear_greed"];
    if (knownFlaky.some((s) => src.includes(s))) return true;
    return false;
  };

  const logEvent = useCallback((source, level = "info", message = "", meta = {}) => {
    const key = `${source}:${level}:${message || ""}`;
    const now = Date.now();
    const last = logMemoryRef.current.get(key) || 0;
    if (now - last < LOG_THROTTLE_WINDOW) return;
    logMemoryRef.current.set(key, now);
    const payload = { source, level, message, meta, ts: Date.now() };
    if (isDevBuild) {
      if (level === "error") console.error("[log]", payload);
      else if (level === "warn") console.warn("[log]", payload);
      else console.log("[log]", payload);
    }
    const isEtfService = typeof source === "string" && source.toUpperCase().startsWith("ETF_");
    // Keine Toast-Meldungen fuer bekannte temporaere API-Probleme
    const showToast = !isEtfService && level === "error" && !isKnownApiIssue(source, message);
    if (showToast) {
      // Inline toast logic to avoid circular dependency
      const toastNow = Date.now();
      const toastKey = source || message;
      const toastLast = toastRecent.current.get(toastKey);
      if (!toastLast || toastNow - toastLast >= 60000) {
        toastRecent.current.set(toastKey, toastNow);
        const id = `${toastNow}-${Math.random().toString(16).slice(2)}`;
        setToasts((prev) => {
          const next = [{ id, message: `${source}: ${message || level}`, type: "error", key: toastKey }, ...prev.filter((t) => t.key !== toastKey)];
          return next.slice(0, 3);
        });
        toastTimers.current[id] = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5200);
      }
    }
  }, []);

  const updateApiHealth = useCallback((source, status, message = "") => {
    setApiHealth((prev) => {
      const now = Date.now();
      const next = { ...prev, [source]: { status, ts: now, message }, lastUpdated: now };
      const reconcileEtfAggregator = () => {
        const primary = next.ETF_FLOWS_FMP?.status;
        const fallbacks = [next.ETF_FLOWS_SOSO?.status, next.ETF_FLOWS_COINSTATS?.status].filter(Boolean);
        if (primary === "ok") {
          next.ETFFLOWS = { status: "ok", ts: now };
        } else if (primary === "error" && fallbacks.length && fallbacks.every((s) => s === "error")) {
          next.ETFFLOWS = { status: "error", ts: now };
        } else if (primary) {
          next.ETFFLOWS = { status: "degraded", ts: now };
        }
        if (next.etfNews?.status) {
          const nStatus = next.etfNews.status;
          next.ETFNEWS = {
            status: nStatus === "error" ? "error" : nStatus === "ok" ? "ok" : "degraded",
            ts: now,
          };
        }
      };
      reconcileEtfAggregator();
      return next;
    });
  }, []);

  const cacheRef = useRef(new Map());
  const wsRef = useRef(null);
  const assetIdRef = useRef(DEFAULT_MARKET_ID);
  const reconnectTimer = useRef(null);
  const pollTimer = useRef(null);
  const fallbackTimer = useRef(null);
  const pollingReconnectTimer = useRef(null);
  const newsTimer = useRef(null);
  const flowsTimer = useRef(null);

  const displayPrice = livePrice ?? priceState.value;

  useEffect(() => {
    assetIdRef.current = selectedMarket.id;
    setOhlcv([]);
    setHtfOhlcv({ h4: [], d1: [] });
    setIndicators({ rsi: null, macd: null, signal: null, histogram: null });
    setLivePrice(null);
    setPriceState({ value: null, change24h: null, source: "CoinGecko", updatedAt: null });
    setTrades([]);
    setLastError("");
    setWsStatus("connecting");
    setWsAttempts(0);
    setTpForm({ entry: null, quantity: 1, tpPct: 4, slPct: 3 });
    clearTimeout(reconnectTimer.current);
    clearInterval(fallbackTimer.current);
    fallbackTimer.current = null;
    clearInterval(pollingReconnectTimer.current);
    pollingReconnectTimer.current = null;
    // Close existing socket immediately to prevent stale streams after asset switch
    wsRef.current?.close();
    wsRef.current = null;
  }, [selectedAssetId, selectedMarket.id]);

  const fetchWithCache = async (key, fetcher, customTtl = CACHE_TTL) => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.time < customTtl) return cached.value;
    const value = await fetcher();
    cacheRef.current.set(key, { value, time: Date.now() });
    return value;
  };

  const relayProxyHealth = (entries) => {
    if (!Array.isArray(entries) || !entries.length) return;
    for (const entry of entries) {
      if (!entry?.key || !entry?.status) continue;
      updateApiHealth(entry.key, entry.status, entry.message);
    }
  };

  const fetchPriceProxy = async (assetId) => {
    const params = new URLSearchParams({ asset: assetId, vs: "USD" });
    const response = await safeFetch(`/api/price?${params.toString()}`, {
      serviceName: "price_proxy",
      timeoutMs: 10000,
      retries: 0,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      uiLevel: "status",
    });
    relayProxyHealth(response?.health);
    if (response?.error) throw new Error(response.error);
    if (!response?.data) throw new Error("Price payload missing");
    return response.data;
  };

  // NEW: Real-time Sentiment API (combines Binance + Alternative.me)
  const fetchRealTimeSentiment = async () => {
    try {
      const response = await safeFetch("/api/sentiment", {
        serviceName: "sentiment_realtime",
        timeoutMs: 5000,
        retries: 1,
        onHealthUpdate: updateApiHealth,
        onLog: logEvent,
        uiLevel: "status",
      });
      if (response?.ok && response?.data) {
        return {
          value: response.data.combinedScore,
          classification: response.data.combinedLabel,
          realTimeValue: response.data.realTimeSentiment,
          realTimeLabel: response.data.realTimeSentimentLabel,
          dailyValue: response.data.dailyFearGreed,
          dailyLabel: response.data.dailyFearGreedLabel,
          longPercent: response.data.longPercent,
          shortPercent: response.data.shortPercent,
          updatedAt: response.data.timestamp,
          source: "binance+alternative.me",
        };
      }
      throw new Error("Sentiment API error");
    } catch (err) {
      // Fallback to traditional Fear & Greed
      console.warn("Real-time sentiment failed, using fallback:", err?.message);
      return fetchFearGreedFallback();
    }
  };

  // Fallback: Traditional Fear & Greed from Alternative.me
  const fetchFearGreedFallback = async () => {
    const data = await safeFetch("https://api.alternative.me/fng/?limit=1&format=json", {
      serviceName: "fear_greed",
      timeoutMs: 8000,
      retries: 1,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      uiLevel: "status",
    });
    const item = data?.data?.[0];
    if (!item) throw new Error("Fear & Greed malformed");
    return {
      value: Number(item.value),
      classification: item.value_classification,
      updatedAt: item.timestamp ? Number(item.timestamp) * 1000 : Date.now(),
      source: "alternative.me",
    };
  };

  // Use real-time sentiment as primary
  const fetchFearGreed = fetchRealTimeSentiment;

  const formatCandleLabel = (timestamp, minutes) => {
    const date = new Date(Number(timestamp) * 1000);
    if (minutes >= 1440) return date.toLocaleDateString();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const decorateCandles = (series, intervalMinutes) => {
    const windowSize = Number(intervalMinutes) || 60;
    if (!Array.isArray(series)) return [];
    return series.map((row) => ({
      ...row,
      label: formatCandleLabel(row.time, windowSize),
    }));
  };

  const resolveProviderSymbol = (providerId) => {
    const entry = Object.entries(selectedMarket?.providerSymbols || {}).find(([id]) => id.toLowerCase() === providerId.toLowerCase());
    return entry?.[1];
  };

  const loadPrice = async () => {
    try {
      const assetId = selectedMarket?.id || DEFAULT_MARKET_ID;
      const payload = await fetchWithCache(`price:proxy:${assetId}`, () => fetchPriceProxy(assetId));
      const parsedUpdatedAt = payload?.updatedAt ? Date.parse(payload.updatedAt) : Date.now();
      const safeUpdatedAt = Number.isFinite(parsedUpdatedAt) ? parsedUpdatedAt : Date.now();
      setPriceState({
        value: payload?.value ?? null,
        change24h: payload?.change24h ?? null,
        source: payload?.source || "Proxy",
        updatedAt: safeUpdatedAt,
      });
      setLastError("");
      updateApiHealth("price_proxy", "ok");
    } catch (err) {
      console.error("Price proxy failed", err);
      setLastError(t("fetchFailPrice"));
      setPriceState({ value: null, change24h: null, source: priceState.source, updatedAt: null });
      updateApiHealth("price_proxy", "error", err?.message);
      logEvent("price", "error", err?.message || "price proxy failed");
    }
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([loadPrice(), loadFearGreed(), loadOHLC(), loadHTF(), loadDerivatives()]);
    setIsRefreshing(false);
  };

  const loadFearGreed = async () => {
    try {
      // K�rzerer Cache-TTL f�r Fear & Greed (1 Minute statt 5)
      const fg = await fetchWithCache("fng", fetchFearGreed, FNG_CACHE_TTL);
      setFearGreed(fg);
    } catch (err) {
      console.error("Fear & Greed failed", err);
      setLastError((prev) => prev || t("fetchFailFearGreed"));
      updateApiHealth("fear_greed", "degraded", t("fetchFailFearGreed"));
      logEvent("fearGreed", "warn", t("fetchFailFearGreed"));
    }
  };

  const loadOHLC = async () => {
    const pair = resolveProviderSymbol("kraken") || resolveProviderSymbol(selectedMarket.defaultProvider) || selectedMarket.id;
    const intervalMinutes = Number(timeFrame) || 60;
    const binanceSymbol = (resolveProviderSymbol("binance") || resolveProviderSymbol(selectedMarket.defaultProvider) || `${selectedMarket.id}`).toUpperCase();
    const cacheKey = `ohlc:multi:${selectedMarket.id}:${pair}:${binanceSymbol}:${intervalMinutes}`;
    const primaryProviderKey = resolveProviderSymbol("kraken") ? "kraken" : selectedMarket.defaultProvider || "kraken";
    try {
      const candles = await fetchWithCache(cacheKey, async () => {
        const loaded = await loadChart(
          { assetId: selectedMarket.id, pair, binanceSymbol, interval: intervalMinutes, limit: 200 },
          {
            timeoutMs: 5000, // Reduced from 12s to 5s for faster UX
            retries: 0,
            onHealthUpdate: updateApiHealth,
            onLog: logEvent,
            uiLevel: "status",
          }
        );
        if (!loaded || loaded.length < 5) {
          throw new Error("chart loader empty");
        }
        return loaded;
      }, OHLC_CACHE_TTL); // Use OHLC-specific cache TTL
      setOhlcv(decorateCandles(candles, intervalMinutes));
      setLastError("");
    } catch (err) {
      console.error("Chart load failed", err);
      setLastError((prev) => prev || t("fetchFailOHLC"));
      updateApiHealth(primaryProviderKey, "error", err?.message);
      logEvent("ohlcv", "error", err?.message || "chart loader failed");
      const fallbackSeries = decorateCandles(buildFallbackChart(48), intervalMinutes);
      setOhlcv(fallbackSeries);
    }
  };

  const loadHTF = async () => {
    if (!hasProAccess) {
      setHtfOhlcv({ h4: [], d1: [] });
      updateApiHealth("MARKET_HTF_PRIMARY", "degraded", "Tier required");
      return;
    }
    try {
      const data = await fetchWithCache(`htf:${selectedMarket.id}`, () =>
        fetchHtfOhlc(selectedMarket.id, updateApiHealth, logEvent, addToast)
      );
      setHtfOhlcv(data);
      const hasData = (data?.h4?.length || data?.d1?.length) ? "ok" : "degraded";
      updateApiHealth("MARKET_HTF_PRIMARY", hasData, hasData === "ok" ? "" : "HTF data empty");
    } catch (err) {
      console.error("HTF fetch failed", err);
      updateApiHealth("MARKET_HTF_PRIMARY", "error", err.message);
      logEvent("MARKET_HTF_PRIMARY", "error", err.message);
    }
  };

  const resolveDerivativesSymbol = (cc) => `DERIBIT_PERPETUAL_${(cc || "").toUpperCase()}_USD`;

  const loadDerivatives = async () => {
    if (!hasProAccess) {
      setDerivativesRisk({ score: null, riskLevel: "neutral", updatedAt: null });
      updateApiHealth("DERIVATIVES_PRIMARY", "degraded", "Tier required");
      return;
    }
    if (selectedMarket.assetClass !== "crypto") {
      setDerivativesRisk({ score: null, riskLevel: "neutral", updatedAt: null });
      updateApiHealth("DERIVATIVES_PRIMARY", "degraded", "Not available for this asset");
      return;
    }
    try {
      const baseTicker = (selectedMarket.id || "").replace(/USD$/i, "");
      const symbolId = resolveDerivativesSymbol(baseTicker);
      const res = await fetchWithCache(`derivatives:${symbolId}:${selectedMarket.id}`, () =>
        fetchDerivativesLive(symbolId, updateApiHealth, logEvent, addToast)
      );
      setDerivativesRisk(res);
      const status = res?.riskLevel ? "ok" : "degraded";
      updateApiHealth("DERIVATIVES_PRIMARY", status);
    } catch (err) {
      console.error("Derivatives fetch failed", err);
      updateApiHealth("DERIVATIVES_PRIMARY", "error", err.message);
      logEvent("DERIVATIVES_PRIMARY", "error", err.message);
    }
  };

  const fetchEtfNewsProxy = async () => {
    const response = await safeFetch(`/api/etf/news?limit=8`, {
      serviceName: "ETF_PROXY_NEWS",
      timeoutMs: 10000,
      retries: 0,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      uiLevel: "status",
    });
    relayProxyHealth(response?.health);
    if (response?.ok === false) {
      updateApiHealth("ETFNEWS", response?.status === "disabled" ? "disabled" : "degraded", response?.message || response?.hint);
      return [];
    }
    const list = Array.isArray(response?.data) ? response.data : [];
    if (!list.length) {
      updateApiHealth("ETFNEWS", "degraded", "ETF News empty");
      return [];
    }
    return list.slice(0, 8);
  };

  const loadEtfNews = async () => {
    setEtfLoading(true);
    try {
      const items = await fetchWithCache("news:etf:proxy", fetchEtfNewsProxy);
      setEtfNews(Array.isArray(items) ? items : []);
      setEtfError("");
      updateApiHealth("ETFNEWS", items.length ? "ok" : "degraded");
    } catch (err) {
      console.error("ETF news failed", err);
      setEtfError(t("fetchFailETF"));
      logEvent("etfNews", "warn", t("fetchFailETF"));
      updateApiHealth("ETFNEWS", "error", err?.message);
    } finally {
      setEtfLoading(false);
    }
  };

  const fetchEtfFlows = async (symbols = etfSelection) => {
    const params = new URLSearchParams();
    if (symbols?.length) params.set("symbols", symbols.join(","));
    const query = params.toString();
    const url = query ? `/api/etf/flows?${query}` : "/api/etf/flows";
    const response = await safeFetch(url, {
      serviceName: "ETF_PROXY_FLOWS_CARD",
      timeoutMs: 10000,
      retries: 0,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      onToast: addToast,
    });
    relayProxyHealth(response?.health);
    if (response?.error) throw new Error(response.error);
    const series = Array.isArray(response?.data) ? response.data : [];
    if (!series.length) throw new Error("ETF flows empty");
    const simplified = series
      .map((s) => {
        const latest = Array.isArray(s.points) ? [...s.points].filter((p) => p?.date).pop() : null;
        return {
          name: s.symbol,
          date: latest?.date || s.lastUpdated || null,
          inflow: Number(latest?.netFlowUsd ?? s.sum7dUsd ?? 0),
        };
      })
      .filter((row) => row.name);
    if (!simplified.length) throw new Error("ETF flows empty");
    return simplified.slice(0, 6);
  };

  const loadEtfFlows = async () => {
    const symbols = Array.isArray(etfSelection) && etfSelection.length ? [...etfSelection] : undefined;
    const cacheKey = `flows:etf:${symbols?.join(",") || "default"}`;
    try {
      const rows = await fetchWithCache(cacheKey, () => fetchEtfFlows(symbols));
      setEtfFlows(rows);
      setEtfFlowsError("");
      updateApiHealth("ETFFLOWS", rows.length ? "ok" : "degraded");
    } catch (err) {
      console.error("ETF flows failed", err);
      setEtfFlows([]);
      setEtfFlowsError(t("fetchFailETFFlows"));
      logEvent("etfFlows", "warn", t("fetchFailETFFlows"));
      updateApiHealth("ETFFLOWS", "error", err?.message);
    }
  };

  const loadEtfFlowData = async (symbols = etfSelection) => {
    if (!symbols?.length) {
      setEtfFlowSeries([]);
      return;
    }
    setEtfAumLoading(true);
    try {
      const data = await fetchEtfFlowSeriesLive(symbols, updateApiHealth);
      setEtfFlowSeries(data);
      setEtfLastUpdated(new Date().toISOString());
      setEtfAumError("");
      updateApiHealth("ETF_FLOWS_FMP", data.length ? "ok" : "degraded");
    } catch (err) {
      console.error("ETF flows failed", err);
      setEtfFlowSeries([]);
      setEtfAumError("Daten derzeit nicht verfuegbar");
      updateApiHealth("etfFlows", "error", err.message);
    } finally {
      setEtfAumLoading(false);
    }
  };

  const loadEtfHoldingsData = async (symbols = etfSelection) => {
    if (!symbols?.length) {
      setEtfHoldings([]);
      return;
    }
    setEtfHoldingsLoading(true);
    try {
      const data = await fetchEtfHoldingsLive(symbols, updateApiHealth);
      setEtfHoldings(data);
      setEtfHoldingsError("");
      setEtfHoldingsLastUpdated(new Date().toISOString());
      updateApiHealth("ETF_HOLDINGS_FMP", data.length ? "ok" : "degraded");
    } catch (err) {
      console.error("ETF holdings failed", err);
      setEtfHoldings([]);
      setEtfHoldingsError("Daten derzeit nicht verfuegbar");
      updateApiHealth("ETF_HOLDINGS_FMP", "error", err.message);
    } finally {
      setEtfHoldingsLoading(false);
    }
  };

  const apiCheckers = [
    {
      key: "defillama",
      name: "DeFiLlama",
      run: async () => {
        const res = await fetch("https://api.llama.fi/protocols");
        if (!res.ok) throw new Error("defillama failed");
        const data = await res.json();
        const totalTvl = data?.slice(0, 200)?.reduce((acc, p) => acc + (p.tvl || 0), 0);
        return {
          status: "ok",
          detail: `${data.length} Protokolle`,
          data: totalTvl ? `TVL Top200: $${Math.round(totalTvl).toLocaleString()}` : "Protokolle geladen",
        };
      },
    },
    {
      key: "santiment",
      name: "Santiment",
      run: async () => {
        const res = await fetch("https://api.santiment.net/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ projectBySlug(slug:\"bitcoin\"){slug} }" }),
        });
        if (res.status === 401) throw new Error("API Key benoetigt (401)");
        if (!res.ok) throw new Error("santiment failed");
        const data = await res.json();
        const slug = data?.data?.projectBySlug?.slug || "ok";
        return { status: "ok", detail: "BTC slug ok", data: slug };
      },
    },
    {
      key: "huggingface",
      name: "HuggingFace",
      run: async () => {
        const res = await fetch("https://huggingface.co/api/models/facebook/prophet-net");
        if (res.status === 401) throw new Error("HF Token benoetigt (401)");
        if (!res.ok) throw new Error("huggingface failed");
        const data = await res.json();
        const downloads = data?.downloads ?? null;
        return {
          status: "ok",
          detail: downloads ? `${downloads.toLocaleString()} DL` : "Model erreichbar",
          data: data?.pipeline_tag ? `Pipeline: ${data.pipeline_tag}` : "Model Info ok",
        };
      },
    },
    {
      key: "alpha",
      name: "Alpha Vantage",
      run: async () => {
        const res = await fetch("https://www.alphavantage.co/query?function=ATR&symbol=IBM&interval=daily&time_period=14&apikey=demo");
        if (res.status === 503) throw new Error("Limit erreicht (503)");
        if (!res.ok) throw new Error("alphavantage failed");
        const data = await res.json();
        const values = data?.TechnicalAnalysis?.ATR || data?.TechnicalAnalysisATR || data?.TechnicalAnalysisATR || {};
        const first = Object.values(values)[0];
        return { status: "ok", detail: first?.ATR ? `ATR ${Number(first.ATR).toFixed(2)}` : "Demo ok", data: "IBM Daily" };
      },
    },
    {
      key: "fmp",
      name: "FMP",
      run: async () => {
        const res = await fetch("https://financialmodelingprep.com/api/v3/stock_market/actives?apikey=demo");
        if (res.status === 403) throw new Error("FMP Key benoetigt");
        if (!res.ok) throw new Error("fmp failed");
        const data = await res.json();
        return { status: "ok", detail: `${data.length || 0} Ticker`, data: data?.[0]?.symbol ? `Top: ${data[0].symbol}` : "Aktive geladen" };
      },
    },
  ];

  const loadApiPlaybook = async () => {
    setApiStatuses((prev) =>
      API_SOURCES.reduce((acc, cur) => {
        acc[cur.name] = prev[cur.name] || { state: "idle", note: "" };
        return acc;
      }, {})
    );
    const results = await Promise.all(
      apiCheckers.map(async (c) => {
        try {
          const value = await fetchWithCache(`apicheck:${c.key}`, c.run);
          return { name: c.name, state: "ok", note: value?.detail || t("reachable"), data: value?.data || "" };
        } catch (err) {
          const msg = err?.message || "Fehler";
          const auth = /key|token|401|403/i.test(msg);
          return {
            name: c.name,
            state: auth ? "auth" : "fail",
            note: auth ? t("apiKeyNeeded") : msg || t("unavailable"),
            data: "",
          };
        }
      })
    );
    const mapped = results.reduce((acc, r) => {
      acc[r.name] = { state: r.state, note: r.note, data: r.data || "" };
    return acc;
  }, {});
  setApiStatuses((prev) => ({ ...prev, ...mapped }));
};

  useEffect(() => {
    refreshAll();
    // Polling f�r Preis und Fear & Greed Index alle 30 Sekunden
    pollTimer.current = setInterval(() => {
      loadPrice();
      loadFearGreed(); // Fear & Greed auch im Polling-Intervall aktualisieren
    }, POLL_INTERVAL);
    return () => clearInterval(pollTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket.id]);

  useEffect(() => {
    loadEtfNews();
    newsTimer.current = setInterval(loadEtfNews, NEWS_REFRESH);
    return () => clearInterval(newsTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEtfFlows();
    if (flowsTimer.current) clearInterval(flowsTimer.current);
    flowsTimer.current = setInterval(() => loadEtfFlows(), FLOWS_REFRESH);
    return () => {
      if (flowsTimer.current) {
        clearInterval(flowsTimer.current);
        flowsTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    const ETF_REFRESH = 240000;
    loadEtfFlowData(etfSelection);
    const timer = setInterval(() => loadEtfFlowData(etfSelection), ETF_REFRESH);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    const HOLDING_REFRESH = 300000;
    loadEtfHoldingsData(etfSelection);
    const timer = setInterval(() => loadEtfHoldingsData(etfSelection), HOLDING_REFRESH);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    loadApiPlaybook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const STRIPE_LINKS = {
    pro_month: "https://billing.stripe.com/p/test_pro_month",
    pro_year: "https://billing.stripe.com/p/test_pro_year",
    elite_month: "https://billing.stripe.com/p/test_elite_month",
    elite_year: "https://billing.stripe.com/p/test_elite_year",
    customer_portal: "https://billing.stripe.com/p/test_portal",
  };

  const openStripe = (link) => {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const setMeta = (name, content) => {
      if (!name || !content) return;
      let tag = document.querySelector(`meta[name='${name}']`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta("keywords", `${APP_BRAND}, ai trading, risk manager, bitcoin analytics`);
    setMeta("description", `${APP_BRAND} ${APP_TAGLINE}`);
    setMeta("ai-tags", "#CryptoElite #AITrading #RiskManager");

    const ld = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `${APP_BRAND} Crypto Dashboard`,
      applicationCategory: "FinanceApplication",
      description: `${APP_BRAND} - ${APP_TAGLINE}`,
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: ["AI Predictor", "Backtesting", "Risk Score", "GeoIP Meta", "Beginner Mode", "Live OHLC"],
    };
    let script = document.getElementById("jsonld-features");
    if (!script) {
      script = document.createElement("script");
      script.id = "jsonld-features";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
  }, [selectedMarket.label, effectiveTier, timeFrame]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    if (consentGeo) {
      fetch("https://ipapi.co/json/", { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          setGeoInfo({ country: data.country_name, city: data.city, ip: data.ip });
          const setMeta = (name, content) => {
            if (!name || !content) return;
            let tag = document.querySelector(`meta[name='${name}']`);
            if (!tag) {
              tag = document.createElement("meta");
              tag.setAttribute("name", name);
              document.head.appendChild(tag);
            }
            tag.setAttribute("content", content);
          };
          setMeta("geoip.country", data.country_name || "");
          setMeta("geoip.city", data.city || "");
          setMeta("geoip.ip", data.ip || "");
          setMeta("ai-tags", "#CryptoElite #AITrading #RiskManager");
        })
        .catch(() => {})
        .finally(() => clearTimeout(timer));
    } else {
      clearTimeout(timer);
    }
    return () => clearTimeout(timer);
  }, [consentGeo]);

  useEffect(() => {
    if (authUser) {
      setUserEmail(authUser.email || t("demoUser"));
    } else {
      setUserEmail("");
    }
  }, [authUser, lang, t]);

  const handleSignin = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    setAuthError("");
    if (!auth) {
      setAuthError("Firebase nicht konfiguriert");
      return;
    }
    try {
      await fbLogin(authForm.email, authForm.password);
    } catch (err) {
      setAuthError(err?.message || "Login fehlgeschlagen");
    }
  };

  const handleSignup = async () => {
    setAuthError("");
    if (!auth) {
      setAuthError("Firebase nicht konfiguriert");
      return;
    }
    try {
      await fbSignup(authForm.email, authForm.password);
      const signupMsg =
        lang === "de"
          ? "Signup erfolgreich. Starte deine Testversion im Header."
          : "Signup complete. Start your trial from the header.";
      setSaveTierMessage(signupMsg);
      setTimeout(() => setSaveTierMessage(""), 2000);
    } catch (err) {
      setAuthError(err?.message || "Signup fehlgeschlagen");
    }
  };

  const handleLogout = async () => {
    setAuthError("");
    if (!auth) {
      setAuthError("Firebase nicht konfiguriert");
      return;
    }
    try {
      await fbLogout();
    } catch (err) {
      setAuthError(err?.message || "Logout failed");
    }
  };

  const _focusAuthSection = () => {
    if (typeof window === "undefined") return;
    const prefersDesktop = window.matchMedia("(min-width: 768px)").matches;
    const sectionRef = (prefersDesktop ? desktopAuthRef.current : mobileAuthRef.current) || desktopAuthRef.current || mobileAuthRef.current;
    const inputRef = (prefersDesktop ? desktopEmailRef.current : mobileEmailRef.current) || desktopEmailRef.current || mobileEmailRef.current;
    sectionRef?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef?.focus({ preventScroll: true });
  };

  const handleStartTrial = async () => {
    addToast(lang === "de" ? "Elite-Test laeuft automatisch fuer 7 Tage." : "Elite trial runs automatically for 7 days.", "info", {
      allowInfoWarn: true,
    });
  };

  const persistTier = async (tier) => {
    if (!auth || !auth.currentUser) {
      addToast(lang === "de" ? "Login noetig, um den Plan zu aendern." : "Login required to change plan.", "warn", { allowInfoWarn: true });
      return;
    }
    try {
      await saveUserTier(auth.currentUser.uid, tier);
      setSaveTierMessage(t("tierSaved"));
      setTimeout(() => setSaveTierMessage(""), 1200);
      await refreshUserTier();
    } catch (err) {
      console.error("save tier failed", err);
      addToast(lang === "de" ? "Plan konnte nicht gespeichert werden." : "Failed to update plan.", "error");
    }
  };

  useEffect(() => {
    loadOHLC();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFrame]);

  useEffect(() => {
    if (!highlightAuthCard) return undefined;
    const timer = setTimeout(() => setHighlightAuthCard(false), 2500);
    return () => clearTimeout(timer);
  }, [highlightAuthCard]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("journalEntries");
      if (raw) setJournalEntries(JSON.parse(raw));
    } catch (err) {
      console.error("Journal load failed", err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("journalEntries", JSON.stringify(journalEntries.slice(0, 50)));
    } catch (err) {
      console.error("Journal save failed", err);
    }
  }, [journalEntries]);

  useEffect(() => {
    const timer = setInterval(() => setBlink((p) => !p), 900);
    return () => clearInterval(timer);
  }, []);


  useEffect(() => {
    let attempts = 0;
    const binanceSymbol = resolveProviderSymbol("binance");
    const isCryptoAsset = selectedMarket.assetClass === "crypto";
    if (!binanceSymbol || !isCryptoAsset) {
      setWsStatus("unavailable");
      setLivePrice(null);
      clearInterval(fallbackTimer.current);
      fallbackTimer.current = null;
      clearInterval(pollingReconnectTimer.current);
      pollingReconnectTimer.current = null;
      return undefined;
    }
    const connect = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.CLOSED) wsRef.current = null;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;
      const symbol = (binanceSymbol || "").toLowerCase();
      if (!symbol) return;
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@trade`);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsStatus("live");
        updateApiHealth("binance", "ok");
        setWsAttempts(0);
        attempts = 0;
        clearInterval(fallbackTimer.current);
        fallbackTimer.current = null;
        clearInterval(pollingReconnectTimer.current);
        pollingReconnectTimer.current = null;
      };
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (assetIdRef.current !== selectedMarket.id) return;
          if (payload?.p) {
            const px = Number(payload.p);
            const qty = Number(payload.q || 0);
            const side = payload.m ? "sell" : "buy";
            setLivePrice(px);
            setTrades((prev) => [{ price: px, qty, usd: px * qty, side, ts: payload.T || Date.now() }, ...prev].slice(0, 50));
          }
        } catch (err) {
          console.error("WS parse error", err);
          logEvent("websocket", "warn", "WS parse error");
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        setWsStatus("reconnecting");
        attempts += 1;
        setWsAttempts(attempts);
        if (attempts <= 5) reconnectTimer.current = setTimeout(connect, 1500);
        else {
          setWsStatus("polling");
          updateApiHealth("binance", "fallback", "WS fallback -> polling");
          clearInterval(fallbackTimer.current);
          fallbackTimer.current = setInterval(loadPrice, 10000);
          if (!pollingReconnectTimer.current) {
            pollingReconnectTimer.current = setInterval(() => {
              attempts = 0;
              connect();
            }, 30000);
          }
        }
      };
      ws.onerror = () => {
        updateApiHealth("binance", "error", "WebSocket error");
        logEvent("websocket", "error", "WebSocket error");
        ws.close();
      };
    };
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      clearInterval(fallbackTimer.current);
      fallbackTimer.current = null;
      clearInterval(pollingReconnectTimer.current);
      pollingReconnectTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket.id, selectedMarket.assetClass]);
  const indicatorSeries = useMemo(() => {
    if (!ohlcv.length) return [];
    const closes = ohlcv.map((c) => c.close);
    const rsi = calculateRSISeries(closes, 14);
    const macd = calculateMACDSeries(closes, 12, 26, 9);
    const boll = calculateBollingerBands(closes, 20, 2);
    const stochRsi = calculateStochRSI(closes, 14, 3, 3);
    const stochPrice = calculateStochOsc(ohlcv, 14, 3, 3);
    const cci = calculateCCI(ohlcv, 20);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const atr = calculateATR(ohlcv, 14);
    const donchian = calculateDonchian(ohlcv, 20);
    const vwap = calculateVWAP(ohlcv);
    const obv = calculateOBV(ohlcv);
    const maxVol = Math.max(...ohlcv.map((c) => c.volume || 0), 1);
    const adx = calculateADX(ohlcv, 14);
    return ohlcv.map((row, idx) => ({
      ...row,
      rsi: rsi[idx],
      macd: macd.macd[idx],
      macdSignal: macd.signal[idx],
      macdHist: macd.histogram[idx],
      bollUpper: boll.upper[idx],
      bollLower: boll.lower[idx],
      bollBasis: boll.basis[idx],
      stochK: stochRsi.k[idx],
      stochD: stochRsi.d[idx],
      stochPriceK: stochPrice.k[idx],
      stochPriceD: stochPrice.d[idx],
      cci: cci[idx],
      ema20: ema20[idx],
      ema50: ema50[idx],
      ema200: ema200[idx],
      atr: atr[idx],
      atrPct: row.close ? (atr[idx] / row.close) * 100 : null,
      adx: adx[idx],
      donchianHigh: donchian.upper[idx],
      donchianLow: donchian.lower[idx],
      donchianMid: donchian.mid[idx],
      vwap: vwap[idx],
      obv: obv[idx],
      volumeSpike: row.volume ? row.volume / maxVol : null,
      volumeUp: row.close >= row.open ? row.volume : 0,
      volumeDown: row.close < row.open ? row.volume : 0,
    }));
  }, [ohlcv]);

  useEffect(() => {
    if (!indicatorSeries.length) return;
    const last = indicatorSeries[indicatorSeries.length - 1];
    setIndicators({
      rsi: Number.isFinite(last?.rsi) ? last.rsi : null,
      macd: Number.isFinite(last?.macd) ? last.macd : null,
      signal: Number.isFinite(last?.macdSignal) ? last.macdSignal : null,
      histogram: Number.isFinite(last?.macdHist) ? last.macdHist : null,
    });
  }, [indicatorSeries]);

  useEffect(() => {
    const predictorSeries =
      selectedMarket?.id === "BTCUSD" && htfOhlcv?.h4?.length ? htfOhlcv.h4 : indicatorSeries;
    if (!predictorSeries.length) return;
    const closes = predictorSeries.map((c) => c.close).filter((v) => Number.isFinite(v));
    if (!closes.length) return;
    const lastClose = closes[closes.length - 1];
    const base = closes[Math.max(0, closes.length - 12)];
    const drift = lastClose - base;
    const forecastPct = drift >= 0 ? 5 : -4;
    const confidence = Math.min(95, Math.max(65, Math.abs((drift / (base || lastClose || 1)) * 4800)));
    setAiPredict({
      forecast: lastClose ? lastClose * (1 + forecastPct / 100) : null,
      confidence: Math.round(confidence),
      trend: drift >= 0 ? "bullish" : "bearish",
      refreshedAt: Date.now(),
    });
  }, [indicatorSeries, htfOhlcv, selectedMarket?.id]);

  const computedBacktest = useMemo(() => {
    if (!indicatorSeries.length) return null;
    const signals = buildBacktestSignals(indicatorSeries);
    const result = runBacktestV3({ candles: indicatorSeries, signals, maxHoldBars: 5 });
    const wins = result.trades.filter((t) => t.result === "win").length;
    const losses = result.trades.filter((t) => t.result === "loss").length;
    return {
      trades: result.trades.length,
      wins,
      losses,
      winRate: result.winRate,
      avgRr: result.avgRR,
      avgRR: result.avgRR,
      setupWinrates: result.setupWinrates,
      regimeWinrates: result.regimeWinrates,
      equityCurve: result.equityCurve,
      maxDrawdown: result.maxDrawdown,
      profitFactor: result.profitFactor,
      profitPct: result.profitPct,
    };
  }, [indicatorSeries]);

  useEffect(() => {
    if (!computedBacktest) return;
    setBacktestStats(computedBacktest);
  }, [computedBacktest]);

  const suggestRisk = () => {
    const entry = tpForm.entry ?? displayPrice;
    if (!entry) return;
    const last = indicatorSeries.at(-1);
    const atrPct = Number.isFinite(last?.atrPct) ? last.atrPct : null;
    const setupType =
      indicators.rsi && indicators.rsi < 30
        ? "reversion"
        : indicators.rsi && indicators.rsi > 70
        ? "reversion"
        : "trend";
    const direction = indicators.rsi && indicators.rsi > 70 ? "short" : "long";
    const stops = computeStopAndTarget({ entry, direction, atrPct, regimeLabel: marketRegime?.label, setupType });
    if (stops.tp && stops.sl) {
      const tpPct = direction === "long" ? ((stops.tp - entry) / entry) * 100 : ((entry - stops.tp) / entry) * 100;
      const slPct = direction === "long" ? ((entry - stops.sl) / entry) * 100 : ((stops.sl - entry) / entry) * 100;
      setTpForm((prev) => ({ ...prev, entry, tpPct: Number(tpPct.toFixed(2)), slPct: Number(slPct.toFixed(2)) }));
      setAiNote(
        `Engine Stops (${direction}): ATR-basiert mit Risiko-Polster ${stops.riskPad ? (stops.riskPad * 100).toFixed(2) + "%" : ""}`
      );
      return;
    }
    // Fallback to legacy heuristic
    const rsi = indicators.rsi;
    let tpPct = 4;
    let slPct = 3;
    let note = "Neutral Trend: TP 4%, SL 3%.";
    if (rsi && rsi < 30) {
      tpPct = 6;
      slPct = 2.5;
      note = "Oversold (RSI<30): TP 6%, SL 2.5%.";
    } else if (rsi && rsi > 70) {
      tpPct = 3;
      slPct = 4;
      note = "Overbought (RSI>70): TP 3%, SL 4%.";
    } else if (indicators.macd && indicators.signal && indicators.macd > indicators.signal) {
      tpPct = 5;
      slPct = 3;
      note = "MACD Bullish: TP 5%, SL 3%.";
    }
    setTpForm((prev) => ({ ...prev, entry: prev.entry ?? displayPrice, tpPct, slPct }));
    setAiNote(note);
  };

  const signalBadges = [
    { label: "RSI", value: indicators.rsi ? indicators.rsi.toFixed(1) : "-", intent: indicators.rsi && (indicators.rsi < 30 || indicators.rsi > 70) ? "warn" : "ok" },
    {
      label: "MACD",
      value:
        indicators.macd && indicators.signal
          ? indicators.macd - indicators.signal >= 0
            ? "Bullish"
            : "Bearish"
          : "-",
      intent:
        indicators.macd && indicators.signal
          ? indicators.macd - indicators.signal >= 0
            ? "ok"
            : "warn"
          : "neutral",
    },
    { label: "Bollinger", value: "20 / 2 std", intent: "neutral" },
  ];

  const healthColor = (status) => {
    if (status === "ok") return "text-emerald-300";
    if (status === "error") return "text-red-300";
    if (status === "disabled") return "text-slate-400";
    if (status === "degraded") return "text-amber-300";
    return "text-amber-300";
  };

  const formatHealthLabel = (status) => {
    switch (status) {
      case "ok":
        return "OK";
      case "error":
        return "Fehler";
      case "cors":
        return "CORS";
      case "disabled":
        return "Disabled";
      case "degraded":
        return "Degraded";
      default:
        return "Warn";
    }
  };

  const dataSourceStatuses = useMemo(
    () =>
      DATA_SOURCE_LIST.map((cfg) => {
        const entry = sourceHealth?.[cfg.key] || null;
        const fallbackStatus = cfg.enabled ? "ok" : "disabled";
        return {
          key: cfg.key,
          label: cfg.label,
          status: entry?.status || fallbackStatus,
          message: entry?.message || (cfg.enabled ? "" : "Quelle deaktiviert"),
        };
      }).sort((a, b) => {
        const order = { ok: 0, warn: 1, degraded: 1, fallback: 1, error: 2, cors: 2, disabled: 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
      }),
    [sourceHealth]
  );

  const runtimeHealthEntries = useMemo(
    () =>
      Object.entries(apiHealth).filter((entry) => {
        const key = entry[0];
        return !Object.prototype.hasOwnProperty.call(dataSources, key);
      }),
    [apiHealth]
  );

  const ETF_SYMBOLS = ["IBIT", "FBTC", "ARKB", "BTCO", "BITB", "HODL"];

const buildEtfChartData = (seriesList = []) => {
  const map = {};
  seriesList.forEach((s) => {
    s.points.forEach((p) => {
      const key = p.date;
      if (!map[key]) map[key] = { date: key };
      map[key][s.symbol] = p.netFlowUsd ?? p.flow ?? 0;
    });
  });
  return Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
};

const etfColors = ["#22c55e", "#38bdf8", "#a855f7", "#fbbf24", "#ef4444", "#0ea5e9"];

  const tpEntry = clampNumber(tpForm.entry ?? displayPrice, null);
  const tpPct = clampNumber(tpForm.tpPct, null);
  const slPct = clampNumber(tpForm.slPct, null);
  const qty = clampNumber(tpForm.quantity, 0) ?? 0;
  const takeProfitPrice = tpEntry !== null && tpPct !== null ? tpEntry * (1 + tpPct / 100) : null;
  const stopLossPrice = tpEntry !== null && slPct !== null ? tpEntry * (1 - slPct / 100) : null;
  const profit = takeProfitPrice !== null && tpEntry !== null ? (takeProfitPrice - tpEntry) * qty : null;
  const loss = stopLossPrice !== null && tpEntry !== null ? (tpEntry - stopLossPrice) * qty : null;
  const rr = profit !== null && loss !== null && loss !== 0 ? profit / loss : null;

  useEffect(() => {
    if (displayPrice && tpForm.entry === null) setTpForm((prev) => ({ ...prev, entry: displayPrice }));
  }, [displayPrice, tpForm.entry]);

  const lastPoint = useMemo(() => (indicatorSeries.length > 0 ? indicatorSeries[indicatorSeries.length - 1] : null), [indicatorSeries]);
  const lastClose = lastPoint?.close ?? null;
  const tpZone = useMemo(() => {
    if (!takeProfitPrice) return null;
    const pad = takeProfitPrice * 0.0025;
    return { y1: takeProfitPrice - pad, y2: takeProfitPrice + pad };
  }, [takeProfitPrice]);
  const slZone = useMemo(() => {
    if (!stopLossPrice) return null;
    const pad = stopLossPrice * 0.0025;
    return { y1: stopLossPrice - pad, y2: stopLossPrice + pad };
  }, [stopLossPrice]);
  const nearTp = takeProfitPrice && lastClose ? Math.abs(lastClose - takeProfitPrice) / takeProfitPrice <= 0.006 : false;
  const nearSl = stopLossPrice && lastClose ? Math.abs(lastClose - stopLossPrice) / stopLossPrice <= 0.006 : false;

  const computeRegime = (row) => {
    if (!row) return { label: "Neutral", color: "text-slate-200", intent: "neutral", confidence: 0.5, detail: "Keine Daten" };
    const emaBias = row.ema200 && row.close ? (row.close - row.ema200) / row.ema200 : null;
    const bbWidth =
      Number.isFinite(row.bollUpper) && Number.isFinite(row.bollLower) && Number.isFinite(row.bollBasis) && row.bollBasis
        ? ((row.bollUpper - row.bollLower) / row.bollBasis) * 100
        : null;
    const adxVal = Number.isFinite(row.adx) ? row.adx : null;
    const strongTrend = adxVal !== null ? adxVal > 25 : false;
    let label = "Choppy";
    let color = "text-slate-200";
    let intent = "neutral";
    if (emaBias !== null && strongTrend && bbWidth !== null && bbWidth > 5) {
      if (emaBias > 0) {
        label = "Bull";
        color = "text-emerald-300";
        intent = "ok";
      } else {
        label = "Bear";
        color = "text-red-300";
        intent = "warn";
      }
    } else if (bbWidth !== null && bbWidth < 3) {
      label = "Crab";
      color = "text-amber-300";
    }
    const confidenceParts = [
      adxVal !== null ? Math.min(1, adxVal / 40) : 0.4,
      emaBias !== null ? Math.min(1, Math.abs(emaBias)) : 0.3,
      bbWidth !== null ? Math.min(1, bbWidth / 10) : 0.3,
    ];
    const confidence = Number(((confidenceParts.reduce((a, b) => a + b, 0) / confidenceParts.length) * 0.9 + 0.1).toFixed(2));
    return {
      label,
      color,
      intent,
      confidence,
      detail: `EMA200 ${emaBias !== null ? (emaBias * 100).toFixed(2) + "%" : "-"} | ADX ${adxVal ? adxVal.toFixed(1) : "-"} | BBW ${
        bbWidth ? bbWidth.toFixed(2) + "%" : "-"
      }`,
    };
  };

  const marketRegime = useMemo(() => computeRegime(lastPoint), [lastPoint]);
  const htfRegime = useMemo(() => {
    const series = htfOhlcv?.h4?.length ? htfOhlcv.h4 : htfOhlcv?.d1 || [];
    if (!series.length) return marketRegime;
    const closes = series.map((c) => c.close);
    const ema200 = calculateEMA(closes, 200);
    const bb = calculateBollingerBands(closes, 20, 2);
    const adx = calculateADX(series, 14);
    const idx = series.length - 1;
    const row = {
      ...series[idx],
      ema200: ema200[idx],
      bollUpper: bb.upper[idx],
      bollLower: bb.lower[idx],
      bollBasis: bb.basis[idx],
      adx: adx[idx],
    };
    const derived = computeRegime(row);
    return { label: derived.label, intent: derived.intent };
  }, [htfOhlcv, marketRegime]);
  const smartMoney = useMemo(() => {
    const horizon = Date.now() - 3 * 60 * 60 * 1000;
    const filtered = trades.filter((t) => t.ts >= horizon);
    const big = filtered.filter((t) => t.usd >= 100000);
    const bucket = big.length ? big : filtered;
    const buys = bucket.filter((t) => t.side === "buy").reduce((a, b) => a + b.usd, 0);
    const sells = bucket.filter((t) => t.side === "sell").reduce((a, b) => a + b.usd, 0);
    const net = buys - sells;
    const abs = buys + sells || 1;
    const pct = Math.round(Math.min(99, Math.max(-99, (net / abs) * 100)));
    const title = net >= 0 ? t("smartAccum") : t("smartDistr");
    const direction = net >= 0 ? t("smartDirBuy") : t("smartDirSell");
    return { title, net, pct, direction, buys, sells, count: bucket.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, lang, t]);

  const liquidity = useMemo(() => {
    const horizon = Date.now() - 60 * 60 * 1000;
    const recent = trades.filter((t) => t.ts >= horizon);
    const bids = recent.filter((t) => t.side === "buy").reduce((a, b) => a + b.usd, 0);
    const asks = recent.filter((t) => t.side === "sell").reduce((a, b) => a + b.usd, 0);
    const total = bids + asks || 1;
    const dominance = (bids / total) * 100;
    let tone = "text-slate-200";
    if (dominance >= 55) tone = "text-emerald-300";
    else if (dominance <= 45) tone = "text-red-300";
    return {
      bids,
      asks,
      dominance: dominance.toFixed(0),
      imbalance: Math.abs(50 - dominance).toFixed(0),
      tone,
    };
  }, [trades]);

  const [onChainMetrics, setOnChainMetrics] = useState({ active: null, supplyWhales: null, supplyRetail: null, updatedAt: null });
  const [sentimentMetrics, setSentimentMetrics] = useState({ score: null, label: "Social Score", updatedAt: null });
  const [correlations, setCorrelations] = useState([]);
  const [fundingRates, setFundingRates] = useState([]);
  const [derivativesRisk, setDerivativesRisk] = useState({ score: null, riskLevel: "neutral", updatedAt: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [onchain, sentiment, corr, funding] = await Promise.all([
        cryptoDataService.fetchOnChainMetrics(updateApiHealth, logEvent, addToast),
        cryptoDataService.fetchSentiment(updateApiHealth, logEvent, addToast),
        cryptoDataService.fetchCorrelation(["bitcoin", "ethereum", "solana", "ripple"], updateApiHealth, logEvent, addToast),
        cryptoDataService.fetchFundingRates(["BTCUSDT", "ETHUSDT", "SOLUSDT"], updateApiHealth, logEvent, addToast),
      ]);
      if (!mounted) return;
      setOnChainMetrics(onchain);
      setSentimentMetrics(sentiment);
      setCorrelations(corr);
      setFundingRates(funding);
      updateApiHealth("glassnode", "ok");
      updateApiHealth("santiment", "ok");
      updateApiHealth("coingecko", "ok");
      updateApiHealth("binance", "ok");
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiSignal = useMemo(() => {
    return buildAISignal({ indicatorSeries, indicators, displayPrice, takeProfitPrice, stopLossPrice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorSeries, indicators.macd, indicators.signal, indicators.rsi, displayPrice, takeProfitPrice, stopLossPrice]);

  const fibView = useMemo(() => {
    if (!indicatorSeries.length) {
      return { levels: [], goldenLow: null, goldenHigh: null, current: displayPrice, tp: takeProfitPrice, sl: stopLossPrice, yMin: null, yMax: null };
    }
    const highs = indicatorSeries.map((r) => r.high);
    const lows = indicatorSeries.map((r) => r.low);
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow || 1;
    const retracements = [
      { label: "0%", value: maxHigh },
      { label: "23.6%", value: maxHigh - range * 0.236 },
      { label: "38.2%", value: maxHigh - range * 0.382 },
      { label: "50%", value: maxHigh - range * 0.5 },
      { label: "61.8%", value: maxHigh - range * 0.618 },
      { label: "78.6%", value: maxHigh - range * 0.786 },
      { label: "100%", value: minLow },
    ];
    const goldenHigh = maxHigh - range * 0.618;
    const goldenLow = maxHigh - range * 0.786;
    const pad = range * 0.02;
    return {
      levels: retracements,
      goldenLow,
      goldenHigh,
      current: displayPrice,
      tp: takeProfitPrice,
      sl: stopLossPrice,
      yMin: minLow - pad,
      yMax: maxHigh + pad,
    };
  }, [indicatorSeries, displayPrice, takeProfitPrice, stopLossPrice]);

  const bubbleData = useMemo(() => {
    if (!indicatorSeries.length) return [];
    const mapped = indicatorSeries.map((row, idx) => {
      const rsiVal = row.rsi;
      if (!Number.isFinite(rsiVal)) return null;
      const bias = rsiVal < 40 ? "buy" : rsiVal > 60 ? "sell" : "neutral";
      if (bias === "neutral") return null;
      const magnitude = Math.min(96, Math.max(52, Math.abs(rsiVal - 50) * 1.8));
      return {
        id: `${row.label}-${idx}`,
        label: `${selectedMarket.id} ${row.label}`,
        bias,
        rsi: rsiVal,
        size: magnitude,
      };
    }).filter(Boolean);
    return mapped.sort((a, b) => Math.abs(b.rsi - 50) - Math.abs(a.rsi - 50)).slice(0, 10);
  }, [indicatorSeries, selectedMarket.id]);

  const proSignal = useMemo(() => {
    const enrichedBacktest = {
      winRate: backtestStats?.winRate || null,
      avgRR: backtestStats?.avgRR || backtestStats?.avgRr || null,
      setupWinrates: backtestStats?.setupWinrates,
      regimeWinrates: backtestStats?.regimeWinrates,
    };
    const defaultSignal = {
      action: "wait",
      reason: lang === "de" ? "Kein klares Setup." : "Waiting for alignment.",
      confidence: 0,
      score: 0,
      meta: {},
    };
    const baseSignal =
      buildSignalsV3({
        indicatorSeries,
        marketRegime,
        smartMoney,
        sentimentMetrics,
        backtestStats: enrichedBacktest,
        htfRegime,
        derivativesRisk,
      }) || defaultSignal;
    const predictorStrong = aiPredict?.trend === "bullish" && (aiPredict?.confidence ?? 0) >= 70;
    const predictorNeutral = (aiPredict?.confidence ?? 0) < 60 || aiPredict?.trend === "neutral";
    if (baseSignal?.action && predictorNeutral && baseSignal.action !== "wait") {
      return {
        ...baseSignal,
        action: "wait",
        reason:
          lang === "de"
            ? "AI Predictor (4h) neutral/geringe Sicherheit � wir warten."
            : "AI predictor (4h) neutral/low confidence � waiting.",
        meta: { ...(baseSignal.meta || {}), predictorAligned: false },
      };
    }
    if (baseSignal?.action === "long" && predictorStrong) {
      return {
        ...baseSignal,
        reason:
          lang === "de"
            ? `AI Predictor (4h Kraken) bullisch mit hoher Sicherheit; ${baseSignal.reason || "Setup bestaetigt."}`
            : `AI predictor (4h Kraken) bullish with solid confidence; ${baseSignal.reason || "setup confirmed."}`,
        meta: { ...(baseSignal.meta || {}), predictorAligned: true },
      };
    }
    return { ...baseSignal, meta: { ...(baseSignal.meta || {}), predictorAligned: !predictorNeutral } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    indicatorSeries,
    indicators.macd,
    indicators.signal,
    indicators.rsi,
    smartMoney.net,
    marketRegime.label,
    marketRegime.intent,
    sentimentMetrics,
    backtestStats?.winRate,
    backtestStats?.avgRR,
    htfRegime,
    derivativesRisk,
    aiPredict?.trend,
    aiPredict?.confidence,
    lang,
  ]);

  // Platform context for Vision AI Chat - passes live data to chatbot
  const chatContext = useMemo(() => ({
    asset: selectedMarket.id || "BTC",
    price: displayPrice,
    rsi: indicators?.rsi,
    macd: indicators?.macd,
    macdSignal: indicators?.signal,
    trend: marketRegime?.label,
    regime: marketRegime?.label,
    fearGreed: fearGreed?.value ? Number(fearGreed.value) : undefined,
    signal: aiSignal?.action?.toUpperCase() || proSignal?.action?.toUpperCase(),
    confidence: aiSignal?.confidence || proSignal?.confidence,
    tp: takeProfitPrice,
    sl: stopLossPrice,
  }), [
    selectedMarket.id,
    displayPrice,
    indicators?.rsi,
    indicators?.macd,
    indicators?.signal,
    marketRegime?.label,
    fearGreed?.value,
    aiSignal?.action,
    aiSignal?.confidence,
    proSignal?.action,
    proSignal?.confidence,
    takeProfitPrice,
    stopLossPrice,
  ]);

  // backtestStats handled via state setter to avoid duplicate declarations

  const addJournalEntry = () => {
    const date = journalForm.date || new Date().toISOString().slice(0, 10);
    if (!journalForm.note.trim()) return;
    const entry = { date, mood: journalForm.mood, note: journalForm.note.trim(), ts: Date.now() };
    setJournalEntries((prev) => [entry, ...prev].slice(0, 50));
    setJournalForm((p) => ({ ...p, note: "" }));
  };

  const volumeBuckets = useMemo(() => {
    const now = Date.now();
    const bucketCount = 24;
    const buckets = [];
    for (let i = bucketCount - 1; i >= 0; i -= 1) {
      const start = now - i * 60 * 1000;
      const end = start + 60 * 1000;
      const tradesInBucket = trades.filter((t) => t.ts >= start && t.ts < end);
      const buy = tradesInBucket.filter((t) => t.side === "buy").reduce((acc, t) => acc + t.usd, 0);
      const sell = tradesInBucket.filter((t) => t.side === "sell").reduce((acc, t) => acc + t.usd, 0);
      buckets.push({
        label: new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        buy,
        sell,
        net: buy - sell,
      });
    }
    return buckets;
  }, [trades]);

  if (tierLoading) {
    return <FullScreenLoader message="Session wird geladen..." />;
  }
  const showTrialBanner = false;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y">
      {showTrialBanner && trialActive ? (
        <div className="bg-emerald-500/10 border-b border-emerald-500/40 text-emerald-100 text-sm px-4 py-2 text-center">
          7-Tage-Testversion aktiv. Laeuft ab am {trialEnd || "-"}
        </div>
      ) : null}
      {toasts.length > 0 ? (
        <div className="fixed right-3 left-3 top-16 md:left-auto md:top-4 md:right-4 z-50 space-y-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2 shadow-lg ${
                t.type === "warn"
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-50"
                  : t.type === "info"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-50"
                  : "border-red-500/50 bg-red-500/10 text-red-50"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t.type === "warn" ? "Warn" : t.type === "info" ? "Info" : "Error"}
              </span>
              <p className="text-sm leading-snug">{t.message}</p>
              <button onClick={() => removeToast(t.id)} className="ml-auto text-xs text-slate-200/80 hover:text-white">
                �
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="hidden md:block w-full max-w-screen lg:max-w-full mx-auto px-3 py-8">
        <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-300">Vision AI Mind</p>
            <h1 className="text-3xl font-bold text-slate-50">Crypto Risk Manager</h1>
            <p className="text-sm text-slate-400">{t("heroSubtitle")}</p>
            {/* Navigation Links */}
            <nav className="flex items-center gap-4 mt-2">
              <a href="/coins" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M6 12h12"/></svg>
                Coins
              </a>
              <a href="/signals" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                Signals
              </a>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedMarket.id}
              onChange={(e) => {
                const next = e.target.value || DEFAULT_MARKET_ID;
                setSelectedAssetId(next);
                setLivePrice(null);
              }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              {Object.entries(groupedMarkets).map(([cls, entries]) => (
                <optgroup key={cls} label={ASSET_CLASS_LABELS[cls] || cls}>
                  {entries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div
              ref={desktopAuthRef}
              className={`flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-inner shadow-black/30 ${
                highlightAuthCard ? "ring-2 ring-amber-400/60" : ""
              }`}
            >
              <div>
                <div className="font-semibold text-slate-100">{tierLabels[effectiveTier] || tierLabels.basic}</div>
                <div className="text-[11px] text-slate-400">{userEmail || t("login")}</div>
                {trialBadgeText ? (
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                      {trialBadgeText}
                    </span>
                  </div>
                ) : trialExpired && trialStart ? (
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                      {lang === "de" ? "Trial abgelaufen" : "Trial expired"}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => persistTier("basic")} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                  {t("tierBasic")}
                </button>
                <button onClick={() => persistTier("pro")} className="rounded bg-emerald-600/80 px-2 py-1 text-[11px] text-emerald-950 hover:bg-emerald-500">
                  {t("tierPro")}
                </button>
                <button onClick={() => persistTier("elite")} className="rounded bg-cyan-500/80 px-2 py-1 text-[11px] text-cyan-950 hover:bg-cyan-400">
                  {t("tierElite")}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => openStripe(STRIPE_LINKS.customer_portal)} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                  {t("billing")}
                </button>
                <form onSubmit={handleSignin} className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <button type="submit" className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                      {t("signin")}
                    </button>
                    <button type="button" onClick={handleSignup} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                      {t("signup")}
                    </button>
                    <button type="button" onClick={handleLogout} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                      {t("logout")}
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="email"
                      ref={desktopEmailRef}
                      value={authForm.email}
                      onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder={t("loginEmail")}
                      className="w-36 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                    />
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder={t("loginPassword")}
                      className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
                    />
                  </div>
                  {authError ? <span className="text-[11px] text-amber-300">{authError}</span> : null}
                  {saveTierMessage ? <span className="text-[11px] text-emerald-300">{saveTierMessage}</span> : null}
                  <button
                    type="button"
                    onClick={handleStartTrial}
                    disabled
                    className={`rounded px-2 py-1 text-[11px] font-semibold text-amber-950 transition-colors ${
                      "bg-amber-500/40 cursor-not-allowed"
                    }`}
                  >
                    {trialActive ? t("trialActive") : t("startTrial")}
                  </button>
                  {trialExpired && trialStart ? (
                    <span className="text-[11px] text-amber-300">
                      {lang === "de" ? "Testversion abgelaufen." : "Trial expired."}
                    </span>
                  ) : null}
                </form>
              </div>
            </div>
            <button
              onClick={() => setLang((p) => (p === "de" ? "en" : "de"))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              {t("langToggle")}
            </button>
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              <option value="15">15m</option>
              <option value="60">1h</option>
              <option value="240">4h</option>
              <option value="1440">1d</option>
            </select>
            <button
              onClick={() => {
                setIsBeginner((prev) => {
                  const next = !prev;
                  localStorage.setItem("mode:beginner", next ? "true" : "false");
                  return next;
                });
              }}
              className={`rounded-xl border px-3 py-2 text-sm shadow-inner shadow-black/30 ${
                isBeginner ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-100"
              }`}
              title="Beginner-Mode blendet Advanced Cards aus"
            >
              {isBeginner ? "Beginner-Mode" : "Pro-View"}
            </button>
            <IndicatorBadge label="WebSocket" value={wsStatus === "live" ? "Live" : wsStatus} intent={wsStatus === "live" ? "ok" : "warn"} />
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {t("refresh")}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <Card
            title={t("livePrice")}
            icon={Activity}
            tooltip="Live Price mit 24h Change, Multi-Source Fallback."
            actions={
              <div className="flex gap-2">
                <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{selectedMarket.label}</span>
                <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{priceState.source}</span>
              </div>
            }
          >
            <div className="flex flex-col gap-2">
              <div className="text-3xl font-bold text-white">{formatUSD(displayPrice)}</div>
              <div className={`text-sm font-semibold ${(priceState.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatPercent(priceState.change24h ?? 0)} 24h
              </div>
              <p className="text-xs text-slate-400">Update: {priceState.updatedAt ? new Date(priceState.updatedAt).toLocaleTimeString() : "-"}</p>
            </div>
          </Card>

          <Card title={t("fearGreed")} icon={Gauge} tooltip="Fear & Greed Index letzte Aktualisierung.">
            {fearGreed ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">{fearGreed.value}</span>
                  <span className="text-sm uppercase tracking-wide text-slate-400">{fearGreed.classification}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, fearGreed.value)}%` }} />
                </div>
                <span className="text-xs text-slate-400">
                  Stand: {new Date(fearGreed.updatedAt).toLocaleTimeString()} � Source: {fearGreed.source || "alternative.me"}
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Lade Daten...</p>
            )}
          </Card>

          <Card title={t("indicators")} icon={LineChartIcon} tooltip="RSI: Oversold <30, Overbought >70. MACD Momentum + Bollinger.">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">RSI</span>
                <span className={`font-semibold ${indicators.rsi && (indicators.rsi < 30 || indicators.rsi > 70) ? "text-amber-400" : "text-emerald-300"}`}>
                  {indicators.rsi ? indicators.rsi.toFixed(1) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">MACD</span>
                <span className="font-semibold text-slate-100">
                  {indicators.macd && indicators.signal ? `${(indicators.macd - indicators.signal).toFixed(2)} (${indicators.macd.toFixed(2)}/${indicators.signal.toFixed(2)})` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Bollinger</span>
                <span className="font-semibold text-slate-100">20 / 2 std</span>
              </div>
            </div>
          </Card>

          <Card title={t("reliability")} icon={Shield} tooltip="System-Robustheit: Cache, Polling, WS Reconnect.">
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-emerald-400" /> {t("reliability1")}
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-emerald-400" /> {t("reliability2")}
              </li>
              <li className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-emerald-400" /> {t("reliability3")}
              </li>
              <li className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-emerald-400" /> {t("reliability4")}
              </li>
            </ul>
          </Card>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {/* TradingView Live Chart - Zuverl�ssige Echtzeit-Daten mit unseren Algorithmus-Signalen */}
            <Suspense fallback={<div className="h-[500px] flex items-center justify-center bg-slate-900/50 rounded-xl"><Skeleton className="h-96 w-full" /></div>}>
              <TradingViewPanel
                assetId={selectedMarket.id}
                assetClass={selectedMarket.assetClass}
                timeFrame={timeFrame}
                showTechnicalAnalysis={true}
                chartHeight={450}
                technicalHeight={300}
                theme="dark"
                currentPrice={displayPrice}
                fibLevels={fibView.levels.length > 0 ? Object.fromEntries(fibView.levels.map(l => [l.label, l.value])) : null}
                tpLevels={takeProfitPrice ? [takeProfitPrice] : []}
                slLevel={stopLossPrice}
                riskReward={takeProfitPrice && stopLossPrice && displayPrice ? Math.abs(takeProfitPrice - displayPrice) / Math.abs(displayPrice - stopLossPrice) : null}
                trendDirection={aiSignal?.direction === "bullish" ? "bullish" : aiSignal?.direction === "bearish" ? "bearish" : null}
                signalStrength={aiSignal?.confidence ? Math.round(aiSignal.confidence / 20) : null}
              />
            </Suspense>
            <div className="mt-4">
              <Card
                title={t("fibMap")}
                icon={LineChartIcon}
                actions={<span className="text-xs text-slate-400">{t("fibGolden")} � TF {timeFrame === "15" ? "15m" : timeFrame === "60" ? "1h" : timeFrame === "240" ? "4h" : "1d"}</span>}
              >
                <LazyRender placeholder={<div className="h-64 flex items-center justify-center"><Skeleton className="h-56 w-full" /></div>}>
                  {indicatorSeries.length > 0 ? (
                    <div className="relative w-full min-w-0" style={{ minHeight: 200 }}>
                      {(nearTp || nearSl) && (
                        <div className="absolute right-3 top-3 flex gap-2 text-xs">
                          {nearTp ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200 pulse-soft">{t("tpAlarm")}</span> : null}
                          {nearSl ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-200 pulse-soft">{t("slAlarm")}</span> : null}
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={indicatorSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                            width={80}
                            domain={[fibView.yMin ?? "auto", fibView.yMax ?? "auto"]}
                            tickFormatter={(v) => Math.round(v).toLocaleString()}
                          />
                          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                          {tpZone ? <ReferenceArea y1={tpZone.y1} y2={tpZone.y2} strokeOpacity={0} fill="#22c55e" fillOpacity={0.07} className="glow-band" /> : null}
                          {slZone ? <ReferenceArea y1={slZone.y1} y2={slZone.y2} strokeOpacity={0} fill="#ef4444" fillOpacity={0.07} className="glow-band" /> : null}
                          {fibView.goldenLow && fibView.goldenHigh ? <ReferenceArea y1={fibView.goldenLow} y2={fibView.goldenHigh} strokeOpacity={0} fill="#fbbf24" fillOpacity={0.1} /> : null}
                      {fibView.levels.map((lvl) => (
                        <ReferenceLine key={lvl.label} y={lvl.value} stroke="#475569" strokeDasharray="2 4" label={{ value: lvl.label, position: "insideRight", fill: "#cbd5e1", fontSize: 10 }} />
                      ))}
                      {fibView.tp ? <ReferenceLine y={fibView.tp} stroke="#22c55e" strokeWidth={2} strokeOpacity={blink ? 1 : 0.4} label={{ value: t("fibTp"), position: "insideLeft", fill: "#22c55e", fontSize: 10 }} /> : null}
                      {fibView.sl ? <ReferenceLine y={fibView.sl} stroke="#ef4444" strokeWidth={2} strokeOpacity={blink ? 1 : 0.4} label={{ value: t("fibSl"), position: "insideLeft", fill: "#ef4444", fontSize: 10 }} /> : null}
                      {fibView.current ? <ReferenceLine y={fibView.current} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: t("fibNow"), position: "insideLeft", fill: "#38bdf8", fontSize: 10 }} /> : null}
                      <Line
                        type="monotone"
                        dataKey="close"
                            stroke="#22c55e"
                            dot={renderLastDot(indicatorSeries.length, "#22c55e")}
                            strokeWidth={2}
                            name="Close"
                            isAnimationActive
                            animationDuration={650}
                            animationEasing="ease-out"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("loadingFib")}</p>
                  )}
                </LazyRender>
              </Card>
            </div>
            <div className="mt-4">
            <Card title={t("cryptoBubbles")} icon={TrendingUp} actions={<span className="text-xs text-slate-400">{t("bubblesTop")}</span>}>
                <LazyRender
                  placeholder={
                    <div className="h-40 flex items-center justify-center">
                      <div className="flex gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-14 w-14 rounded-full" />
                        <Skeleton className="h-12 w-12 rounded-full" />
                      </div>
                    </div>
                  }
                >
                  {bubbleData.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {bubbleData.map((b) => (
                        <div
                          key={b.id}
                          className={`flex items-center justify-center rounded-full bg-slate-900/80 border ${b.bias === "buy" ? "border-emerald-500/60 text-emerald-100" : "border-red-500/60 text-red-100"}`}
                          style={{ width: `${b.size}px`, height: `${b.size}px` }}
                        >
                          <div className="text-center text-[10px] font-semibold leading-tight px-1">
                            <div className="truncate">{b.label}</div>
                            <div className="text-[9px] opacity-80">RSI {b.rsi.toFixed(1)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("noBubbles")}</p>
                  )}
                </LazyRender>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card title="AI Predictor" icon={Signal} tooltip="HuggingFace-Style Inference: Richtungs-Schaetzung + Confidence.">
                <div className="flex flex-col gap-3">
                  <div className="text-3xl font-bold text-white">{aiPredict.forecast ? formatUSD(aiPredict.forecast) : "-"}</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Trend</span>
                    <span className={`font-semibold ${aiPredict.trend === "bullish" ? "text-emerald-300" : aiPredict.trend === "bearish" ? "text-red-300" : "text-slate-200"}`}>
                      {aiPredict.trend === "bullish" ? "Bullish" : aiPredict.trend === "bearish" ? "Bearish" : "Neutral"}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Confidence</span>
                      <span className="font-semibold text-cyan-300">{aiPredict.confidence ? `${aiPredict.confidence}%` : "--"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, aiPredict.confidence ?? 0)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400">Forecast basiert auf letzter Drift + 5% Bias via HF-Style Cache.</p>
                  </div>
                  <div className="text-xs text-slate-400">Updated: {aiPredict.refreshedAt ? new Date(aiPredict.refreshedAt).toLocaleTimeString() : "-"}</div>
                </div>
              </Card>

              <Card title="Backtest (Local JS)" icon={Gauge} tooltip="Rolling-Test: 3-Tick Delay Entry, Exit T+3, misst Winrate & RR.">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Trades</span>
                    <span className="font-semibold text-slate-100">{backtestStats.trades ?? "--"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Winrate</span>
                    <span className="font-semibold text-emerald-300">{backtestStats.winRate ? `${backtestStats.winRate.toFixed(1)}%` : "--"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Avg R/R</span>
                    <span className="font-semibold text-slate-100">{backtestStats.avgRr ? backtestStats.avgRr.toFixed(2) : "--"}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Validiert lokal gegen aktuelle OHLC-Serie, keine API-Last. Ziel: 90%+ Treffer bei klaren Trends.
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card title="Risk Score Summary" icon={Shield} tooltip="Aggregiert RSI/MACD/ADX in einem Ampel-Bar fuer schnelle Uebersicht.">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Score</span>
                    <span className="text-xl font-bold text-white">
                      {indicators.rsi && indicators.macd ? Math.min(95, Math.max(10, Math.round((indicators.rsi / 2 + (indicators.macd ?? 0) * 8) / 2))) : "--"}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-800">
                    <div
                      className="h-3 rounded-full bg-emerald-400"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            5,
                            indicators.rsi && indicators.macd ? Math.round((indicators.rsi / 2 + (indicators.macd ?? 0) * 8) / 2) : 20
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-slate-300">
                    Gruen = Momentum + Staerke. Rot = schwach/Seitwaerts. Nutzt RSI, MACD-Signal und ADX 20+ als Verstaerker.
                  </p>
                </div>
              </Card>

              <Card title="Quick Tips for Beginners" icon={AlertTriangle} tooltip="Short Guide fuer erste Trades.">
                <ul className="space-y-2 text-sm text-slate-200 list-disc list-inside">
                  <li>Starte mit BTC/ETH und 1h-Chart.</li>
                  <li>RSI &lt; 30? Beobachte Fib-Golden-Zone fuer moegliche Rebounds.</li>
                  <li>Setze SL 3% unter Entry, TP 4-6% - siehe TP/SL Rechner.</li>
                  <li>Beginner-Mode haelt nur Kernkarten aktiv; pro View fuer volle Tiefe.</li>
                </ul>
              </Card>
            </div>

            {/* === NEUE PRO-CARDS === */}
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
              <section
                className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[260px] flex flex-col justify-between"
                aria-label="Market Regime Detector"
                itemScope
                itemType="https://schema.org/FinancialProduct"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-300" aria-hidden />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50" itemProp="name">
                      {t("cardMarketRegime")}
                    </h3>
                  </div>
                  <span className={`rounded-full bg-slate-800/80 px-2 py-1 text-[11px] font-semibold min-w-[68px] text-center ${marketRegime.color}`} itemProp="additionalType">
                    {marketRegime.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-200 leading-snug min-h-[42px]" itemProp="description">
                  {t("marketRegimeDesc")}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-3xl font-black text-slate-50 whitespace-nowrap">
                    {(marketRegime.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-[11px] text-slate-300 leading-tight min-h-[32px] max-w-[180px]">
                    {marketRegime.detail}
                  </div>
                </div>
              </section>

              <section
                className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[260px] flex flex-col justify-between"
                aria-label="Smart Money Flow"
                itemScope
                itemType="https://schema.org/FinancialProduct"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-300" aria-hidden />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50" itemProp="name">
                      {t("cardSmartMoney")}
                    </h3>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold min-w-[80px] text-center ${smartMoney.net >= 0 ? "bg-emerald-500/15 text-emerald-100" : "bg-red-500/15 text-red-100"}`}>
                    {smartMoney.pct >= 0 ? "+" : ""}
                    {smartMoney.pct}% Netflow
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-200 leading-snug min-h-[40px]" itemProp="description">
                  {smartMoney.title}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-100 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 min-h-[78px]">
                    <p className="text-xs text-slate-400">{t("smartNet")}</p>
                    <p className="font-semibold text-slate-50">{smartMoney.direction}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 min-h-[78px]">
                    <p className="text-xs text-slate-400">{t("smartTrades")}</p>
                    <p className="font-semibold">{smartMoney.count}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 min-h-[78px]">
                    <p className="text-xs text-slate-400">{t("smartBuys")}</p>
                    <p className="font-semibold text-emerald-200">{formatUSD(smartMoney.buys)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 min-h-[78px]">
                    <p className="text-xs text-slate-400">{t("smartSells")}</p>
                    <p className="font-semibold text-red-200">{formatUSD(smartMoney.sells)}</p>
                  </div>
                </div>
              </section>

              <section
                className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[260px] flex flex-col justify-between"
                aria-label="Liquidity Heatmap"
                itemScope
                itemType="https://schema.org/FinancialProduct"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-300" aria-hidden />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50" itemProp="name">
                      {t("cardLiquidity")}
                    </h3>
                  </div>
                  <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-100 min-w-[96px] text-center">
                    {liquidity.dominance}% Bid Dominance
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-200 leading-snug min-h-[40px]" itemProp="description">
                  {t("liquidityDesc")}
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-100">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">{t("liquidityBid")}</p>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Number(liquidity.dominance))}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">{t("liquidityAsk")}</p>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-red-500" style={{ width: `${Math.min(100, 100 - Number(liquidity.dominance))}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`${liquidity.tone} font-semibold`}>{t("liquidityImb")}: {liquidity.imbalance}%</span>
                    <span className="text-slate-400">{t("liquidityHint")}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* === ANALYTICS ROW === */}
            {!isBeginner ? (
              <div className="mt-4 grid grid-cols-1 gap-6 card-bg-animate">
                <Paywall
                  minTier="pro"
                  userTier={effectiveTier}
                  isTrialActive={trialActive}
                  trialEndText={
                    trialActive
                      ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                      : trialExpired
                      ? "Test abgelaufen. Bitte upgraden."
                      : t("proRequired")
                  }
                  lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
                >
                <section
                  className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[280px] flex flex-col justify-between gap-4 overflow-hidden"
                  aria-label="On-Chain Metrics"
                  itemScope
                  itemType="https://schema.org/Dataset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-cyan-400" aria-hidden />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">On-Chain Metrics</h3>
                    </div>
                    <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                      {formatClock(onChainMetrics.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{t("onchainDesc")}</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-3xl font-black text-emerald-400 whitespace-nowrap">
                      {onChainMetrics.active ? onChainMetrics.active.toLocaleString("en-US") : "�"}
                    </div>
                    <div className="text-xs text-slate-300 leading-tight min-w-[120px] max-w-[140px] space-y-1 break-words">
                      <div className="flex items-center justify-between gap-2">
                        <span>Whales</span>
                        <span className="font-semibold text-slate-100">{(onChainMetrics.supplyWhales ?? 0.6 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Retail</span>
                        <span className="font-semibold text-slate-100">{(onChainMetrics.supplyRetail ?? 0.4 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Delta</span>
                        <span className="font-semibold text-slate-100">
                          {onChainMetrics.supplyWhales && onChainMetrics.supplyRetail
                            ? ((onChainMetrics.supplyWhales - onChainMetrics.supplyRetail) * 100).toFixed(1) + "%"
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Whale Share</p>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-2 bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, (onChainMetrics.supplyWhales ?? 0.6) * 100))}%` }} />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 mb-1">Retail Share</p>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-2 bg-red-500" style={{ width: `${Math.min(100, Math.max(0, (onChainMetrics.supplyRetail ?? 0.4) * 100))}%` }} />
                      </div>
                    </div>
                  </div>
                </section>
              </Paywall>

                <Paywall
                  minTier="pro"
                  userTier={effectiveTier}
                  isTrialActive={trialActive}
                  trialEndText={
                    trialActive
                      ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                      : trialExpired
                      ? "Test abgelaufen. Bitte upgraden."
                      : t("proRequired")
                  }
                  lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
                >
                <section
                  className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[280px] flex flex-col justify-between overflow-hidden"
                  aria-label="Sentiment Analysis"
                  itemScope
                  itemType="https://schema.org/Dataset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Signal className="h-5 w-5 text-cyan-400" aria-hidden />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">Sentiment Analysis</h3>
                    </div>
                    <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                      {formatClock(sentimentMetrics.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{t("sentimentDesc")}</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative h-16 w-16 flex-shrink-0">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
                      <div className="absolute inset-0 rounded-full border-4 border-cyan-400 opacity-80" style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }} />
                      <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-emerald-400">
                        {sentimentMetrics.score ?? "--"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 text-left leading-tight break-words max-w-[180px] space-y-1">
                      <p>Label: {sentimentMetrics.label}</p>
                      <p>Trend: {sentimentMetrics.score !== null ? (sentimentMetrics.score > 60 ? "Positiv" : "Neutral") : "-"}</p>
                      <p>Tweets: {sentimentMetrics.tweets ?? "�"}</p>
                    </div>
                  </div>
                </section>
              </Paywall>

                <Paywall
                  minTier="pro"
                  userTier={effectiveTier}
                  isTrialActive={trialActive}
                  trialEndText={
                    trialActive
                      ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                      : trialExpired
                      ? "Test abgelaufen. Bitte upgraden."
                      : t("proRequired")
                  }
                  lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
                >
                <section
                  className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[280px] flex flex-col gap-3 overflow-hidden"
                  aria-label="Correlation Heatmap"
                  itemScope
                  itemType="https://schema.org/Dataset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-cyan-400" aria-hidden />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">Correlation Heatmap</h3>
                    </div>
                    <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                      {formatClock(fearGreed?.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{t("correlationDesc")}</p>
                  <div className="grid grid-cols-1 gap-2 text-xs text-slate-100 sm:grid-cols-2">
                    {correlations.slice(0, 8).map((c) => {
                      const val = c.value ?? 0;
                      const pct = Math.round(val * 100);
                      const color = val >= 0.6 ? "bg-emerald-500/60" : val >= 0.3 ? "bg-amber-500/60" : val >= 0 ? "bg-slate-700" : "bg-red-500/60";
                      return (
                        <div key={c.pair} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-50 truncate max-w-[88px] break-words">{c.pair}</span>
                            <span className="text-slate-200 whitespace-nowrap">{pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-1.5 ${color}`} style={{ width: `${Math.min(100, Math.max(0, Math.abs(pct)))}%` }} />
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                            <span>Positiv</span>
                            <span className="text-slate-200">{pct >= 0 ? "Ja" : "Nein"}</span>
                          </div>
                          <div className="text-[10px] text-slate-300 mt-1">Std: {val !== null ? Math.abs(val).toFixed(2) : "--"}</div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </Paywall>

                <Paywall
                  minTier="pro"
                  userTier={effectiveTier}
                  isTrialActive={trialActive}
                  trialEndText={
                    trialActive
                      ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                      : trialExpired
                      ? "Test abgelaufen. Bitte upgraden."
                      : t("proRequired")
                  }
                  lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
                >
                <section
                  className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 min-h-[280px] flex flex-col gap-3 overflow-hidden"
                  aria-label="Funding Rates"
                  itemScope
                  itemType="https://schema.org/Dataset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-cyan-400" aria-hidden />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">Funding Rates</h3>
                    </div>
                    <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                      {formatClock(priceState.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{t("fundingDesc")}</p>
                  <div className="space-y-3 text-xs text-slate-100">
                    {fundingRates.slice(0, 3).map((f) => {
                      const pct = f.rate ? f.rate * 100 : 0;
                      const bullish = pct >= 0;
                      return (
                        <div key={f.symbol} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-50">{f.symbol}</span>
                            <span className={bullish ? "text-emerald-300" : "text-red-300"}>{pct.toFixed(4)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-1.5 ${bullish ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.abs(pct) * 800)}%` }} />
                          </div>
                          <div className="mt-1 text-[11px] text-slate-300">
                            {bullish ? "Longs zahlen Shorts" : "Shorts zahlen Longs"}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400 flex justify-between">
                            <span>Mark</span>
                            <span className="text-slate-200">{f.mark ? formatUSD(f.mark) : "--"}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300 flex justify-between">
                      <span>Avg Rate</span>
                      <span className="font-semibold text-slate-100">
                        {fundingRates.length
                          ? (fundingRates.reduce((a, b) => a + (b.rate || 0), 0) / fundingRates.length * 100).toFixed(4) + "%"
                          : "--"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300 flex justify-between">
                      <span>Hourly est.</span>
                      <span className="font-semibold text-slate-100">
                        {fundingRates.length
                          ? (fundingRates.reduce((a, b) => a + (b.rate || 0), 0) / fundingRates.length * 24 * 100).toFixed(4) + "%"
                          : "--"}
                      </span>
                    </div>
                  </div>
                </section>
              </Paywall>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <Card title={t("signals")} icon={Signal}>
              <div className="flex flex-wrap gap-2">
                {signalBadges.map((s) => (
                  <IndicatorBadge key={s.label} label={s.label} value={s.value} intent={s.intent} />
                ))}
              </div>
              <div className="mt-3 rounded-xl bg-slate-800/60 p-3 text-sm text-slate-300">
                <div className="flex items-center gap-2 text-emerald-300">
                  <AlertTriangle className="h-4 w-4" />
                  {t("signalsLive")}
                </div>
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  <li>{t("signalsOversold")}</li>
                  <li>{t("signalsOverbought")}</li>
                  <li>{t("signalsFallback")}</li>
                </ul>
              </div>
            </Card>

            <Card title={t("systemStatus")} icon={Shield}>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{t("systemWs")}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${wsStatus === "live" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                    {wsStatus} (Retries {wsAttempts}/5)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("systemCache")}</span>
                  <span className="text-slate-100">5 Minuten</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("systemPoll")}</span>
                  <span className="text-slate-100">30s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t("systemError")}</span>
                  <span className="text-xs text-slate-400">{lastError || t("systemNone")}</span>
                </div>
                <div className="pt-2 space-y-1 text-xs">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Data Sources</p>
                  {dataSourceStatuses.map((item) => (
                    <div key={item.key} className="flex items-center justify-between" title={item.message || ""}>
                      <span className="text-slate-400">{item.label}</span>
                      <span className={`font-semibold ${healthColor(item.status)}`}>{formatHealthLabel(item.status)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 space-y-1 text-xs">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Service Modules</p>
                  {runtimeHealthEntries
                    .filter(([, val]) => val && typeof val === "object" && "status" in val)
                    .map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between" title={val?.message || ""}>
                        <span className="uppercase text-slate-400">{key}</span>
                        <span className={`font-semibold ${healthColor(val.status)}`}>{formatHealthLabel(val.status)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </Card>

            <Card title={t("manualControls")} icon={PlugZap}>
              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <button onClick={loadPrice} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                  <span>{t("manualPrice")}</span>
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button onClick={loadOHLC} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                  <span>{t("manualKraken")}</span>
                  <Activity className="h-4 w-4" />
                </button>
                <button onClick={loadFearGreed} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                  <span>{t("manualFG")}</span>
                  <Gauge className="h-4 w-4" />
                </button>
              </div>
            </Card>

            {SHOW_CRYPTO_EDU_CHAT ? (
              effectiveTier === "elite" ? (
                <CryptoEduChatCard platformContext={chatContext} />
              ) : (
                <LockedCard
                  title="Vision AI Assistant"
                  requiredTier="elite"
                  description="Nur fuer Elite-Mitglieder. Der Vision AI Assistant analysiert Ihre Plattform-Daten in Echtzeit."
                />
              )
            ) : null}

            <Card title={t("tpSlTitle")} icon={Bell}>
              <div className="space-y-3 text-sm text-slate-200">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    {t("tpEntryLabel")}
                    <input
                      type="number"
                      value={tpForm.entry ?? ""}
                      onChange={(e) => setTpForm((p) => ({ ...p, entry: e.target.value ? Number(e.target.value) : null }))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                      placeholder="62000"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    {t("tpQtyLabel")}
                    <input
                      type="number"
                      value={tpForm.quantity}
                      min="0"
                      step="0.0001"
                      onChange={(e) => setTpForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                      placeholder="1.0"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    {t("tpTpLabel")}
                    <input
                      type="number"
                      value={tpForm.tpPct}
                      onChange={(e) => setTpForm((p) => ({ ...p, tpPct: Number(e.target.value) || 0 }))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                      placeholder="4"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-400">
                    {t("tpSlLabel")}
                    <input
                      type="number"
                      value={tpForm.slPct}
                      onChange={(e) => setTpForm((p) => ({ ...p, slPct: Number(e.target.value) || 0 }))}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                      placeholder="3"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={suggestRisk} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400">
                    AI Vorschlag
                    <Shield className="h-4 w-4" />
                  </button>
                  {aiNote ? <span className="text-xs text-emerald-300">{aiNote}</span> : null}
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                  <div className="flex justify-between">
                    <span>{t("tpPrice")}</span>
                    <span className="font-semibold">{takeProfitPrice ? formatUSD(takeProfitPrice) : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("slPrice")}</span>
                    <span className="font-semibold">{stopLossPrice ? formatUSD(stopLossPrice) : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("profitAtTp")}</span>
                    <span className="font-semibold text-emerald-300">{profit !== null ? formatUSD(profit) : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("lossAtSl")}</span>
                    <span className="font-semibold text-red-300">{loss !== null ? formatUSD(-loss) : "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("rrLabel")}</span>
                    <span className="font-semibold">{rr !== null ? rr.toFixed(2) : "-"}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Paywall minTier="elite" userTier={effectiveTier} lockText={t("eliteRequired")}>
              <Card title={t("aiSignalTitle")} icon={Signal}>
                <div className="space-y-3 text-sm text-slate-200">
                  {/* Main Action Badge - Large and Prominent */}
                  <div className="flex items-center justify-center">
                    <span className={`rounded-xl px-4 py-2 text-lg font-bold ${
                      aiSignal.action === "Kaufen" || aiSignal.action === "Buy" 
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" 
                        : aiSignal.action === "Verkaufen" || aiSignal.action === "Sell"
                        ? "bg-red-500/20 text-red-300 border border-red-500/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {aiSignal.action === "Kaufen" ? "?? LONG" : aiSignal.action === "Verkaufen" ? "?? SHORT" : "? WARTEN"}
                    </span>
                  </div>
                  
                  {/* Confidence Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Konfidenz</span>
                      <span className={`font-bold ${aiSignal.confidence >= 0.65 ? "text-emerald-300" : aiSignal.confidence >= 0.55 ? "text-amber-300" : "text-slate-400"}`}>
                        {(aiSignal.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          aiSignal.confidence >= 0.65 ? "bg-emerald-500" : aiSignal.confidence >= 0.55 ? "bg-amber-500" : "bg-slate-600"
                        }`}
                        style={{ width: `${Math.min(100, aiSignal.confidence * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* TP/SL Box - Prominent */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-emerald-400 mb-1">Take Profit</div>
                      <div className="text-lg font-bold text-emerald-300">{aiSignal.tp ? formatUSD(aiSignal.tp) : "-"}</div>
                      {aiSignal.tp && displayPrice && (
                        <div className="text-[10px] text-emerald-400/70">
                          +{(((aiSignal.tp - displayPrice) / displayPrice) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                      <div className="text-[10px] uppercase tracking-wide text-red-400 mb-1">Stop Loss</div>
                      <div className="text-lg font-bold text-red-300">{aiSignal.sl ? formatUSD(aiSignal.sl) : "-"}</div>
                      {aiSignal.sl && displayPrice && (
                        <div className="text-[10px] text-red-400/70">
                          -{(((displayPrice - aiSignal.sl) / displayPrice) * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* R/R Ratio */}
                  {aiSignal.tp && aiSignal.sl && displayPrice && (
                    <div className="flex justify-between items-center text-xs bg-slate-800/50 rounded-lg px-3 py-2">
                      <span className="text-slate-400">Risk/Reward</span>
                      <span className="font-bold text-cyan-300">
                        1:{((aiSignal.tp - displayPrice) / (displayPrice - aiSignal.sl)).toFixed(1)}
                      </span>
                    </div>
                  )}
                  
                  <div className="text-[10px] text-slate-500">{aiSignal.reason}</div>
                  <p className="text-[10px] text-amber-300/80">{t("aiHint")}</p>
                </div>
              </Card>
            </Paywall>

            <Paywall
              minTier="pro"
              userTier={effectiveTier}
              isTrialActive={trialActive}
              trialEndText={
                trialActive
                  ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                  : trialExpired
                  ? "Test abgelaufen. Bitte upgraden."
                  : t("proRequired")
              }
              lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
            >
              <Card title={t("proSignalsTitle")} icon={TrendingUp}>
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Aktion</span>
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${proSignal.action === "long" ? "bg-emerald-500/10 text-emerald-200" : proSignal.action === "short" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"}`}>
                      {proSignal.action}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t("setupType")}</span>
                    <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100">{proSignal.setupLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t("regime")}</span>
                    <span className={`rounded px-2 py-1 text-[11px] font-semibold ${proSignal.regimeIntent === "ok" ? "bg-emerald-500/10 text-emerald-200" : proSignal.regimeIntent === "warn" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"}`}>
                      {proSignal.regimeLabel}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Reason: <span className="text-slate-200">{proSignal.reason}</span></div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Confidence</span>
                    <span className="font-semibold text-emerald-300">{(proSignal.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>TP</span>
                      <span className="font-semibold">{proSignal.tp ? formatUSD(proSignal.tp) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SL</span>
                      <span className="font-semibold">{proSignal.sl ? formatUSD(proSignal.sl) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("rrLabel")}</span>
                      <span className="font-semibold">{proSignal.tp && proSignal.sl && lastClose ? ((proSignal.action === "long" ? proSignal.tp - lastClose : lastClose - proSignal.tp) / (proSignal.action === "long" ? lastClose - proSignal.sl : proSignal.sl - lastClose || 1)).toFixed(2) : "-"}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                      <span>ATR%: {proSignal.meta?.atrPct ? proSignal.meta.atrPct.toFixed(2) : "-"}</span>
                      <span>MACD ?: {proSignal.meta?.macdDiff ? proSignal.meta.macdDiff.toFixed(2) : "-"}</span>
                      <span>VWAP: {proSignal.meta?.vwap ? formatUSD(proSignal.meta.vwap) : "-"}</span>
                      <span>Vol Spike: {proSignal.meta?.volSpike ? "Ja" : "Nein"}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-[11px] text-slate-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t("checks")}:</span>
                      <span className="text-slate-300">{(proSignal.score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.trend === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.trend === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkTrend")}</span>
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.momentum === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.momentum === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkMomentum")}</span>
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.flow === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.flow === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkFlow")}</span>
                      <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.vol === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>{t("checkVol")}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Paywall>
            {effectiveTier === "basic" ? (
              <LockedCard
                title={t("backtestTitle")}
                requiredTier="pro"
                description="Schalte Pro frei, um historische Trefferquote und Risiko-Kennzahlen zu sehen."
              />
            ) : (
              <Card title={t("backtestTitle")} icon={TrendingUp}>
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>{t("backtestTrades")}</span>
                    <span className="font-semibold">{backtestStats.trades}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("backtestWinRate")}</span>
                    <span className="font-semibold text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis">
                      {backtestStats.winRate !== null ? `${backtestStats.winRate.toFixed(0)}%` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("backtestWinsLosses")}</span>
                    <span className="font-semibold whitespace-nowrap">
                      {backtestStats.wins} / {backtestStats.losses}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{t("backtestAvgRR")}</span>
                    <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                      {backtestStats.avgRR !== null ? backtestStats.avgRR.toFixed(2) : "-"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{t("backtestNote")}</p>
                </div>
              </Card>
            )}
            <Paywall
              minTier="pro"
              userTier={effectiveTier}
              isTrialActive={trialActive}
              trialEndText={
                trialActive
                  ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                  : trialExpired
                  ? "Test abgelaufen. Bitte upgraden."
                  : t("proRequired")
              }
              lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
            >
              <Card
                title={t("apiPlaybook")}
                icon={PlugZap}
                actions={
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Limits � Snippets</span>
                    <button
                      onClick={loadApiPlaybook}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500/60"
                    >
                      {t("liveCheck")}
                    </button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {API_SOURCES.map((api) => {
                    const status = apiStatuses[api.name]?.state || "idle";
                    const note = apiStatuses[api.name]?.note || "";
                    const dataPoint = apiStatuses[api.name]?.data || "";
                    const tone =
                      status === "ok"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : status === "auth"
                        ? "bg-amber-500/15 text-amber-200"
                        : status === "fail"
                        ? "bg-red-500/15 text-red-200"
                        : "bg-slate-800 text-slate-200";
                    const label =
                      status === "ok" ? t("liveLabel") : status === "auth" ? t("keyNeeded") : status === "fail" ? t("errorLabel") : "�";
                    return (
                      <div key={api.name} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-100">{api.name}</span>
                            <span className="text-[11px] text-slate-400">{api.limit}</span>
                          </div>
                          {!(api.name === "HuggingFace" && status === "auth") ? (
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-2 py-[3px] text-[10px] font-semibold whitespace-nowrap max-w-[72px] overflow-hidden text-ellipsis text-center ${tone}`}
                              title={label}
                            >
                              {label}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-300 leading-snug">{api.desc}</p>
                        {status === "fail" ? (
                          <div className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-red-400">{note || t("unavailable")}</div>
                        ) : status === "auth" ? (
                          <div className="rounded-md bg-slate-800 px-2 py-1 text-[11px] text-amber-300">{note || t("apiKeyNeeded")}</div>
                        ) : (
                          <div className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-2 text-sm text-slate-200">
                            <div className="text-[11px] uppercase tracking-wide text-slate-500">{t("liveData")}</div>
                            <div className="text-sm text-slate-200 break-words">{note || t("reachable")}</div>
                            {dataPoint ? <div className="text-xs text-slate-400 break-words">{dataPoint}</div> : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Paywall>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t("rsiChart")} icon={LineChartIcon}>
              <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                {indicatorSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={indicatorSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} minTickGap={20} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} tickCount={5} padding={{ top: 8, bottom: 8 }} tickFormatter={(v) => Number.isFinite(v) ? v.toFixed(0) : ""} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                    <Line
                      type="monotone"
                      dataKey="rsi"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={renderLastDot(indicatorSeries.length, "#22c55e")}
                      name="RSI"
                      isAnimationActive
                      animationDuration={550}
                      animationEasing="ease-out"
                    />
                    <Line type="monotone" dataKey={() => 70} stroke="#f59e0b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey={() => 30} stroke="#f59e0b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="stochK" stroke="#38bdf8" strokeWidth={1} strokeOpacity={0.7} dot={false} name="%K" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="stochD" stroke="#a855f7" strokeWidth={1} strokeOpacity={0.7} dot={false} name="%D" isAnimationActive animationDuration={500} animationEasing="ease-out" />
                  </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                <p className="text-sm text-slate-400">{t("loadingRSI")}</p>
                )}
              </div>
            </Card>

          <Card title={t("macdChart")} icon={TrendingUp}>
            <div className="w-full min-w-0" style={{ minHeight: 200 }}>
              {indicatorSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={indicatorSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={60} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ color: "#cbd5e1" }} />
                    <Line type="monotone" dataKey="macd" stroke="#22c55e" dot={false} name="MACD" isAnimationActive animationDuration={550} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="macdSignal" stroke="#f59e0b" dot={false} name="Signal" isAnimationActive animationDuration={550} animationEasing="ease-out" />
                    <Bar dataKey="macdHist" fill="#60a5fa" barSize={8} name="Histogram" isAnimationActive animationDuration={520} animationEasing="ease-out" />
                  </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                <p className="text-sm text-slate-400">{t("loadingMACD")}</p>
                )}
              </div>
            </Card>

          <Card title={t("flowsCard")} icon={Activity}>
            <div className="w-full min-w-0" style={{ minHeight: 200 }}>
              {volumeBuckets.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={volumeBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={70} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} formatter={(v, n) => [formatUSD(v), n]} />
                    <Legend verticalAlign="top" height={24} wrapperStyle={{ color: "#cbd5e1" }} />
                    <Bar dataKey="buy" stackId="vol" fill="#22c55e" barSize={10} name="Buy Vol" isAnimationActive animationDuration={520} animationEasing="ease-out" />
                    <Bar dataKey="sell" stackId="vol" fill="#ef4444" barSize={10} name="Sell Vol" isAnimationActive animationDuration={520} animationEasing="ease-out" />
                    <Line type="monotone" dataKey="net" stroke="#38bdf8" dot={renderLastDot(volumeBuckets.length, "#38bdf8")} name="Net" isAnimationActive animationDuration={520} animationEasing="ease-out" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400">{t("loadingFlows")}</p>
              )}
            </div>
            <div className="mt-3 max-h-28 overflow-y-auto overscroll-contain touch-pan-y rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs text-slate-200">
              {trades.length > 0 ? (
                trades.map((trade, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b border-slate-800/60 py-1 last:border-b-0">
                    <span className={`font-semibold ${trade.side === "buy" ? "text-emerald-300" : "text-red-300"}`}>
                      {trade.side === "buy" ? t("buyLabel") : t("sellLabel")}
                    </span>
                    <span>{formatUSD(trade.usd)}</span>
                    <span className="text-slate-400">{new Date(trade.ts).toLocaleTimeString()}</span>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">{t("waitingTrades")}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card title={t("dataIntegrityTitle")} icon={Shield}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-800/50 p-3">
                <p className="text-sm font-semibold text-slate-100">{t("diFallback")}</p>
                <p className="text-xs text-slate-400">{t("dataIntegrity1")}</p>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3">
                <p className="text-sm font-semibold text-slate-100">{t("diResilience")}</p>
                <p className="text-xs text-slate-400">{t("dataIntegrity2")}</p>
              </div>
              <div className="rounded-xl bg-slate-800/50 p-3">
                <p className="text-sm font-semibold text-slate-100">{t("diIndicators")}</p>
                <p className="text-xs text-slate-400">{t("dataIntegrity3")}</p>
              </div>
            </div>
          </Card>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title={t("trendStoch")} icon={TrendingUp}>
            <div className="h-40 flex flex-col justify-center">
              {indicatorSeries.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>%K</span>
                    <span className="font-semibold text-emerald-300">
                      {indicatorSeries.at(-1)?.stochPriceK ? indicatorSeries.at(-1).stochPriceK.toFixed(1) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>%D</span>
                    <span className="font-semibold text-slate-100">
                      {indicatorSeries.at(-1)?.stochPriceD ? indicatorSeries.at(-1).stochPriceD.toFixed(1) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Status</span>
                    <span className="font-semibold">
                      {indicatorSeries.at(-1)?.stochPriceK && indicatorSeries.at(-1)?.stochPriceD
                        ? indicatorSeries.at(-1).stochPriceK > indicatorSeries.at(-1).stochPriceD
                          ? "Bull Cross"
                          : "Bear Cross"
                        : "-"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t("loadingStoch")}</p>
              )}
            </div>
          </Card>
          <Card title={t("cciCard")} icon={TrendingUp}>
            <div className="h-40 flex flex-col justify-center">
              {indicatorSeries.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>CCI</span>
                    <span className={`font-semibold ${Number(indicatorSeries.at(-1)?.cci) > 100 ? "text-emerald-300" : Number(indicatorSeries.at(-1)?.cci) < -100 ? "text-red-300" : "text-slate-100"}`}>
                      {indicatorSeries.at(-1)?.cci ? indicatorSeries.at(-1).cci.toFixed(1) : "-"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">+100 Ueberkauft - -100 Ueberverkauft</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t("loadingCCI")}</p>
              )}
            </div>
          </Card>
          <Card title={t("volatilityCard")} icon={TrendingUp}>
            <div className="h-40 flex flex-col justify-center">
              {indicatorSeries.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex items-center justify-between">
                    <span>ATR%</span>
                    <span className="font-semibold text-emerald-300">
                      {indicatorSeries.at(-1)?.atrPct ? indicatorSeries.at(-1).atrPct.toFixed(2) : "-"}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Hoeher = mehr Volatilitaet - breitere SL/TP</p>
                </div>
              ) : (
                <p className="text-sm text-slate-400">{t("loadingATR")}</p>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-4">
          <Card title={t("diary")} icon={TrendingUp} actions={<span className="text-xs text-slate-400">Memory � Notes</span>}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 text-sm text-slate-200">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Datum
                  <input
                    type="date"
                    value={journalForm.date}
                    onChange={(e) => setJournalForm((p) => ({ ...p, date: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Stimmung
                  <select
                    value={journalForm.mood}
                    onChange={(e) => setJournalForm((p) => ({ ...p, mood: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                  >
                    <option>Fearful</option>
                    <option>Neutral</option>
                    <option>Confident</option>
                  </select>
                </label>
              </div>
              <div className="md:col-span-2 space-y-2 text-sm text-slate-200">
                <label className="flex flex-col gap-1 text-xs text-slate-400">
                  Notiz
                  <textarea
                    value={journalForm.note}
                    onChange={(e) => setJournalForm((p) => ({ ...p, note: e.target.value }))}
                    rows={3}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                    placeholder="Setup, Emotion, Plan..."
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addJournalEntry}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
                  >
                    Speichern
                  </button>
                  <span className="text-xs text-slate-400">Autosave (local) - max 50 Eintraege</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {journalEntries.length > 0 ? (
                journalEntries.slice(0, 6).map((e) => (
                  <div key={e.ts} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{e.date}</span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          e.mood === "Confident"
                            ? "bg-emerald-500/10 text-emerald-200"
                            : e.mood === "Fearful"
                            ? "bg-red-500/10 text-red-200"
                            : "bg-slate-800 text-slate-200"
                        }`}
                      >
                        {e.mood}
                      </span>
                    </div>
                    <p className="text-slate-300">{e.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Noch keine Eintraege.</p>
              )}
            </div>
          </Card>
        </div>
        <div className="mt-4">
              <Card title="ETF Zufluesse" icon={TrendingUp}>
                <div className="space-y-3">
                  <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF Holdings...</div>}>
                    <EtfHoldingsCard
                      holdings={etfHoldings}
                      loading={etfHoldingsLoading}
                      error={etfHoldingsError}
                      lastUpdated={etfHoldingsLastUpdated}
                    />
                  </Suspense>
                  <div className="flex flex-wrap items-center gap-2">
                    {ETF_SYMBOLS.map((sym, idx) => {
                      const active = etfSelection.includes(sym);
                      return (
                    <button
                      key={sym}
                      onClick={() =>
                        setEtfSelection((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym].slice(0, ETF_SYMBOLS.length)))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                        active ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-200"
                      }`}
                      style={{ borderColor: active ? etfColors[idx % etfColors.length] : undefined }}
                    >
                      {sym}
                    </button>
                  );
                })}
                {etfAumLoading ? <span className="text-xs text-slate-400">Lade...</span> : null}
                {etfAumError ? <span className="text-xs text-amber-300">{etfAumError}</span> : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>Last updated: {etfLastUpdated ? new Date(etfLastUpdated).toLocaleTimeString() : "-"}</span>
              </div>
              <LazyRender
                placeholder={
                  <div className="h-64 flex items-center justify-center">
                    <Skeleton className="h-56 w-full" />
                  </div>
                }
              >
                {etfFlowSeries.length > 0 ? (
                  <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={buildEtfChartData(etfFlowSeries)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }}
                          labelStyle={{ color: "#e2e8f0" }}
                          formatter={(val, name) => [`${Number(val) >= 0 ? "+" : ""}${Number(val).toLocaleString()}`, name]}
                        />
                        {etfFlowSeries.map((s, idx) => (
                          <Bar
                            key={s.symbol}
                            dataKey={s.symbol}
                            name={s.symbol}
                            fill={etfColors[idx % etfColors.length]}
                            radius={[4, 4, 0, 0]}
                            isAnimationActive
                            opacity={0.9}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{etfAumError || "Daten derzeit nicht verfuegbar"}</p>
                )}
              </LazyRender>
              <div className="grid grid-cols-1 gap-2 text-sm text-slate-200 md:grid-cols-2">
                {etfFlowSeries.map((s, idx) => (
                  <div key={s.symbol} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold" style={{ color: etfColors[idx % etfColors.length] }}>
                        {s.symbol}
                      </span>
                      <span className="text-xs text-slate-400">{s.provider}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>7d</span>
                      <span className={`font-semibold ${s.sum7dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum7dUsd)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>30d</span>
                      <span className={`font-semibold ${s.sum30dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum30dUsd)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Updated {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString() : "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Suspense fallback={<div className="text-xs text-slate-400">Laedt Provider-Metriken...</div>}>
            <EtfProviderQualityCard />
          </Suspense>
          <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF-Korrelationen...</div>}>
            <EtfCorrelationCard onHealthUpdate={updateApiHealth} />
          </Suspense>
          <Card title={t("etfCard")} icon={TrendingUp}>
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("netFlowsLabel")}</p>
                {etfFlows.length > 0 ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {etfFlows.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="rounded-lg border border-slate-800/70 bg-slate-900/60 p-3">
                        <p className="text-sm font-semibold text-slate-100 line-clamp-1">{f.name}</p>
                        <p className="text-[11px] text-slate-400">{f.date ? new Date(f.date).toLocaleDateString() : "�"}</p>
                        <p className={`text-sm font-semibold ${f.inflow >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(f.inflow)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{t("noETFLinks")}</p>
                )}
                {etfFlowsError ? <p className="mt-1 text-xs text-amber-300">{etfFlowsError}</p> : null}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("newsLabel")}</p>
                {etfLoading && etfNews.length === 0 ? <p className="text-sm text-slate-400">{t("loadingETFNews")}</p> : null}
                {etfNews.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {etfNews.map((item, idx) => {
                      const ts = item.publishedAt ? new Date(Number(item.publishedAt) || item.publishedAt) : null;
                      return (
                        <a
                          key={`${item.url}-${idx}`}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 transition hover:border-emerald-600/60 hover:bg-slate-800/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-100 line-clamp-2">{item.title}</p>
                              <p className="text-[11px] text-slate-400">
                                {item.source || "News"} {ts ? `� ${ts.toLocaleDateString([], { day: "2-digit", month: "short" })} ${ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">View</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : null}
                {!etfLoading && etfNews.length === 0 ? <p className="text-sm text-slate-400">{t("noETFNews")}</p> : null}
                {etfError ? <p className="mt-2 text-xs text-amber-300">{etfError}</p> : null}
              </div>
            </div>
          </Card>
        </div>
      </div>
      </div>
      <div className="md:hidden w-full px-3 py-6 space-y-5">
        <header className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Vision AI Mind</p>
            <h1 className="text-2xl font-bold text-slate-50">Crypto Risk Manager</h1>
            <p className="text-sm text-slate-400">{t("heroSubtitle")}</p>
            {/* Mobile Navigation Links */}
            <nav className="flex items-center gap-3 mt-2">
              <a href="/coins" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                Coins
              </a>
              <a href="/signals" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                Signals
              </a>
            </nav>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedMarket.id}
              onChange={(e) => {
                const next = e.target.value || DEFAULT_MARKET_ID;
                setSelectedAssetId(next);
                setLivePrice(null);
              }}
              className="flex-1 min-w-[120px] rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              {Object.entries(groupedMarkets).map(([cls, entries]) => (
                <optgroup key={cls} label={ASSET_CLASS_LABELS[cls] || cls}>
                  {entries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={timeFrame}
              onChange={(e) => setTimeFrame(e.target.value)}
              className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              <option value="15">15m</option>
              <option value="60">1h</option>
              <option value="240">4h</option>
              <option value="1440">1d</option>
            </select>
            <button
              onClick={() => setLang((p) => (p === "de" ? "en" : "de"))}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
            >
              {t("langToggle")}
            </button>
            <button
              onClick={refreshAll}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {t("refresh")}
            </button>
          </div>
        </header>

        <div
          ref={mobileAuthRef}
          className={highlightAuthCard ? "rounded-2xl ring-2 ring-amber-400/60" : "rounded-2xl"}
        >
          <Card
            title="Login & Tier"
            icon={Shield}
            actions={
              <div className="flex flex-col items-end text-right">
                <span className="text-[11px] text-slate-400">{tierLabels[effectiveTier] || tierLabels.basic}</span>
                {trialBadgeText ? (
                  <span className="mt-1 inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                    {trialBadgeText}
                  </span>
                ) : trialExpired && trialStart ? (
                  <span className="mt-1 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                    {lang === "de" ? "Trial abgelaufen" : "Trial expired"}
                  </span>
                ) : null}
              </div>
            }
          >
          <div className="space-y-3 text-sm text-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <button onClick={() => persistTier("basic")} className="rounded bg-slate-800 px-3 py-1 text-[11px] hover:bg-slate-700">
                  {t("tierBasic")}
                </button>
                <button onClick={() => persistTier("pro")} className="rounded bg-emerald-600/80 px-3 py-1 text-[11px] text-emerald-950 hover:bg-emerald-500">
                  {t("tierPro")}
                </button>
                <button onClick={() => persistTier("elite")} className="rounded bg-cyan-500/80 px-3 py-1 text-[11px] text-cyan-950 hover:bg-cyan-400">
                  {t("tierElite")}
                </button>
              </div>
              <button
                onClick={() => openStripe(STRIPE_LINKS.customer_portal)}
                className="rounded bg-slate-800 px-3 py-1 text-[11px] hover:bg-slate-700"
              >
                {t("billing")}
              </button>
            </div>
            <form onSubmit={handleSignin} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  ref={mobileEmailRef}
                  value={authForm.email}
                  onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t("loginEmail")}
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                />
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={t("loginPassword")}
                  className="w-32 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
                  {t("signin")}
                </button>
                <button type="button" onClick={handleSignup} className="rounded bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
                  {t("signup")}
                </button>
                <button type="button" onClick={handleLogout} className="rounded bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
                  {t("logout")}
                </button>
                <button
                  type="button"
                  onClick={handleStartTrial}
                  disabled
                  className={`rounded px-3 py-2 text-xs font-semibold text-amber-950 transition-colors ${
                    "bg-amber-500/40 cursor-not-allowed"
                  }`}
                >
                  {trialActive ? t("trialActive") : t("startTrial")}
                </button>
              </div>
              {authError ? <span className="text-[11px] text-amber-300">{authError}</span> : null}
              {saveTierMessage ? <span className="text-[11px] text-emerald-300">{saveTierMessage}</span> : null}
              {trialExpired && trialStart ? (
                <span className="text-[11px] text-amber-300">
                  {lang === "de" ? "Testversion abgelaufen." : "Trial expired."}
                </span>
              ) : null}
            </form>
          </div>
          </Card>
        </div>

        <div className="grid grid-cols-4 gap-2 text-[12px]">
          {[
            { key: "overview", label: "Overview" },
            { key: "charts", label: "Charts" },
            { key: "signals", label: "Signals" },
            { key: "research", label: "Research" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMobileTab(tab.key)}
              className={`rounded-xl px-3 py-2 font-semibold transition ${
                mobileTab === tab.key ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {mobileTab === "overview" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card
                  title={t("livePrice")}
                  icon={Activity}
                  tooltip="Live Price mit 24h Change, Multi-Source Fallback."
                  actions={
                    <div className="flex gap-2">
                      <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{selectedMarket.label}</span>
                      <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{priceState.source}</span>
                    </div>
                  }
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-3xl font-bold text-white">{formatUSD(displayPrice)}</div>
                    <div className={`text-sm font-semibold ${(priceState.change24h ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatPercent(priceState.change24h ?? 0)} 24h
                    </div>
                    <p className="text-xs text-slate-400">Update: {priceState.updatedAt ? new Date(priceState.updatedAt).toLocaleTimeString() : "-"}</p>
                  </div>
                </Card>

                <Card title={t("fearGreed")} icon={Gauge} tooltip="Fear & Greed Index letzte Aktualisierung.">
                  {fearGreed ? (
                    <div className="flex flex-col gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{fearGreed.value}</span>
                      <span className="text-sm uppercase tracking-wide text-slate-400">{fearGreed.classification}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, fearGreed.value)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">
                      Stand: {new Date(fearGreed.updatedAt).toLocaleTimeString()} � Source: {fearGreed.source || "alternative.me"}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Lade Daten...</p>
                )}
              </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card title={t("indicators")} icon={LineChartIcon} tooltip="RSI: Oversold <30, Overbought >70. MACD Momentum + Bollinger.">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">RSI</span>
                      <span className={`font-semibold ${indicators.rsi && (indicators.rsi < 30 || indicators.rsi > 70) ? "text-amber-400" : "text-emerald-300"}`}>
                        {indicators.rsi ? indicators.rsi.toFixed(1) : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">MACD</span>
                      <span className="font-semibold text-slate-100">
                        {indicators.macd && indicators.signal ? `${(indicators.macd - indicators.signal).toFixed(2)} (${indicators.macd.toFixed(2)}/${indicators.signal.toFixed(2)})` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Bollinger</span>
                      <span className="font-semibold text-slate-100">20 / 2 std</span>
                    </div>
                  </div>
                </Card>

                <Card title={t("reliability")} icon={Shield} tooltip="System-Robustheit: Cache, Polling, WS Reconnect.">
                  <ul className="space-y-1 text-sm text-slate-300">
                    <li className="flex items-center gap-2">
                      <PlugZap className="h-4 w-4 text-emerald-400" /> {t("reliability1")}
                    </li>
                    <li className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-emerald-400" /> {t("reliability2")}
                    </li>
                    <li className="flex items-center gap-2">
                      <WifiOff className="h-4 w-4 text-emerald-400" /> {t("reliability3")}
                    </li>
                    <li className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-emerald-400" /> {t("reliability4")}
                    </li>
                  </ul>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card title={t("systemStatus")} icon={Activity}>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>{t("systemWs")}</span>
                      <span className={`rounded-full px-2 py-1 text-xs ${wsStatus === "live" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                        {wsStatus} (Retries {wsAttempts}/5)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("systemCache")}</span>
                      <span className="text-slate-100">5 Minuten</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("systemPoll")}</span>
                      <span className="text-slate-100">30s</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("systemError")}</span>
                      <span className="text-xs text-slate-400">{lastError || t("systemNone")}</span>
                    </div>
                    <div className="pt-2 space-y-1 text-xs">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Data Sources</p>
                      {dataSourceStatuses.map((item) => (
                        <div key={item.key} className="flex items-center justify-between" title={item.message || ""}>
                          <span className="text-slate-400">{item.label}</span>
                          <span className={`font-semibold ${healthColor(item.status)}`}>{formatHealthLabel(item.status)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 space-y-1 text-xs">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Service Modules</p>
                      {runtimeHealthEntries
                        .filter(([, val]) => val && typeof val === "object" && "status" in val)
                        .map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between" title={val?.message || ""}>
                            <span className="uppercase text-slate-400">{key}</span>
                            <span className={`font-semibold ${healthColor(val.status)}`}>{formatHealthLabel(val.status)}</span>
                          </div>
                        ))}
                    </div>
              </div>
            </Card>

                <Card title={t("manualControls")} icon={PlugZap}>
                  <div className="flex flex-col gap-2 text-sm text-slate-300">
                    <button onClick={loadPrice} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                      <span>{t("manualPrice")}</span>
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button onClick={loadOHLC} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                      <span>{t("manualKraken")}</span>
                      <Activity className="h-4 w-4" />
                    </button>
                    <button onClick={loadFearGreed} className="inline-flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2 hover:bg-slate-700">
                      <span>{t("manualFG")}</span>
                      <Gauge className="h-4 w-4" />
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
          {mobileTab === "charts" ? (
            <div className="space-y-4">
              {/* TradingView Mobile Chart mit Trading-Signalen */}
              <Suspense fallback={<div className="h-[400px] flex items-center justify-center bg-slate-900/50 rounded-xl"><Skeleton className="h-80 w-full" /></div>}>
                <TradingViewPanel
                  assetId={selectedMarket.id}
                  assetClass={selectedMarket.assetClass}
                  timeFrame={timeFrame}
                  showTechnicalAnalysis={true}
                  chartHeight={350}
                  technicalHeight={250}
                  theme="dark"
                  currentPrice={displayPrice}
                  fibLevels={fibView.levels.length > 0 ? Object.fromEntries(fibView.levels.map(l => [l.label, l.value])) : null}
                  tpLevels={takeProfitPrice ? [takeProfitPrice] : []}
                  slLevel={stopLossPrice}
                  riskReward={takeProfitPrice && stopLossPrice && displayPrice ? Math.abs(takeProfitPrice - displayPrice) / Math.abs(displayPrice - stopLossPrice) : null}
                  trendDirection={aiSignal?.direction === "bullish" ? "bullish" : aiSignal?.direction === "bearish" ? "bearish" : null}
                  signalStrength={aiSignal?.confidence ? Math.round(aiSignal.confidence / 20) : null}
                />
              </Suspense>

              <Card
                title={t("fibMap")}
                icon={LineChartIcon}
                actions={<span className="text-xs text-slate-400">{t("fibGolden")} � TF {timeFrame === "15" ? "15m" : timeFrame === "60" ? "1h" : timeFrame === "240" ? "4h" : "1d"}</span>}
              >
                <LazyRender placeholder={<div className="h-64 flex items-center justify-center"><Skeleton className="h-56 w-full" /></div>}>
                  {indicatorSeries.length > 0 ? (
                    <div className="relative w-full min-w-0" style={{ minHeight: 200 }}>
                      {(nearTp || nearSl) && (
                        <div className="absolute right-3 top-3 flex gap-2 text-xs">
                          {nearTp ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200 pulse-soft">{t("tpAlarm")}</span> : null}
                          {nearSl ? <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-200 pulse-soft">{t("slAlarm")}</span> : null}
                        </div>
                      )}
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={indicatorSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                            width={80}
                            domain={[fibView.yMin ?? "auto", fibView.yMax ?? "auto"]}
                            tickFormatter={(v) => Math.round(v).toLocaleString()}
                          />
                          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }} labelStyle={{ color: "#e2e8f0" }} />
                          {tpZone ? <ReferenceArea y1={tpZone.y1} y2={tpZone.y2} strokeOpacity={0} fill="#22c55e" fillOpacity={0.07} className="glow-band" /> : null}
                          {slZone ? <ReferenceArea y1={slZone.y1} y2={slZone.y2} strokeOpacity={0} fill="#ef4444" fillOpacity={0.07} className="glow-band" /> : null}
                          {fibView.goldenLow && fibView.goldenHigh ? <ReferenceArea y1={fibView.goldenLow} y2={fibView.goldenHigh} strokeOpacity={0} fill="#fbbf24" fillOpacity={0.1} /> : null}
                          {fibView.levels.map((lvl) => (
                            <ReferenceLine key={lvl.label} y={lvl.value} stroke="#475569" strokeDasharray="2 4" label={{ value: lvl.label, position: "insideRight", fill: "#cbd5e1", fontSize: 10 }} />
                          ))}
                          {fibView.tp ? <ReferenceLine y={fibView.tp} stroke="#22c55e" strokeWidth={2} strokeOpacity={blink ? 1 : 0.4} label={{ value: t("fibTp"), position: "insideLeft", fill: "#22c55e", fontSize: 10 }} /> : null}
                          {fibView.sl ? <ReferenceLine y={fibView.sl} stroke="#ef4444" strokeWidth={2} strokeOpacity={blink ? 1 : 0.4} label={{ value: t("fibSl"), position: "insideLeft", fill: "#ef4444", fontSize: 10 }} /> : null}
                          {fibView.current ? <ReferenceLine y={fibView.current} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: t("fibNow"), position: "insideLeft", fill: "#38bdf8", fontSize: 10 }} /> : null}
                          <Line type="monotone" dataKey="close" stroke="#22c55e" dot={renderLastDot(indicatorSeries.length, "#22c55e")} strokeWidth={2} name="Close" isAnimationActive animationDuration={650} animationEasing="ease-out" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("loadingFib")}</p>
                  )}
                </LazyRender>
              </Card>

              <Card title={t("cryptoBubbles")} icon={TrendingUp} actions={<span className="text-xs text-slate-400">{t("bubblesTop")}</span>}>
                <LazyRender
                  placeholder={
                    <div className="h-32 flex items-center justify-center">
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-12 w-12 rounded-full" />
                      </div>
                    </div>
                  }
                >
                  {bubbleData.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {bubbleData.map((b) => (
                        <div
                          key={b.id}
                          className={`flex items-center justify-center rounded-full bg-slate-900/80 border ${b.bias === "buy" ? "border-emerald-500/60 text-emerald-100" : "border-red-500/60 text-red-100"}`}
                          style={{ width: `${b.size}px`, height: `${b.size}px` }}
                        >
                          <div className="text-center text-[10px] font-semibold leading-tight px-1">
                            <div className="truncate">{b.label}</div>
                            <div className="text-[9px] opacity-80">RSI {b.rsi.toFixed(1)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">{t("noBubbles")}</p>
                  )}
                </LazyRender>
              </Card>
            </div>
          ) : null}
          {mobileTab === "signals" ? (
            <div className="space-y-4">
              <Card title="AI Predictor" icon={Signal} tooltip="HuggingFace-Style Inference: Richtungs-Schaetzung + Confidence.">
                <div className="flex flex-col gap-3">
                  <div className="text-3xl font-bold text-white">{aiPredict.forecast ? formatUSD(aiPredict.forecast) : "-"}</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Trend</span>
                    <span className={`font-semibold ${aiPredict.trend === "bullish" ? "text-emerald-300" : aiPredict.trend === "bearish" ? "text-red-300" : "text-slate-200"}`}>
                      {aiPredict.trend === "bullish" ? "Bullish" : aiPredict.trend === "bearish" ? "Bearish" : "Neutral"}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Confidence</span>
                      <span className="font-semibold text-cyan-300">{aiPredict.confidence ? `${aiPredict.confidence}%` : "--"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, aiPredict.confidence ?? 0)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400">Forecast basiert auf letzter Drift + 5% Bias via HF-Style Cache.</p>
                  </div>
                  <div className="text-xs text-slate-400">Updated: {aiPredict.refreshedAt ? new Date(aiPredict.refreshedAt).toLocaleTimeString() : "-"}</div>
                </div>
              </Card>

              <Paywall
                minTier="elite"
                userTier={effectiveTier}
                isTrialActive={trialActive}
                trialEndText={
                  trialActive
                    ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                    : trialExpired
                    ? "Test abgelaufen. Bitte upgraden."
                    : t("eliteRequired")
                }
                lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("eliteRequired")}
              >
                <Card title={t("aiSignalTitle")} icon={Signal}>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Aktion</span>
                      <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold">{aiSignal.action}</span>
                    </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Begruendung</span>
                        <span className="text-right text-slate-200">{aiSignal.reason}</span>
                      </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Konfidenz (~ Backtest)</span>
                      <span className="text-emerald-300 font-semibold">{(aiSignal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-xs">
                      <div className="flex justify-between">
                        <span>TP Ziel</span>
                        <span className="font-semibold">{aiSignal.tp ? formatUSD(aiSignal.tp) : "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SL Ziel</span>
                        <span className="font-semibold">{aiSignal.sl ? formatUSD(aiSignal.sl) : "-"}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-amber-300">{t("aiHint")}</p>
                  </div>
                </Card>
              </Paywall>

              <Paywall
                minTier="pro"
                userTier={effectiveTier}
                isTrialActive={trialActive}
                trialEndText={
                  trialActive
                    ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                    : trialExpired
                    ? "Test abgelaufen. Bitte upgraden."
                    : t("proRequired")
                }
                lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
              >
                <Card title={t("proSignalsTitle")} icon={TrendingUp}>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Aktion</span>
                      <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${proSignal.action === "long" ? "bg-emerald-500/10 text-emerald-200" : proSignal.action === "short" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"}`}>
                        {proSignal.action}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{t("setupType")}</span>
                      <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100">{proSignal.setupLabel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{t("regime")}</span>
                      <span className={`rounded px-2 py-1 text-[11px] font-semibold ${proSignal.regimeIntent === "ok" ? "bg-emerald-500/10 text-emerald-200" : proSignal.regimeIntent === "warn" ? "bg-red-500/10 text-red-200" : "bg-slate-800 text-slate-200"}`}>
                        {proSignal.regimeLabel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {t("reasonLabel")}: <span className="text-slate-200">{proSignal.reason}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Confidence</span>
                      <span className="font-semibold text-emerald-300">{(proSignal.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2 text-[11px] text-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{t("checks")}:</span>
                        <span className="text-slate-300">{(proSignal.score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.trend === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.trend === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkTrend")}</span>
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.momentum === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.momentum === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkMomentum")}</span>
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.flow === "ok" ? "bg-emerald-500/15 text-emerald-200" : proSignal.meta?.checks?.flow === "warn" ? "bg-red-500/15 text-red-200" : "bg-slate-800 text-slate-200"}`}>{t("checkFlow")}</span>
                        <span className={`rounded px-2 py-1 text-[10px] font-semibold ${proSignal.meta?.checks?.vol === "ok" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-200"}`}>{t("checkVol")}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Paywall>

              {effectiveTier === "basic" ? (
                <LockedCard title={t("backtestTitle")} requiredTier="pro" description="Schalte Pro frei, um historische Trefferquote und Risiko-Kennzahlen zu sehen." />
              ) : (
                <Card title={t("backtestTitle")} icon={TrendingUp}>
                  <div className="space-y-2 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>{t("backtestTrades")}</span>
                      <span className="font-semibold">{backtestStats.trades}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("backtestWinRate")}</span>
                      <span className="font-semibold text-emerald-300 whitespace-nowrap overflow-hidden text-ellipsis">
                        {backtestStats.winRate !== null ? `${backtestStats.winRate.toFixed(0)}%` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("backtestWinsLosses")}</span>
                      <span className="font-semibold whitespace-nowrap">
                        {backtestStats.wins} / {backtestStats.losses}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t("backtestAvgRR")}</span>
                      <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                        {backtestStats.avgRR !== null ? backtestStats.avgRR.toFixed(2) : "-"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{t("backtestNote")}</p>
                  </div>
                </Card>
              )}

              <Card title="Quick Tips for Beginners" icon={AlertTriangle} tooltip="Short Guide fuer erste Trades.">
                <ul className="space-y-2 text-sm text-slate-200 list-disc list-inside">
                  <li>Starte mit BTC/ETH und 1h-Chart.</li>
                  <li>RSI &lt; 30? Beobachte Fib-Golden-Zone fuer moegliche Rebounds.</li>
                  <li>Setze SL 3% unter Entry, TP 4-6% - siehe TP/SL Rechner.</li>
                  <li>Beginner-Mode haelt nur Kernkarten aktiv; pro View fuer volle Tiefe.</li>
                </ul>
              </Card>
            </div>
          ) : null}
          {mobileTab === "research" ? (
            <div className="space-y-4">
              <Paywall
                minTier="pro"
                userTier={effectiveTier}
                isTrialActive={trialActive}
                trialEndText={
                  trialActive
                    ? `7-Tage-Test aktiv. Ende: ${trialEnd || ""}`
                    : trialExpired
                    ? "Test abgelaufen. Bitte upgraden."
                    : t("proRequired")
                }
                lockText={trialExpired ? "Test abgelaufen. Bitte upgraden." : t("proRequired")}
              >
                <section
                  className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 flex flex-col gap-4"
                  aria-label="On-Chain Metrics"
                  itemScope
                  itemType="https://schema.org/Dataset"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-cyan-400" aria-hidden />
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">On-Chain Metrics</h3>
                    </div>
                    <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                      {formatClock(onChainMetrics.updatedAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-200 leading-snug">{t("onchainDesc")}</p>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-3xl font-black text-emerald-400 whitespace-nowrap">
                      {onChainMetrics.active ? onChainMetrics.active.toLocaleString("en-US") : "�"}
                    </div>
                    <div className="text-xs text-slate-300 leading-tight min-w-[120px] max-w-[160px] space-y-1 break-words">
                      <div className="flex items-center justify-between gap-2">
                        <span>Whales</span>
                        <span className="font-semibold text-slate-100">{(onChainMetrics.supplyWhales ?? 0.6 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Retail</span>
                        <span className="font-semibold text-slate-100">{(onChainMetrics.supplyRetail ?? 0.4 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>Delta</span>
                        <span className="font-semibold text-slate-100">
                          {onChainMetrics.supplyWhales && onChainMetrics.supplyRetail ? ((onChainMetrics.supplyWhales - onChainMetrics.supplyRetail) * 100).toFixed(1) + "%" : "--"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{t("onchainDesc")}</span>
                      <span className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-100">BTC</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (onChainMetrics.active ?? 100000) / 2000)}%` }} />
                    </div>
                  </div>
                </section>
              </Paywall>

              <Card title="ETF Zufluesse" icon={TrendingUp}>
                <div className="space-y-3">
                  <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF Holdings...</div>}>
                    <EtfHoldingsCard
                      holdings={etfHoldings}
                      loading={etfHoldingsLoading}
                      error={etfHoldingsError}
                      lastUpdated={etfHoldingsLastUpdated}
                    />
                  </Suspense>
                  <div className="flex flex-wrap items-center gap-2">
                    {ETF_SYMBOLS.map((sym, idx) => {
                      const active = etfSelection.includes(sym);
                      return (
                        <button
                          key={sym}
                          onClick={() =>
                            setEtfSelection((prev) => (prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym].slice(0, ETF_SYMBOLS.length)))
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                            active ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-200"
                          }`}
                          style={{ borderColor: active ? etfColors[idx % etfColors.length] : undefined }}
                        >
                          {sym}
                        </button>
                      );
                    })}
                    {etfAumLoading ? <span className="text-xs text-slate-400">Lade...</span> : null}
                    {etfAumError ? <span className="text-xs text-amber-300">{etfAumError}</span> : null}
                  </div>
                  <div className="text-xs text-slate-400">Last updated: {etfLastUpdated ? new Date(etfLastUpdated).toLocaleTimeString() : "-"}</div>
                  <LazyRender
                    placeholder={
                      <div className="h-64 flex items-center justify-center">
                        <Skeleton className="h-56 w-full" />
                      </div>
                    }
                  >
                    {etfFlowSeries.length > 0 ? (
                      <div className="w-full min-w-0" style={{ minHeight: 200 }}>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={buildEtfChartData(etfFlowSeries)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                            <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `${v >= 0 ? "+" : ""}${(v / 1_000_000).toFixed(1)}M`} />
                            <Tooltip
                              contentStyle={{ background: "#0f172a", border: "1px solid #1f2937" }}
                              labelStyle={{ color: "#e2e8f0" }}
                              formatter={(val, name) => [`${Number(val) >= 0 ? "+" : ""}${Number(val).toLocaleString()}`, name]}
                            />
                            {etfFlowSeries.map((s, idx) => (
                              <Bar
                                key={s.symbol}
                                dataKey={s.symbol}
                                name={s.symbol}
                                fill={etfColors[idx % etfColors.length]}
                                radius={[4, 4, 0, 0]}
                                isAnimationActive
                                opacity={0.9}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">{etfAumError || "Daten derzeit nicht verfuegbar"}</p>
                    )}
                  </LazyRender>
                  <div className="grid grid-cols-1 gap-2 text-sm text-slate-200">
                    {etfFlowSeries.map((s, idx) => (
                      <div key={s.symbol} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold" style={{ color: etfColors[idx % etfColors.length] }}>
                            {s.symbol}
                          </span>
                          <span className="text-xs text-slate-400">{s.provider}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>7d</span>
                          <span className={`font-semibold ${s.sum7dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum7dUsd)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>30d</span>
                          <span className={`font-semibold ${s.sum30dUsd >= 0 ? "text-emerald-300" : "text-red-300"}`}>{formatUSD(s.sum30dUsd)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">Updated {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString() : "-"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Suspense fallback={<div className="text-xs text-slate-400">Laedt Provider-Metriken...</div>}>
                <EtfProviderQualityCard />
              </Suspense>
              <Suspense fallback={<div className="text-xs text-slate-400">Laedt ETF-Korrelationen...</div>}>
                <EtfCorrelationCard onHealthUpdate={updateApiHealth} />
              </Suspense>

              <section
                className="bg-slate-900/95 backdrop-blur-sm border border-slate-800 rounded-xl shadow-2xl p-6 flex flex-col gap-4"
                aria-label="Sentiment Analysis"
                itemScope
                itemType="https://schema.org/Dataset"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Signal className="h-5 w-5 text-cyan-400" aria-hidden />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-50">Sentiment Analysis</h3>
                  </div>
                  <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[12px] font-semibold text-slate-200 whitespace-nowrap">
                    {formatClock(sentimentMetrics.updatedAt)}
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-snug">{t("sentimentDesc")}</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="relative h-16 w-16 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500 opacity-40" />
                    <div className="absolute inset-0 rounded-full border-4 border-cyan-400 opacity-80" style={{ clipPath: "polygon(0 0, 100% 0, 100% 50%, 0 50%)" }} />
                    <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-emerald-400">{sentimentMetrics.score ?? "--"}</div>
                  </div>
                  <div className="text-xs text-slate-300 text-left leading-tight break-words max-w-[180px] space-y-1">
                    <p>Label: {sentimentMetrics.label}</p>
                    <p>Trend: {sentimentMetrics.score !== null ? (sentimentMetrics.score > 60 ? "Positiv" : "Neutral") : "-"}</p>
                    <p>Tweets: {sentimentMetrics.tweets ?? "-"}</p>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card title="Correlations" icon={Activity}>
                  <div className="space-y-2 text-sm text-slate-200">
                    {correlations.length > 0 ? (
                      correlations.map((c) => {
                        const pct = Math.round(c.value * 100);
                        const color = c.value >= 0.6 ? "bg-emerald-500/60" : c.value >= 0.3 ? "bg-amber-500/60" : c.value >= 0 ? "bg-slate-700" : "bg-red-500/60";
                        return (
                          <div key={c.pair} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-300">{c.pair}</span>
                              <span className="text-xs font-semibold text-slate-100">{pct}%</span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-slate-800">
                              <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, Math.abs(pct))}%` }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400">{t("loading")}</p>
                    )}
                  </div>
                </Card>

                <Card title="Funding Rates" icon={TrendingUp}>
                  <div className="space-y-2 text-sm text-slate-200">
                    {fundingRates.length > 0 ? (
                      fundingRates.map((f) => {
                        const pct = f.rate ? f.rate * 100 : 0;
                        const bullish = pct >= 0;
                        return (
                          <div key={f.symbol} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{f.symbol}</span>
                              <span className={`text-xs font-semibold ${bullish ? "text-emerald-300" : "text-red-300"}`}>{pct.toFixed(4)}%</span>
                            </div>
                            <p className="text-[11px] text-slate-400">Mark: {f.mark ? formatUSD(f.mark) : "-"}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-400">{t("loading")}</p>
                    )}
                  </div>
                </Card>
              </div>

              <Card title={t("tpSlTitle")} icon={Bell}>
                <div className="space-y-3 text-sm text-slate-200">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      {t("tpEntryLabel")}
                      <input
                        type="number"
                        value={tpForm.entry ?? ""}
                        onChange={(e) => setTpForm((p) => ({ ...p, entry: e.target.value ? Number(e.target.value) : null }))}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                        placeholder="62000"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      {t("tpQtyLabel")}
                      <input
                        type="number"
                        value={tpForm.quantity}
                        min="0"
                        step="0.0001"
                        onChange={(e) => setTpForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                        placeholder="1.0"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      {t("tpTpLabel")}
                      <input
                        type="number"
                        value={tpForm.tpPct}
                        onChange={(e) => setTpForm((p) => ({ ...p, tpPct: Number(e.target.value) || 0 }))}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                        placeholder="4"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      {t("tpSlLabel")}
                      <input
                        type="number"
                        value={tpForm.slPct}
                        onChange={(e) => setTpForm((p) => ({ ...p, slPct: Number(e.target.value) || 0 }))}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
                        placeholder="3"
                      />
                    </label>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                    <div className="flex justify-between">
                      <span>{t("tpPrice")}</span>
                      <span className="font-semibold">{takeProfitPrice ? formatUSD(takeProfitPrice) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("slPrice")}</span>
                      <span className="font-semibold">{stopLossPrice ? formatUSD(stopLossPrice) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("profitAtTp")}</span>
                      <span className="font-semibold text-emerald-300">{profit !== null ? formatUSD(profit) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("lossAtSl")}</span>
                      <span className="font-semibold text-red-300">{loss !== null ? formatUSD(-loss) : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("rrLabel")}</span>
                      <span className="font-semibold">{rr !== null ? rr.toFixed(2) : "-"}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-8 text-center text-xs text-slate-500">{t("madeBy")}</div>
      {showTutorial ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="w-[90%] max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-emerald-300">Willkommen!</p>
                <h2 className="text-2xl font-bold text-white">Starte mit Live Price</h2>
              </div>
              <button
                onClick={() => {
                  setShowTutorial(false);
                  localStorage.setItem("tutorial:shown", "true");
                }}
                className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-sm font-semibold text-emerald-300">1) Asset waehlen</p>
                <p className="text-sm text-slate-300">Oben links BTC/ETH umschalten. Preise und Fib-Map laden live.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-sm font-semibold text-emerald-300">2) Beginner-Mode</p>
                <p className="text-sm text-slate-300">Laesst Advanced Karten weg - perfekt fuer den Einstieg.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <p className="text-sm font-semibold text-emerald-300">3) AI & Backtest</p>
                <p className="text-sm text-slate-300">Neue AI-Predictor Karte + Schnell-Backtest liefert Trefferquote.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsBeginner(true);
                  setShowTutorial(false);
                  localStorage.setItem("mode:beginner", "true");
                  localStorage.setItem("tutorial:shown", "true");
                }}
                className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                Beginner starten
              </button>
              <button
                onClick={() => {
                  setIsBeginner(false);
                  setShowTutorial(false);
                  localStorage.setItem("mode:beginner", "false");
                  localStorage.setItem("tutorial:shown", "true");
                }}
                className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Pro-View
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {!consentGeo ? (
        <div className="fixed bottom-4 left-4 z-50 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-200 shadow-lg max-w-xs">
          <p className="text-slate-200">{t("consentText")}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                setConsentGeo(true);
                localStorage.setItem("consent:geo", "true");
              }}
              className="rounded bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              {t("consentAllow")}
            </button>
            <button
              onClick={() => {
                setConsentGeo(false);
                localStorage.setItem("consent:geo", "false");
              }}
              className="rounded bg-slate-800 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
            >
              {t("consentDeny")}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setConsentGeo(false);
            localStorage.setItem("consent:geo", "false");
          }}
          className="fixed bottom-4 left-4 z-40 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
        >
          {t("consentRevoke")}
        </button>
      )}
    </div>
  );
}

export default App;
