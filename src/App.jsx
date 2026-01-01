// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { auth, login as fbLogin, signup as fbSignup, logout as fbLogout, saveUserTier, signInWithGoogle, startUserTrial } from "./firebase";
import { useUserTier } from "./context/UserTierContext";
import Paywall, { TIER_ORDER } from "./components/Paywall";
import IndicatorBadge from "./components/IndicatorBadge";
import Card from "./components/Card";
import VisionAILogo from "./components/VisionAILogo";
import { APP_BRAND, APP_TAGLINE } from "./config/brand";
import { dataSources } from "./config/dataSources";
import { DEFAULT_MARKET_ID, MARKETS } from "./config/markets";
import supportedCoins, { SUPPORTED_TICKERS, formatMarketId } from "./config/supportedCoins";
import { resolveFullTradingViewSymbol } from "./config/coinConfig";
import FullScreenLoader from "./components/FullScreenLoader";
import WelcomeModal from "./components/WelcomeModal";
import Footer from "./components/Footer";
import SocialSentimentCard from "./components/SocialSentimentCard";
import { useEliteTrial } from "./hooks/useEliteTrial";
import AuthModal from "./components/AuthModal";
import { fetchEtfFlowSeriesLive } from "./services/etfFlowsLive";
import DashboardLayout from "./features/dashboard/DashboardLayout";
import SignalPanel from "./features/signals/SignalPanel";
import ChartSection from "./features/charts/ChartSection";
import RiskTerminal from "./features/risk/RiskTerminal";
import ResearchCenter from "./features/research/ResearchCenter";
import { usePriceStore } from "./stores/usePriceStore";
import { fetchEtfHoldingsLive } from "./services/etfHoldingsLive";
import { cryptoDataService } from "./services/cryptoDataService";
import { createApiCheckers } from "./config/apiCheckers";
// TradingViewHeatmap is available for future use
import { safeFetch, subscribeToSourceHealth, getSourceHealthSnapshot } from "./lib/safeFetch";
import { loadChart, buildFallbackChart } from "./lib/chartLoader";
import { fetchHtfOhlc } from "./services/marketDataLive";
import { fetchDerivativesLive } from "./services/derivativesLive";
import { safeFixed } from "./lib/safeFixed";
import { useUnifiedPrice } from "./hooks/useUnifiedPrice";
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
import { buildBacktestSignals } from "./lib/signalsV2";
import { buildSignalsV4, buildAISignalV4, calculateVisionSignal } from "./lib/signalsV4";
import { runBacktestV3 } from "./lib/backtestV3";

const CACHE_TTL = 60 * 1000; // 60 seconds - faster updates for real-time feel
const OHLC_CACHE_TTL = 60 * 1000; // 60 seconds for candle data
const FNG_CACHE_TTL = 30 * 1000; // 30 seconds - Real-time sentiment updates
const POLL_INTERVAL = 15 * 1000; // 15 seconds - faster polling
const NEWS_REFRESH = 5 * 60 * 1000; // 5 minutes
const FLOWS_REFRESH = 5 * 60 * 1000; // 5 minutes
const DAY_MS = 24 * 60 * 60 * 1000;

const buildSupportedMarket = (coin) => {
  const base = String(coin.symbol || "").toUpperCase();
  const id = formatMarketId(base);
  return {
    id,
    label: `${base} / USD`,
    assetClass: "crypto",
    defaultProvider: "coingecko",
    base,
    quote: "USD",
    providerSymbols: {
      coingecko: coin.id,
      binance: `${base}USDT`,
    },
    supportsIntraday: true,
  };
};

const SUPPORTED_MARKETS = supportedCoins.reduce((acc, coin) => {
  const id = formatMarketId(coin.symbol);
  acc[id] = MARKETS[id] ? { ...MARKETS[id] } : buildSupportedMarket(coin);
  return acc;
}, {});

const MARKET_OPTIONS = Array.from(
  new Map(
    supportedCoins.map((coin) => {
      const id = formatMarketId(coin.symbol);
      return [id, SUPPORTED_MARKETS[id]];
    })
  ).values()
).filter(Boolean);
const ASSET_CLASS_LABELS = {
  crypto: "Crypto",
};
const SUPPORTED_BY_ID = new Map(supportedCoins.map((coin) => [coin.id.toLowerCase(), formatMarketId(coin.symbol)]));
const SUPPORTED_BY_SYMBOL = new Map(supportedCoins.map((coin) => [coin.symbol.toUpperCase(), formatMarketId(coin.symbol)]));
const normalizeSymbolKey = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeAssetSymbol = (value) => {
  const raw = String(value || "");
  const rawId = raw.toLowerCase();
  if (SUPPORTED_BY_ID.has(rawId)) return SUPPORTED_BY_ID.get(rawId);
  const normalized = normalizeSymbolKey(raw);
  if (!normalized) return null;
  if (SUPPORTED_TICKERS.has(normalized)) return normalized;
  const base = normalized.endsWith("USDT")
    ? normalized.slice(0, -4)
    : normalized.endsWith("USD")
    ? normalized.slice(0, -3)
    : normalized;
  if (SUPPORTED_BY_SYMBOL.has(base)) return SUPPORTED_BY_SYMBOL.get(base);
  const candidate = `${base}USD`;
  return SUPPORTED_TICKERS.has(candidate) ? candidate : DEFAULT_MARKET_ID;
};

// Locale initialization - MUST be before any function that uses it
let activeLocale = "de-DE";
try {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get("lang");
  if (langParam === "en" || (!langParam && navigator.language.startsWith("en"))) {
    activeLocale = "en-US";
  }
} catch {
  // SSR or window not available
  activeLocale = "de-DE";
}

const setActiveLocale = (locale) => {
  activeLocale = locale || "de-DE";
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
    desc: "Crypto correlation data.",
    limit: "250 Calls/Tag free",
  },
];

const getApiSources = () => {
  const isEn = (activeLocale || "de-DE").startsWith("en");
  return [
    { name: "DeFiLlama", desc: isEn ? "DeFi Yields, TVL, Chains - for Yield Tracker." : "DeFi-Yields, TVL, Chains - fuer Yield Tracker.", limit: "Unlimited free" },
    { name: "Santiment", desc: isEn ? "On-Chain + Sentiment (Whale Alerts, Social Volume)." : "On-Chain + Sentiment (Whale Alerts, Social Volume).", limit: isEn ? "100 Calls/month free" : "100 Calls/Monat free" },
    { name: "HuggingFace", desc: isEn ? "AI Predictions (Inference for Price Forecast)." : "AI-Predictions (Inference fuer Price-Forecast).", limit: "Free Inference" },
    { name: "Alpha Vantage", desc: isEn ? "Vol-Forecast, Tech Indicators (ATR, Correlations)." : "Vol-Forecast, Tech Indicators (ATR, Correlations).", limit: "25 Calls/Tag free" },
    { name: "FMP", desc: isEn ? "Crypto correlation data." : "Crypto correlation data.", limit: "250 Calls/Tag free" },
  ];
};

const API_SOURCES = getApiSources();

const SHOW_CRYPTO_EDU_CHAT = true;
const DATA_SOURCE_LIST = Object.values(dataSources || {});
const LOG_THROTTLE_WINDOW = 20000;
const DEFAULT_BALANCE = 10000;

const formatterCache = new Map();
const getFormatter = (locale, opts) => {
  const key = `${locale}:${JSON.stringify(opts)}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(key, new Intl.NumberFormat(locale, opts));
  }
  return formatterCache.get(key);
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

// cryptoDataService imported from ./services/cryptoDataService

const formatClock = (ts) => {
  if (!ts) return "--:--";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
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
    avgRR: "Ø RR",
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
    backtestAvgRR: "Ø RR",
    cardMarketRegime: "Market Regime Detector",
    cardSmartMoney: "Smart Money Flow",
    cardLiquidity: "Liquidity Heatmap",
    cardManualControls: "Manual Controls",
    cardDataIntegrity: "Data Integrity",
    fibGolden: "Golden Zone, TP/SL",
    liveMarketMeta: "Kraken OHLC - TF",
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
    liquidityDesc: "Orderbook strength - bids vs. asks (last 1h).",
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
    liveMarketMeta: "Kraken OHLC - TF",
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
    diaryAutosave: "Autosave (local) - max 50 entries",
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
    trialData: firebaseTrialData, // Trial data from Firebase
  } = useUserTier();

  // Trial system - now Firebase-based, not localStorage
  const { isTrialActive, trialExpiresAt, remainingMs, startedAt: localTrialStart, trialUsed } = useEliteTrial(firebaseTrialData);
  const effectiveTier = isTrialActive && ctxTier !== "elite" ? "elite" : ctxTier;

  // Auth Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);

  const marketOptions = useMemo(() => MARKET_OPTIONS, []);
  const navigate = useNavigate();
  const params = useParams();
  const setSelectedAssetId = usePriceStore((state) => state.setSelectedAssetId);
  const lastProcessedSymbol = useRef(null);
  const routeAssetId = useMemo(() => {
    const raw = params?.assetId || params?.symbol;
    return normalizeAssetSymbol(raw) || DEFAULT_MARKET_ID;
  }, [params?.assetId, params?.symbol]);
  // Use full TradingView symbol with correct exchange (BINANCE for crypto, OANDA for gold, FX for forex)
  const tradingViewSymbol = useMemo(
    () => resolveFullTradingViewSymbol(params?.assetId || params?.symbol),
    [params?.assetId, params?.symbol]
  );
  const [selectedAsset, setSelectedAsset] = useState(DEFAULT_MARKET_ID);
  useEffect(() => {
    if (!routeAssetId) return;
    if (routeAssetId === selectedAsset) return;
    setSelectedAsset(routeAssetId);
  }, [routeAssetId, selectedAsset]);
  const selectedAssetId = selectedAsset;
  const selectedMarket = useMemo(
    () => SUPPORTED_MARKETS[selectedAssetId] || SUPPORTED_MARKETS[DEFAULT_MARKET_ID],
    [selectedAssetId]
  );
  const groupedMarkets = useMemo(() => {
    return marketOptions.reduce((acc, market) => {
      const key = market.assetClass || "other";
      acc[key] = acc[key] || [];
      acc[key].push(market);
      return acc;
    }, {});
  }, [marketOptions]);
  const handleAssetSelect = useCallback(
    (next) => {
      const value =
        typeof next === "string"
          ? next
          : next?.symbol || next?.assetId || next?.id || next;
      const normalized = normalizeAssetSymbol(value) || DEFAULT_MARKET_ID;
      if (!normalized) return;
      const baseSymbol = SUPPORTED_MARKETS[normalized]?.base;
      const normalizedKey = normalizeSymbolKey(value);
      const fallbackSymbol = normalizedKey.endsWith("USDT")
        ? normalizedKey.slice(0, -4)
        : normalizedKey.endsWith("USD")
        ? normalizedKey.slice(0, -3)
        : normalizedKey;
      const routeValue = baseSymbol || fallbackSymbol || normalized;
      setSelectedAsset((prev) => (prev === normalized ? prev : normalized));
      navigate(`/trading/${routeValue}`);
    },
    [navigate]
  );
  const handleAssetChange = useCallback(
    (next) => {
      if (!next) return;
      handleAssetSelect(next);
    },
    [handleAssetSelect]
  );
  const priceAsset = usePriceStore((state) => state.selectPriceAsset(selectedMarket.id));
  // Use unified price for consistency across all components
  const unifiedPriceData = useUnifiedPrice(selectedMarket.id, priceAsset.restPrice);
  const livePrice = unifiedPriceData.lastPrice;
  const trades = priceAsset.trades;
  const wsStatus = priceAsset.wsStatus;
  const wsAttempts = priceAsset.wsAttempts;
  const [priceState, setPriceState] = useState({ value: null, change24h: null, source: "CoinGecko", updatedAt: null });
  const [fearGreed, setFearGreed] = useState(null);
  const [ohlcv, setOhlcv] = useState([]);
  const [htfOhlcv, setHtfOhlcv] = useState({ h4: [], d1: [] });
  const [indicators, setIndicators] = useState({ rsi: null, macd: null, signal: null, histogram: null });
  const [lastError, setLastError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const [volatilityData, setVolatilityData] = useState(null); // NEW: Volatility Engine data
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
  const trialActive = Boolean(isTrialActive);

  // Check if trial was used locally (for non-logged-in users)
  const [localTrialUsed, setLocalTrialUsed] = useState(() => {
    try {
      return localStorage.getItem("elite-trial-used") === "true";
    } catch {
      return false;
    }
  });

  // Combined trial used check (local or Firebase)
  const isTrialBlocked = localTrialUsed || trialUsed || trialExpired;

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
  }, [removeToast]);

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
  const isKnownApiIssue = useCallback((source, message) => {
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
  }, []);

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
  }, [isDevBuild, isKnownApiIssue]);

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
  const pollTimer = useRef(null);
  const newsTimer = useRef(null);
  const flowsTimer = useRef(null);

  const displayPrice = livePrice ?? priceState.value;
  const connectPrice = usePriceStore((state) => state.connect);
  const disconnectPrice = usePriceStore((state) => state.disconnect);

  useEffect(() => {
    if (!selectedAsset) return;
    if (lastProcessedSymbol.current === selectedAsset) return;

    lastProcessedSymbol.current = selectedAsset;
    setSelectedAssetId(selectedAsset);

    setOhlcv([]);
    setHtfOhlcv({ h4: [], d1: [] });
    setIndicators({ rsi: null, macd: null, signal: null, histogram: null });
    setPriceState({ value: null, change24h: null, source: "CoinGecko", updatedAt: null });
    setLastError("");
  }, [selectedAsset, setSelectedAssetId]);

  const buildAbortError = useCallback(() => {
    const err = new Error("AbortError");
    err.name = "AbortError";
    return err;
  }, []);

  const isAbortError = useCallback((err) => err?.name === "AbortError", []);

  const fetchWithCache = useCallback(async (key, fetcher, customTtl = CACHE_TTL, signal) => {
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.time < customTtl) return cached.value;
    if (signal?.aborted) throw buildAbortError();
    const value = await fetcher(signal);
    if (signal?.aborted) throw buildAbortError();
    cacheRef.current.set(key, { value, time: Date.now() });
    return value;
  }, [buildAbortError]);

  const relayProxyHealth = useCallback((entries) => {
    if (!Array.isArray(entries) || !entries.length) return;
    for (const entry of entries) {
      if (!entry?.key || !entry?.status) continue;
      updateApiHealth(entry.key, entry.status, entry.message);
    }
  }, [updateApiHealth]);

  const fetchPriceProxy = useCallback(async (assetId, signal) => {
    const params = new URLSearchParams({ asset: assetId, vs: "USD" });
    const response = await safeFetch(`/api/price?${params.toString()}`, {
      serviceName: "price_proxy",
      timeoutMs: 10000,
      retries: 0,
      abortKey: "price_proxy",
      signal,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      uiLevel: "status",
    });
    relayProxyHealth(response?.health);
    if (response?.error) throw new Error(response.error);
    if (!response?.data) throw new Error("Price payload missing");
    return response.data;
  }, [logEvent, relayProxyHealth, updateApiHealth]);

  // Fallback: Traditional Fear & Greed from Alternative.me
  const fetchFearGreedFallback = useCallback(async (signal) => {
    const data = await safeFetch("https://api.alternative.me/fng/?limit=1&format=json", {
      serviceName: "fear_greed",
      timeoutMs: 8000,
      retries: 1,
      signal,
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
  }, [logEvent, updateApiHealth]);

  // NEW: Real-time Sentiment API (combines Binance + Alternative.me)
  const fetchRealTimeSentiment = useCallback(async (signal) => {
    try {
      const response = await safeFetch("/api/sentiment", {
        serviceName: "sentiment_realtime",
        timeoutMs: 5000,
        retries: 1,
        signal,
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
      if (isAbortError(err)) throw err;
      // Fallback to traditional Fear & Greed
      console.warn("Real-time sentiment failed, using fallback:", err?.message);
      return fetchFearGreedFallback(signal);
    }
  }, [fetchFearGreedFallback, isAbortError, logEvent, updateApiHealth]);

  // Use real-time sentiment as primary
  const fetchFearGreed = fetchRealTimeSentiment;

  const formatCandleLabel = useCallback((timestamp, minutes) => {
    const date = new Date(Number(timestamp) * 1000);
    if (minutes >= 1440) return date.toLocaleDateString();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  const decorateCandles = useCallback((series, intervalMinutes) => {
    const windowSize = Number(intervalMinutes) || 60;
    if (!Array.isArray(series)) return [];
    return series.map((row) => ({
      ...row,
      label: formatCandleLabel(row.time, windowSize),
    }));
  }, [formatCandleLabel]);

  const resolveProviderSymbol = useCallback((providerId) => {
    const entry = Object.entries(selectedMarket?.providerSymbols || {}).find(([id]) => id.toLowerCase() === providerId.toLowerCase());
    return entry?.[1];
  }, [selectedMarket]);

  const fallbackSeries = useMemo(() => {
    const basePrice = Number(priceState.value) || 100;
    const intervalMinutes = Number(timeFrame) || 60;
    const series = buildFallbackChart(120, basePrice, 0.02);
    return decorateCandles(series, intervalMinutes);
  }, [decorateCandles, priceState.value, timeFrame]);

  const loadPrice = useCallback(async (signal) => {
    try {
      const assetId = selectedMarket?.id || DEFAULT_MARKET_ID;
      const payload = await fetchWithCache(
        `price:proxy:${assetId}`,
        (fetchSignal) => fetchPriceProxy(assetId, fetchSignal),
        CACHE_TTL,
        signal
      );
      if (signal?.aborted) return;
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
      if (isAbortError(err)) return;
      console.error("Price proxy failed", err);
      setLastError(t("fetchFailPrice"));
      setPriceState((prev) => ({ value: null, change24h: null, source: prev.source, updatedAt: null }));
      updateApiHealth("price_proxy", "error", err?.message);
      logEvent("price", "error", err?.message || "price proxy failed");
    }
  }, [selectedMarket?.id, t, fetchWithCache, fetchPriceProxy, updateApiHealth, logEvent, isAbortError]);



  // NEW: Volatility Engine Loader
  const loadVolatility = useCallback(async (signal) => {
    try {
      const symbol = selectedMarket?.id || "BTC";
      const interval = timeFrame === "15" ? "15m" : timeFrame === "240" ? "4h" : "1h";
      const cacheKey = `volatility:${symbol}:${interval}`;

      const data = await fetchWithCache(
        cacheKey,
        async (fetchSignal) => {
          const response = await fetch(
            `/api/volatility?symbol=${encodeURIComponent(symbol)}&interval=${interval}&lookback=100`,
            { signal: fetchSignal }
          );
          if (!response.ok) throw new Error(`Volatility API: ${response.status}`);
          return response.json();
        },
        60000,
        signal
      ); // 1 minute cache
      if (signal?.aborted) return;

      setVolatilityData(data);
      updateApiHealth("volatility", "ok");

      // Show toast for extreme volatility
      if (data?.classification === "EXTREME") {
        addToast({
          type: "warn",
          message: `🚨 EXTREME VOLATILITÄT: ${safeFixed(Number(data.volatilityScore) || 0, 2)}/100 - Trading pausieren!`,
        });
      } else if (data?.classification === "HIGH" && data?.volatilityScore > 75) {
        addToast({
          type: "info",
          message: `⚠️ Hohe Volatilität: ${safeFixed(Number(data.volatilityScore) || 0, 2)}/100 - Vorsicht!`,
        });
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Volatility load failed", err);
      setVolatilityData(null);
      updateApiHealth("volatility", "degraded", err?.message);
    }
  }, [selectedMarket?.id, timeFrame, addToast, updateApiHealth, fetchWithCache, isAbortError]);

  const loadFearGreed = useCallback(async (signal) => {
    try {
      // Kuerzerer Cache-TTL fuer Fear & Greed (1 Minute statt 5)
      const fg = await fetchWithCache("fng", fetchFearGreed, FNG_CACHE_TTL, signal);
      if (signal?.aborted) return;
      setFearGreed(fg);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Fear & Greed failed", err);
      setLastError((prev) => prev || t("fetchFailFearGreed"));
      updateApiHealth("fear_greed", "degraded", t("fetchFailFearGreed"));
      logEvent("fearGreed", "warn", t("fetchFailFearGreed"));
    }
  }, [fetchFearGreed, t, fetchWithCache, updateApiHealth, logEvent, isAbortError]);

  const loadOHLC = useCallback(async (signal) => {
    const pair = resolveProviderSymbol("kraken") || resolveProviderSymbol(selectedMarket.defaultProvider) || selectedMarket.id;
    const intervalMinutes = Number(timeFrame) || 60;
    const binanceSymbol = (resolveProviderSymbol("binance") || resolveProviderSymbol(selectedMarket.defaultProvider) || `${selectedMarket.id}`).toUpperCase();
    const cacheKey = `ohlc:multi:${selectedMarket.id}:${pair}:${binanceSymbol}:${intervalMinutes}`;
    const primaryProviderKey = resolveProviderSymbol("kraken") ? "kraken" : selectedMarket.defaultProvider || "kraken";
    try {
      const candles = await fetchWithCache(
        cacheKey,
        async (fetchSignal) => {
          const loaded = await loadChart(
            { assetId: selectedMarket.id, pair, binanceSymbol, interval: intervalMinutes, limit: 200 },
            {
              timeoutMs: 5000,
              retries: 0,
              signal: fetchSignal,
              abortKey: `ohlc:${selectedMarket.id}:${intervalMinutes}`,
              onHealthUpdate: updateApiHealth,
              onLog: logEvent,
              uiLevel: "status",
            }
          );
          if (!loaded || loaded.length < 5) {
            throw new Error("chart loader empty");
          }
          return loaded;
        },
        OHLC_CACHE_TTL,
        signal
      );
      if (signal?.aborted) return;
      setOhlcv(decorateCandles(candles, intervalMinutes));
      setLastError("");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Chart load failed", err);
      setLastError((prev) => prev || t("fetchFailOHLC"));
      updateApiHealth(primaryProviderKey, "error", err?.message);
      logEvent("ohlcv", "error", err?.message || "chart loader failed");
      setOhlcv(fallbackSeries);
    }
  }, [timeFrame, selectedMarket, t, decorateCandles, fetchWithCache, logEvent, resolveProviderSymbol, updateApiHealth, fallbackSeries, isAbortError]);

  const loadHTF = useCallback(async (signal) => {
    if (!hasProAccess) {
      setHtfOhlcv({ h4: [], d1: [] });
      updateApiHealth("MARKET_HTF_PRIMARY", "degraded", "Tier required");
      return;
    }
    try {
      const data = await fetchWithCache(
        `htf:${selectedMarket.id}`,
        (fetchSignal) => fetchHtfOhlc(selectedMarket.id, updateApiHealth, logEvent, addToast, fetchSignal),
        CACHE_TTL,
        signal
      );
      if (signal?.aborted) return;
      setHtfOhlcv(data);
      const hasData = (data?.h4?.length || data?.d1?.length) ? "ok" : "degraded";
      updateApiHealth("MARKET_HTF_PRIMARY", hasData, hasData === "ok" ? "" : "HTF data empty");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("HTF fetch failed", err);
      updateApiHealth("MARKET_HTF_PRIMARY", "error", err.message);
      logEvent("MARKET_HTF_PRIMARY", "error", err.message);
    }
  }, [hasProAccess, selectedMarket.id, updateApiHealth, logEvent, addToast, fetchWithCache, isAbortError]);

  const resolveDerivativesSymbol = (cc) => `DERIBIT_PERPETUAL_${(cc || "").toUpperCase()}_USD`;

  const loadDerivatives = useCallback(async (signal) => {
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
      const res = await fetchWithCache(
        `derivatives:${symbolId}:${selectedMarket.id}`,
        (fetchSignal) => fetchDerivativesLive(symbolId, updateApiHealth, logEvent, addToast, fetchSignal),
        CACHE_TTL,
        signal
      );
      if (signal?.aborted) return;
      setDerivativesRisk(res);
      const status = res?.riskLevel ? "ok" : "degraded";
      updateApiHealth("DERIVATIVES_PRIMARY", status);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Derivatives fetch failed", err);
      updateApiHealth("DERIVATIVES_PRIMARY", "error", err.message);
      logEvent("DERIVATIVES_PRIMARY", "error", err.message);
    }
  }, [hasProAccess, selectedMarket, updateApiHealth, logEvent, addToast, fetchWithCache, isAbortError]);

  const refreshAll = useCallback(async (signal) => {
    if (signal?.aborted) return;
    setIsRefreshing(true);
    await Promise.allSettled([
      loadPrice(signal),
      loadFearGreed(signal),
      loadOHLC(signal),
      loadHTF(signal),
      loadDerivatives(signal),
      loadVolatility(signal),
    ]);
    if (signal?.aborted) return;
    setIsRefreshing(false);
  }, [loadPrice, loadFearGreed, loadOHLC, loadHTF, loadDerivatives, loadVolatility]);

  const fetchEtfNewsProxy = useCallback(async (signal) => {
    const response = await safeFetch(`/api/etf/news?limit=8`, {
      serviceName: "ETF_PROXY_NEWS",
      timeoutMs: 10000,
      retries: 0,
      signal,
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
  }, [logEvent, relayProxyHealth, updateApiHealth]);

  const loadEtfNews = useCallback(async (signal) => {
    setEtfLoading(true);
    try {
      const items = await fetchWithCache("news:etf:proxy", fetchEtfNewsProxy, CACHE_TTL, signal);
      if (signal?.aborted) return;
      setEtfNews(Array.isArray(items) ? items : []);
      setEtfError("");
      updateApiHealth("ETFNEWS", items.length ? "ok" : "degraded");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("ETF news failed", err);
      setEtfError(t("fetchFailETF"));
      logEvent("etfNews", "warn", t("fetchFailETF"));
      updateApiHealth("ETFNEWS", "error", err?.message);
    } finally {
      if (!signal?.aborted) {
        setEtfLoading(false);
      }
    }
  }, [t, updateApiHealth, logEvent, fetchWithCache, fetchEtfNewsProxy, isAbortError]);

  const fetchEtfFlows = useCallback(async (symbols = etfSelection, signal) => {
    const params = new URLSearchParams();
    if (symbols?.length) params.set("symbols", symbols.join(","));
    const query = params.toString();
    const url = query ? `/api/etf/flows?${query}` : "/api/etf/flows";
    const response = await safeFetch(url, {
      serviceName: "ETF_PROXY_FLOWS_CARD",
      timeoutMs: 10000,
      retries: 0,
      signal,
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
  }, [addToast, etfSelection, logEvent, relayProxyHealth, updateApiHealth]);

  const loadEtfFlows = useCallback(async (signal) => {
    const symbols = Array.isArray(etfSelection) && etfSelection.length ? [...etfSelection] : undefined;
    const cacheKey = `flows:etf:${symbols?.join(",") || "default"}`;
    try {
      const rows = await fetchWithCache(cacheKey, (fetchSignal) => fetchEtfFlows(symbols, fetchSignal), CACHE_TTL, signal);
      if (signal?.aborted) return;
      setEtfFlows(rows);
      setEtfFlowsError("");
      updateApiHealth("ETFFLOWS", rows.length ? "ok" : "degraded");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("ETF flows failed", err);
      setEtfFlows([]);
      setEtfFlowsError(t("fetchFailETFFlows"));
      logEvent("etfFlows", "warn", t("fetchFailETFFlows"));
      updateApiHealth("ETFFLOWS", "error", err?.message);
    }
  }, [etfSelection, t, updateApiHealth, logEvent, fetchWithCache, fetchEtfFlows, isAbortError]);

  const loadEtfFlowData = useCallback(async (symbols = etfSelection, signal) => {
    if (!symbols?.length) {
      setEtfFlowSeries([]);
      return;
    }
    setEtfAumLoading(true);
    try {
      const data = await fetchEtfFlowSeriesLive(symbols, updateApiHealth, undefined, signal);
      if (signal?.aborted) return;
      setEtfFlowSeries(data);
      setEtfLastUpdated(new Date().toISOString());
      setEtfAumError("");
      updateApiHealth("ETF_FLOWS_FMP", data.length ? "ok" : "degraded");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("ETF flows failed", err);
      setEtfFlowSeries([]);
      setEtfAumError("Daten derzeit nicht verfuegbar");
      updateApiHealth("etfFlows", "error", err.message);
    } finally {
      if (!signal?.aborted) {
        setEtfAumLoading(false);
      }
    }
  }, [etfSelection, updateApiHealth, isAbortError]);

  const loadEtfHoldingsData = useCallback(async (symbols = etfSelection, signal) => {
    if (!symbols?.length) {
      setEtfHoldings([]);
      return;
    }
    setEtfHoldingsLoading(true);
    try {
      const data = await fetchEtfHoldingsLive(symbols, updateApiHealth, undefined, signal);
      if (signal?.aborted) return;
      setEtfHoldings(data);
      setEtfHoldingsError("");
      setEtfHoldingsLastUpdated(new Date().toISOString());
      updateApiHealth("ETF_HOLDINGS_FMP", data.length ? "ok" : "degraded");
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("ETF holdings failed", err);
      setEtfHoldings([]);
      setEtfHoldingsError("Daten derzeit nicht verfuegbar");
      updateApiHealth("ETF_HOLDINGS_FMP", "error", err.message);
    } finally {
      if (!signal?.aborted) {
        setEtfHoldingsLoading(false);
      }
    }
  }, [etfSelection, updateApiHealth, isAbortError]);

  const apiCheckers = useMemo(() => createApiCheckers(), []);

  const loadApiPlaybook = useCallback(async (signal) => {
    if (signal?.aborted) return;
    setApiStatuses((prev) =>
      API_SOURCES.reduce((acc, cur) => {
        acc[cur.name] = prev[cur.name] || { state: "idle", note: "" };
        return acc;
      }, {})
    );
    const results = await Promise.all(
      apiCheckers.map(async (c) => {
        try {
          const value = await fetchWithCache(`apicheck:${c.key}`, c.run, CACHE_TTL, signal);
          return { name: c.name, state: "ok", note: value?.detail || t("reachable"), data: value?.data || "" };
        } catch (err) {
          if (isAbortError(err)) return null;
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
    if (signal?.aborted) return;
    const mapped = results.filter(Boolean).reduce((acc, r) => {
      acc[r.name] = { state: r.state, note: r.note, data: r.data || "" };
      return acc;
    }, {});
    setApiStatuses((prev) => ({ ...prev, ...mapped }));
  }, [apiCheckers, t, fetchWithCache, isAbortError]);

  useEffect(() => {
    const controller = new AbortController();
    refreshAll(controller.signal);
    // Polling fuer Preis und Fear & Greed Index alle 30 Sekunden
    pollTimer.current = setInterval(() => {
      loadPrice(controller.signal);
      loadFearGreed(controller.signal); // Fear & Greed auch im Polling-Intervall aktualisieren
    }, POLL_INTERVAL);
    return () => {
      controller.abort();
      clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadEtfNews(controller.signal);
    newsTimer.current = setInterval(() => loadEtfNews(controller.signal), NEWS_REFRESH);
    return () => {
      controller.abort();
      clearInterval(newsTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadEtfFlows(controller.signal);
    if (flowsTimer.current) clearInterval(flowsTimer.current);
    flowsTimer.current = setInterval(() => loadEtfFlows(controller.signal), FLOWS_REFRESH);
    return () => {
      controller.abort();
      if (flowsTimer.current) {
        clearInterval(flowsTimer.current);
        flowsTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    const controller = new AbortController();
    const ETF_REFRESH = 240000;
    loadEtfFlowData(etfSelection, controller.signal);
    const timer = setInterval(() => loadEtfFlowData(etfSelection, controller.signal), ETF_REFRESH);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    const controller = new AbortController();
    const HOLDING_REFRESH = 300000;
    loadEtfHoldingsData(etfSelection, controller.signal);
    const timer = setInterval(() => loadEtfHoldingsData(etfSelection, controller.signal), HOLDING_REFRESH);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etfSelection]);

  useEffect(() => {
    const controller = new AbortController();
    loadApiPlaybook(controller.signal);
    return () => controller.abort();
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
        .catch(() => { })
        .finally(() => clearTimeout(timer));
    } else {
      clearTimeout(timer);
    }
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
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

    // Email validation
    const email = authForm.email?.trim() || "";
    const password = authForm.password || "";

    if (!email) {
      setAuthError(lang === "de" ? "Bitte E-Mail eingeben" : "Please enter email");
      return;
    }

    if (!password) {
      setAuthError(lang === "de" ? "Bitte Passwort eingeben" : "Please enter password");
      return;
    }

    if (!auth) {
      setAuthError("Firebase nicht konfiguriert");
      return;
    }

    try {
      await fbLogin(email, password);
    } catch (err) {
      // Translate Firebase error messages
      let errorMsg = err?.message || "Login fehlgeschlagen";
      if (errorMsg.includes("user-not-found")) {
        errorMsg = lang === "de" ? "Benutzer nicht gefunden" : "User not found";
      } else if (errorMsg.includes("wrong-password") || errorMsg.includes("invalid-credential")) {
        errorMsg = lang === "de" ? "Falsches Passwort" : "Wrong password";
      } else if (errorMsg.includes("invalid-email")) {
        errorMsg = lang === "de" ? "Ungültige E-Mail-Adresse" : "Invalid email address";
      } else if (errorMsg.includes("too-many-requests")) {
        errorMsg = lang === "de" ? "Zu viele Versuche. Bitte später erneut versuchen." : "Too many attempts. Please try again later.";
      }
      setAuthError(errorMsg);
    }
  };

  const handleSignup = async () => {
    setAuthError("");

    // Email validation
    const email = authForm.email?.trim() || "";
    const password = authForm.password || "";

    if (!email) {
      setAuthError(lang === "de" ? "Bitte E-Mail eingeben" : "Please enter email");
      return;
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError(lang === "de" ? "Ungültiges E-Mail-Format" : "Invalid email format");
      return;
    }

    if (!password || password.length < 6) {
      setAuthError(lang === "de" ? "Passwort muss mindestens 6 Zeichen haben" : "Password must be at least 6 characters");
      return;
    }

    if (!auth) {
      setAuthError("Firebase nicht konfiguriert");
      return;
    }

    try {
      await fbSignup(email, password);
      const signupMsg =
        lang === "de"
          ? "✅ Signup erfolgreich! Du bist jetzt eingeloggt."
          : "✅ Signup complete! You are now logged in.";
      setSaveTierMessage(signupMsg);
      setTimeout(() => setSaveTierMessage(""), 3000);
    } catch (err) {
      // Translate Firebase error messages
      let errorMsg = err?.message || "Signup fehlgeschlagen";
      if (errorMsg.includes("email-already-in-use")) {
        errorMsg = lang === "de" ? "Diese E-Mail ist bereits registriert" : "This email is already registered";
      } else if (errorMsg.includes("weak-password")) {
        errorMsg = lang === "de" ? "Passwort zu schwach" : "Password too weak";
      } else if (errorMsg.includes("invalid-email")) {
        errorMsg = lang === "de" ? "Ungültige E-Mail-Adresse" : "Invalid email address";
      }
      setAuthError(errorMsg);
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
    // First check local storage - if trial was used on this device, block it
    if (localTrialUsed) {
      addToast(
        lang === "de"
          ? "Der Trial wurde bereits auf diesem Gerät verwendet. Upgrade auf Elite für vollen Zugang."
          : "Trial was already used on this device. Upgrade to Elite for full access.",
        "warn",
        { allowInfoWarn: true }
      );
      return;
    }

    // User must be logged in to start trial
    if (!auth?.currentUser) {
      setShowAuthModal(true);
      addToast(
        lang === "de"
          ? "Bitte melde dich an, um den 7-Tage Elite-Trial zu starten."
          : "Please sign in to start your 7-day Elite trial.",
        "info",
        { allowInfoWarn: true }
      );
      return;
    }

    // Check if trial was already used (Firebase check)
    if (trialUsed) {
      // Mark locally too to prevent future attempts
      localStorage.setItem("elite-trial-used", "true");
      setLocalTrialUsed(true);
      addToast(
        lang === "de"
          ? "Du hast den Trial bereits verwendet. Upgrade auf Elite für vollen Zugang."
          : "You already used your trial. Upgrade to Elite for full access.",
        "warn",
        { allowInfoWarn: true }
      );
      return;
    }

    try {
      const result = await startUserTrial(auth.currentUser.uid);
      if (result.ok) {
        // Mark trial as used locally to prevent reactivation
        localStorage.setItem("elite-trial-used", "true");
        setLocalTrialUsed(true);
        await refreshUserTier();
        addToast(
          lang === "de"
            ? "🎉 Elite-Trial gestartet! 7 Tage voller Zugang."
            : "🎉 Elite trial started! 7 days of full access.",
          "info",
          { allowInfoWarn: true }
        );
      } else if (result.reason === "TRIAL_ALREADY_USED") {
        // Mark locally too
        localStorage.setItem("elite-trial-used", "true");
        setLocalTrialUsed(true);
        addToast(
          lang === "de"
            ? "Du hast den Trial bereits verwendet."
            : "You already used your trial.",
          "warn",
          { allowInfoWarn: true }
        );
      }
    } catch (err) {
      console.error("Start trial failed:", err);
      addToast(
        lang === "de" ? "Trial konnte nicht gestartet werden." : "Could not start trial.",
        "error"
      );
    }
  };

  // Open Auth Modal handler
  const openAuthModal = () => setShowAuthModal(true);
  const closeAuthModal = () => setShowAuthModal(false);

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
    await refreshUserTier();
    closeAuthModal();
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
    const controller = new AbortController();
    loadOHLC(controller.signal);
    return () => controller.abort();
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
    const binanceSymbol = resolveProviderSymbol("binance");
    const isCryptoAsset = selectedMarket.assetClass === "crypto";
    connectPrice({
      assetId: selectedMarket.id,
      binanceSymbol,
      isCrypto: isCryptoAsset,
      onHealthUpdate: updateApiHealth,
      onLog: logEvent,
      onFallbackPoll: loadPrice,
      resetOnConnect: true,
    });
    return () => {
      disconnectPrice(selectedMarket.id);
    };
  }, [selectedMarket.id, selectedMarket.assetClass, connectPrice, disconnectPrice, loadPrice, logEvent, updateApiHealth, resolveProviderSymbol]);
  const candles = useMemo(() => {
    if (!ohlcv.length) return [];
    if (!livePrice || !Number.isFinite(livePrice)) return ohlcv;
    
    const lastCandle = ohlcv[ohlcv.length - 1];
    const updatedLast = {
      ...lastCandle,
      close: livePrice,
      high: Math.max(lastCandle.high, livePrice),
      low: Math.min(lastCandle.low, livePrice),
    };
    
    return [...ohlcv.slice(0, -1), updatedLast];
  }, [ohlcv, livePrice]);
  const indicatorSeries = useMemo(() => {
    if (!candles.length) return [];
    const closes = candles.map((c) => c.close);
    const rsi = calculateRSISeries(closes, 14);
    const macd = calculateMACDSeries(closes, 12, 26, 9);
    const boll = calculateBollingerBands(closes, 20, 2);
    const stochRsi = calculateStochRSI(closes, 14, 3, 3);
    const stochPrice = calculateStochOsc(candles, 14, 3, 3);
    const cci = calculateCCI(candles, 20);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const atr = calculateATR(candles, 14);
    const donchian = calculateDonchian(candles, 20);
    const vwap = calculateVWAP(candles);
    const obv = calculateOBV(candles);
    const maxVol = Math.max(...candles.map((c) => c.volume || 0), 1);
    const adx = calculateADX(candles, 14);
    return candles.map((row, idx) => ({
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
  }, [candles]);

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

  const lastPoint = useMemo(() => (indicatorSeries.length > 0 ? indicatorSeries[indicatorSeries.length - 1] : null), [indicatorSeries]);

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
    const confidence = Number(
      safeFixed(Number((confidenceParts.reduce((a, b) => a + b, 0) / confidenceParts.length) * 0.9 + 0.1) || 0, 2)
    );
    return {
      label,
      color,
      intent,
      confidence,
      detail: `EMA200 ${emaBias !== null ? safeFixed(Number(emaBias * 100) || 0, 2) + "%" : "-"} | ADX ${
        adxVal ? safeFixed(Number(adxVal) || 0, 2) : "-"
      } | BBW ${bbWidth ? safeFixed(Number(bbWidth) || 0, 2) + "%" : "-"
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
      dominance: safeFixed(Number(dominance) || 0, 2),
      imbalance: safeFixed(Number(Math.abs(50 - dominance)) || 0, 2),
      tone,
    };
  }, [trades]);

  const [onChainMetrics, setOnChainMetrics] = useState({ active: null, supplyWhales: null, supplyRetail: null, updatedAt: null });
  const [sentimentMetrics, setSentimentMetrics] = useState({ score: null, label: "Social Score", updatedAt: null });
  const [correlations, setCorrelations] = useState([]);
  const [fundingRates, setFundingRates] = useState([]);
  const [derivativesRisk, setDerivativesRisk] = useState({ score: null, riskLevel: "neutral", updatedAt: null });

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    (async () => {
      try {
        const [onchain, sentiment, corr, funding] = await Promise.all([
          cryptoDataService.fetchOnChainMetrics(updateApiHealth, logEvent, addToast, controller.signal),
          cryptoDataService.fetchSentiment(updateApiHealth, logEvent, addToast, controller.signal),
          cryptoDataService.fetchCorrelation(updateApiHealth, logEvent, addToast, ["bitcoin", "ethereum", "solana", "ripple"], controller.signal),
          cryptoDataService.fetchFundingRates(updateApiHealth, logEvent, addToast, ["BTCUSDT", "ETHUSDT", "SOLUSDT"], controller.signal),
        ]);
        if (!mounted || controller.signal.aborted) return;
        setOnChainMetrics(onchain);
        setSentimentMetrics(sentiment);
        setCorrelations(corr);
        setFundingRates(funding);
        updateApiHealth("glassnode", "ok");
        updateApiHealth("santiment", "ok");
        updateApiHealth("coingecko", "ok");
        updateApiHealth("binance", "ok");
      } catch (err) {
        if (isAbortError(err)) return;
        console.error("Market analytics failed", err);
      }
    })();
    return () => {
      mounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiSignal = useMemo(() => {
    // Use V4 signal builder with volatility integration for improved win-rate
    return buildAISignalV4({
      indicatorSeries,
      indicators,
      displayPrice,
      sentimentScore: sentimentMetrics?.score,
      volatilityData, // NEW: Pass volatility data for adaptive signals
    });
  }, [indicatorSeries, indicators, displayPrice, volatilityData, sentimentMetrics?.score]);

  const visionSignal = useMemo(() => {
    return calculateVisionSignal({
      indicatorSeries,
      indicators,
      displayPrice,
      fearGreedValue: fearGreed?.value,
    });
  }, [indicatorSeries, indicators, displayPrice, fearGreed?.value]);

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
    // Use V4 with volatility integration for improved win-rate
    const baseSignal =
      buildSignalsV4({
        indicatorSeries,
        marketRegime,
        smartMoney,
        sentimentMetrics,
        backtestStats: enrichedBacktest,
        htfRegime,
        derivativesRisk,
        volatilityData, // NEW: Volatility-aware signal generation
      }) || defaultSignal;
    const predictorStrong = aiPredict?.trend === "bullish" && (aiPredict?.confidence ?? 0) >= 70;
    const predictorNeutral = (aiPredict?.confidence ?? 0) < 60 || aiPredict?.trend === "neutral";
    if (baseSignal?.action && predictorNeutral && baseSignal.action !== "wait") {
      return {
        ...baseSignal,
        action: "wait",
        reason:
          lang === "de"
            ? "AI Predictor (4h) neutral/geringe Sicherheit - wir warten."
            : "AI predictor (4h) neutral/low confidence - waiting.",
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
    volatilityData, // NEW: Volatility dependency
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
    tp: aiSignal?.tp,
    sl: aiSignal?.sl,
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
    aiSignal?.tp,
    aiSignal?.sl,
  ]);

  // backtestStats handled via state setter to avoid duplicate declarations

  const addJournalEntry = () => {
    const date = journalForm.date || new Date().toISOString().slice(0, 10);
    if (!journalForm.note.trim()) return;
    const entry = { date, mood: journalForm.mood, note: journalForm.note.trim(), ts: Date.now() };
    setJournalEntries((prev) => [entry, ...prev].slice(0, 50));
    setJournalForm((p) => ({ ...p, note: "" }));
  };

  if (tierLoading) {
    return <FullScreenLoader message="Session wird geladen..." />;
  }
  const showTrialBanner = isTrialActive && authUser;
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden overflow-y-auto overscroll-contain touch-pan-y">
      {/* Welcome Modal for new users */}
      <WelcomeModal />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onLogin={async (email, password) => {
          await fbLogin(email, password);
          await refreshUserTier();
        }}
        onSignup={async (email, password) => {
          await fbSignup(email, password);
          await refreshUserTier();
        }}
        onGoogleSignIn={handleGoogleSignIn}
        lang={lang}
      />

      {showTrialBanner ? (
        <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-amber-500/20 border-b border-amber-500/40 text-amber-100 text-sm px-4 py-2 text-center">
          <span className="font-semibold">🎉 Elite Trial aktiv!</span> {trialRemainingDays} Tage verbleiben (bis {trialEnd || "-"})
        </div>
      ) : null}
      {toasts.length > 0 ? (
        <div className="fixed right-3 left-3 top-16 md:left-auto md:top-4 md:right-4 z-50 space-y-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2 shadow-lg ${t.type === "warn"
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
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <DashboardLayout
        desktop={
          <div className="flex flex-col gap-4">
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <Link
                  to="/"
                  className="flex items-center gap-2 text-xs uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                >
                  <VisionAILogo className="h-5 w-5" />
                  {APP_BRAND}
                </Link>
                <h1 className="text-3xl font-bold text-slate-50">Crypto Risk Manager</h1>
                <p className="text-sm text-slate-400">{t("heroSubtitle")}</p>
                {/* Navigation Links */}
                <nav className="flex items-center gap-4 mt-2">
                  <Link to="/" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-100 bg-slate-800/70 hover:text-cyan-200 hover:bg-slate-800 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v12M6 12h12" />
                    </svg>
                    Market
                  </Link>
                  <Link to="/signals" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Signals
                  </Link>
                </nav>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedMarket.id}
                  onChange={(e) => {
                    const next = e.target.value || DEFAULT_MARKET_ID;
                    handleAssetChange(next);
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
                  className={`flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-inner shadow-black/30 ${highlightAuthCard ? "ring-2 ring-amber-400/60" : ""
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
                    {authUser ? (
                      <>
                        <button onClick={() => persistTier("basic")} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                          {t("tierBasic")}
                        </button>
                        <button onClick={() => persistTier("pro")} className="rounded bg-emerald-600/80 px-2 py-1 text-[11px] text-emerald-950 hover:bg-emerald-500">
                          {t("tierPro")}
                        </button>
                        <button onClick={() => persistTier("elite")} className="rounded bg-cyan-500/80 px-2 py-1 text-[11px] text-cyan-950 hover:bg-cyan-400">
                          {t("tierElite")}
                        </button>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    {authUser ? (
                      <>
                        <button onClick={() => openStripe(STRIPE_LINKS.customer_portal)} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                          {t("billing")}
                        </button>
                        <button type="button" onClick={handleLogout} className="rounded bg-slate-800 px-2 py-1 text-[11px] hover:bg-slate-700">
                          {t("logout")}
                        </button>
                        {!isTrialActive && !isTrialBlocked ? (
                          <button
                            type="button"
                            onClick={handleStartTrial}
                            className="rounded bg-gradient-to-r from-amber-500 to-amber-600 px-2 py-1 text-[11px] font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 transition-colors"
                          >
                            {t("startTrial")}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={openAuthModal}
                          className="rounded bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-[11px] font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 transition-colors"
                        >
                          {lang === "de" ? "🔐 Anmelden" : "🔐 Sign In"}
                        </button>
                        {!isTrialBlocked && (
                          <button
                            type="button"
                            onClick={handleStartTrial}
                            className="rounded bg-gradient-to-r from-cyan-500 to-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-cyan-950 hover:from-cyan-400 hover:to-cyan-500 transition-colors"
                          >
                            {lang === "de" ? "🎁 7 Tage gratis" : "🎁 7 Days Free"}
                          </button>
                        )}
                      </>
                    )}
                    {authError ? <span className="text-[11px] text-amber-300">{authError}</span> : null}
                    {saveTierMessage ? <span className="text-[11px] text-emerald-300">{saveTierMessage}</span> : null}
                    {trialExpired && trialStart ? (
                      <span className="text-[11px] text-amber-300">
                        {lang === "de" ? "Trial abgelaufen" : "Trial expired"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => setLang((p) => (p === "de" ? "en" : "de"))}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30"
                >
                  {t("langToggle")}
                </button>
                <button
                  onClick={() => {
                    setIsBeginner((prev) => {
                      const next = !prev;
                      localStorage.setItem("mode:beginner", next ? "true" : "false");
                      return next;
                    });
                  }}
                  className={`rounded-xl border px-3 py-2 text-sm shadow-inner shadow-black/30 ${isBeginner ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-100" : "border-slate-700 bg-slate-900 text-slate-100"
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
                      Stand: {new Date(fearGreed.updatedAt).toLocaleTimeString()} | Source: {fearGreed.source || "alternative.me"}
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
                      {indicators.rsi ? safeFixed(Number(indicators.rsi) || 0, 2) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">MACD</span>
                    <span className="font-semibold text-slate-100">
                      {indicators.macd && indicators.signal
                        ? `${safeFixed(Number(indicators.macd - indicators.signal) || 0, 2)} (${safeFixed(Number(indicators.macd) || 0, 2)}/${safeFixed(Number(indicators.signal) || 0, 2)})`
                        : "-"}
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
                <ChartSection
                  selectedAsset={selectedAsset}
                  handleAssetSelect={handleAssetSelect}
                  selectedMarket={selectedMarket}
                  timeFrame={timeFrame}
                  onTimeFrameChange={setTimeFrame}
                  tradingViewSymbol={tradingViewSymbol}
                  t={t}
                  indicatorSeries={indicatorSeries}
                  aiSignal={aiSignal}
                  priceValue={priceState.value}
                  Card={Card}
                  LazyRender={LazyRender}
                  Skeleton={Skeleton}
                  renderLastDot={renderLastDot}
                  formatUSD={formatUSD}
                  variant="desktop"
                />

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
                        <span className="font-semibold text-emerald-300">{backtestStats.winRate ? `${safeFixed(Number(backtestStats.winRate) || 0, 2)}%` : "--"}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Avg R/R</span>
                        <span className="font-semibold text-slate-100">{backtestStats.avgRr ? safeFixed(Number(backtestStats.avgRr) || 0, 2) : "--"}</span>
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
                        {safeFixed(Number(marketRegime.confidence * 100) || 0, 2)}%
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
                            {onChainMetrics.active ? onChainMetrics.active.toLocaleString("en-US") : "--"}
                          </div>
                          <div className="text-xs text-slate-300 leading-tight min-w-[120px] max-w-[140px] space-y-1 break-words">
                            <div className="flex items-center justify-between gap-2">
                              <span>Whales</span>
                              <span className="font-semibold text-slate-100">{safeFixed(Number(onChainMetrics.supplyWhales ?? 0.6 * 100) || 0, 2)}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span>Retail</span>
                              <span className="font-semibold text-slate-100">{safeFixed(Number(onChainMetrics.supplyRetail ?? 0.4 * 100) || 0, 2)}%</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span>Delta</span>
                              <span className="font-semibold text-slate-100">
                                {onChainMetrics.supplyWhales && onChainMetrics.supplyRetail
                                  ? safeFixed(Number((onChainMetrics.supplyWhales - onChainMetrics.supplyRetail) * 100) || 0, 2) + "%"
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
                      {/* New Social Sentiment Card with real-time data */}
                      <SocialSentimentCard
                        onSentimentChange={(newSentiment) => {
                          // Update sentiment metrics for signal calculation
                          if (newSentiment?.combinedScore !== undefined) {
                            setSentimentMetrics(prev => ({
                              ...prev,
                              score: newSentiment.combinedScore,
                              label: newSentiment.combinedLabel,
                              longShortRatio: newSentiment.longShortRatio,
                              topTraderRatio: newSentiment.topTraderLongShortRatio,
                              updatedAt: Date.now(),
                            }));
                          }
                        }}
                        minTier="pro"
                      />
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
                                <div className="text-[10px] text-slate-300 mt-1">Std: {val !== null ? safeFixed(Number(Math.abs(val)) || 0, 2) : "--"}</div>
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
                                  <span className={bullish ? "text-emerald-300" : "text-red-300"}>{safeFixed(Number(pct) || 0, 2)}%</span>
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
                                ? safeFixed(Number((fundingRates.reduce((a, b) => a + (b.rate || 0), 0) / fundingRates.length) * 100) || 0, 2) + "%"
                                : "--"}
                            </span>
                          </div>
                          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-[11px] text-slate-300 flex justify-between">
                            <span>Hourly est.</span>
                            <span className="font-semibold text-slate-100">
                              {fundingRates.length
                                ? safeFixed(Number((fundingRates.reduce((a, b) => a + (b.rate || 0), 0) / fundingRates.length) * 24 * 100) || 0, 2) + "%"
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
                <SignalPanel
                  selectedAssetId={selectedAsset}
                  timeFrame={timeFrame}
                  t={t}
                  lang={lang}
                  effectiveTier={effectiveTier}
                  trialActive={trialActive}
                  trialEnd={trialEnd}
                  trialExpired={trialExpired}
                  showCryptoEduChat={SHOW_CRYPTO_EDU_CHAT}
                  chatContext={chatContext}
                  indicators={indicators}
                  indicatorSeries={indicatorSeries}
                  aiSignal={aiSignal}
                  visionSignal={visionSignal}
                  proSignal={proSignal}
                  backtestStats={backtestStats}
                  volatilityData={volatilityData}
                  loadPrice={loadPrice}
                  loadOHLC={loadOHLC}
                  loadFearGreed={loadFearGreed}
                  lastError={lastError}
                  sourceHealth={sourceHealth}
                  apiHealth={apiHealth}
                  dataSourceList={DATA_SOURCE_LIST}
                  apiSources={getApiSources()}
                  apiStatuses={apiStatuses}
                  loadApiPlaybook={loadApiPlaybook}
                  priceValue={priceState.value}
                  Card={Card}
                  IndicatorBadge={IndicatorBadge}
                  Paywall={Paywall}
                  formatUSD={formatUSD}
                />
                <RiskTerminal selectedAssetId={selectedAsset} balance={DEFAULT_BALANCE} />
              </div>
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
            <div className="mt-4">
              <Card title={t("diary")} icon={TrendingUp} actions={<span className="text-xs text-slate-400">Memory &amp; Notes</span>}>
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
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${e.mood === "Confident"
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
              <ResearchCenter
                t={t}
                etfSelection={etfSelection}
                setEtfSelection={setEtfSelection}
                etfFlowSeries={etfFlowSeries}
                etfAumLoading={etfAumLoading}
                etfAumError={etfAumError}
                etfLastUpdated={etfLastUpdated}
                etfHoldings={etfHoldings}
                etfHoldingsLoading={etfHoldingsLoading}
                etfHoldingsError={etfHoldingsError}
                etfHoldingsLastUpdated={etfHoldingsLastUpdated}
                etfFlows={etfFlows}
                etfFlowsError={etfFlowsError}
                etfNews={etfNews}
                etfLoading={etfLoading}
                etfError={etfError}
                updateApiHealth={updateApiHealth}
                Card={Card}
                LazyRender={LazyRender}
                Skeleton={Skeleton}
                formatUSD={formatUSD}
              />
            </div>
          </div>
        }
        mobile={
          <>
            <header className="space-y-3">
              <div className="space-y-1">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-200 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                >
                  <VisionAILogo className="h-4 w-4" />
                  {APP_BRAND}
                </Link>
                <h1 className="text-2xl font-bold text-slate-50">Crypto Risk Manager</h1>
                <p className="text-sm text-slate-400">{t("heroSubtitle")}</p>
                {/* Mobile Navigation Links */}
                <nav className="flex items-center gap-3 mt-2">
                  <Link to="/" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-100 bg-slate-800/70 hover:text-cyan-200 hover:bg-slate-800 transition-colors">
                    Market
                  </Link>
                  <Link to="/signals" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-cyan-400 hover:bg-slate-800/50 transition-colors">
                    Signals
                  </Link>
                </nav>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={selectedMarket.id}
                  onChange={(e) => {
                    const next = e.target.value || DEFAULT_MARKET_ID;
                    handleAssetChange(next);
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
                  {authUser ? (
                    <>
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
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={handleLogout} className="rounded bg-slate-800 px-3 py-2 text-xs hover:bg-slate-700">
                          {t("logout")}
                        </button>
                        {!isTrialActive && !isTrialBlocked ? (
                          <button
                            type="button"
                            onClick={handleStartTrial}
                            className="rounded bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-2 text-xs font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 transition-colors"
                          >
                            {t("startTrial")}
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-slate-400 text-center">
                        {lang === "de"
                          ? "Melde dich an, um alle Features zu nutzen und den Elite-Trial zu starten."
                          : "Sign in to access all features and start your Elite trial."}
                      </p>
                      <button
                        type="button"
                        onClick={openAuthModal}
                        className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-sm font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 transition-colors"
                      >
                        {lang === "de" ? "🔐 Anmelden / Registrieren" : "🔐 Sign In / Sign Up"}
                      </button>
                      {!isTrialBlocked && (
                        <button
                          type="button"
                          onClick={handleStartTrial}
                          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-3 text-sm font-semibold text-cyan-950 hover:from-cyan-400 hover:to-cyan-500 transition-colors"
                        >
                          {lang === "de" ? "🎁 7 Tage Elite gratis testen" : "🎁 Try 7 Days Elite Free"}
                        </button>
                      )}
                    </div>
                  )}
                  {authError ? <span className="text-[11px] text-amber-300">{authError}</span> : null}
                  {saveTierMessage ? <span className="text-[11px] text-emerald-300">{saveTierMessage}</span> : null}
                  {trialExpired && trialStart ? (
                    <span className="text-[11px] text-amber-300">
                      {lang === "de" ? "Trial abgelaufen. Upgrade für vollen Zugang." : "Trial expired. Upgrade for full access."}
                    </span>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-5 gap-2 text-[12px]">
              {[
                { key: "overview", label: "Overview" },
                { key: "charts", label: "Charts" },
                { key: "signals", label: "Signals" },
                { key: "risk", label: "Risk" },
                { key: "research", label: "Research" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setMobileTab(tab.key)}
                  className={`rounded-xl px-3 py-2 font-semibold transition ${mobileTab === tab.key ? "bg-emerald-500 text-emerald-950" : "bg-slate-800 text-slate-200"
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
                            Stand: {new Date(fearGreed.updatedAt).toLocaleTimeString()} | Source: {fearGreed.source || "alternative.me"}
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
                            {indicators.rsi ? safeFixed(Number(indicators.rsi) || 0, 2) : "-"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">MACD</span>
                          <span className="font-semibold text-slate-100">
                            {indicators.macd && indicators.signal
                              ? `${safeFixed(Number(indicators.macd - indicators.signal) || 0, 2)} (${safeFixed(Number(indicators.macd) || 0, 2)}/${safeFixed(Number(indicators.signal) || 0, 2)})`
                              : "-"}
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
                <ChartSection
                  selectedAsset={selectedAsset}
                  handleAssetSelect={handleAssetSelect}
                  selectedMarket={selectedMarket}
                  timeFrame={timeFrame}
                  onTimeFrameChange={setTimeFrame}
                  tradingViewSymbol={tradingViewSymbol}
                  t={t}
                  indicatorSeries={indicatorSeries}
                  aiSignal={aiSignal}
                  priceValue={priceState.value}
                  Card={Card}
                  LazyRender={LazyRender}
                  Skeleton={Skeleton}
                  renderLastDot={renderLastDot}
                  formatUSD={formatUSD}
                  variant="mobile"
                />
              ) : null}
              {mobileTab === "signals" ? (
                <SignalPanel
                  selectedAssetId={selectedAsset}
                  timeFrame={timeFrame}
                  t={t}
                  lang={lang}
                  effectiveTier={effectiveTier}
                  trialActive={trialActive}
                  trialEnd={trialEnd}
                  trialExpired={trialExpired}
                  showCryptoEduChat={SHOW_CRYPTO_EDU_CHAT}
                  chatContext={chatContext}
                  indicators={indicators}
                  indicatorSeries={indicatorSeries}
                  aiSignal={aiSignal}
                  visionSignal={visionSignal}
                  proSignal={proSignal}
                  backtestStats={backtestStats}
                  volatilityData={volatilityData}
                  loadPrice={loadPrice}
                  loadOHLC={loadOHLC}
                  loadFearGreed={loadFearGreed}
                  lastError={lastError}
                  sourceHealth={sourceHealth}
                  apiHealth={apiHealth}
                  dataSourceList={DATA_SOURCE_LIST}
                  apiSources={getApiSources()}
                  apiStatuses={apiStatuses}
                  loadApiPlaybook={loadApiPlaybook}
                  priceValue={priceState.value}
                  Card={Card}
                  IndicatorBadge={IndicatorBadge}
                  Paywall={Paywall}
                  formatUSD={formatUSD}
                />
              ) : null}
              {mobileTab === "risk" ? (
                <RiskTerminal selectedAssetId={selectedAsset} balance={DEFAULT_BALANCE} />
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
                          {onChainMetrics.active ? onChainMetrics.active.toLocaleString("en-US") : "--"}
                        </div>
                        <div className="text-xs text-slate-300 leading-tight min-w-[120px] max-w-[160px] space-y-1 break-words">
                          <div className="flex items-center justify-between gap-2">
                            <span>Whales</span>
                            <span className="font-semibold text-slate-100">{safeFixed(Number(onChainMetrics.supplyWhales ?? 0.6 * 100) || 0, 2)}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>Retail</span>
                            <span className="font-semibold text-slate-100">{safeFixed(Number(onChainMetrics.supplyRetail ?? 0.4 * 100) || 0, 2)}%</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span>Delta</span>
                            <span className="font-semibold text-slate-100">
                              {onChainMetrics.supplyWhales && onChainMetrics.supplyRetail
                                ? safeFixed(Number((onChainMetrics.supplyWhales - onChainMetrics.supplyRetail) * 100) || 0, 2) + "%"
                                : "--"}
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

                  <ResearchCenter
                    t={t}
                    etfSelection={etfSelection}
                    setEtfSelection={setEtfSelection}
                    etfFlowSeries={etfFlowSeries}
                    etfAumLoading={etfAumLoading}
                    etfAumError={etfAumError}
                    etfLastUpdated={etfLastUpdated}
                    etfHoldings={etfHoldings}
                    etfHoldingsLoading={etfHoldingsLoading}
                    etfHoldingsError={etfHoldingsError}
                    etfHoldingsLastUpdated={etfHoldingsLastUpdated}
                    etfFlows={etfFlows}
                    etfFlowsError={etfFlowsError}
                    etfNews={etfNews}
                    etfLoading={etfLoading}
                    etfError={etfError}
                    updateApiHealth={updateApiHealth}
                    Card={Card}
                    LazyRender={LazyRender}
                    Skeleton={Skeleton}
                    formatUSD={formatUSD}
                  />

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
                                  <span className={`text-xs font-semibold ${bullish ? "text-emerald-300" : "text-red-300"}`}>{safeFixed(Number(pct) || 0, 2)}%</span>
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

                </div>
              ) : null}
            </div>
          </>
        }
      />
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

      {/* Footer with Legal Disclaimer */}
      <Footer />
    </div>
  );
}

export default App;
