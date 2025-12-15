# System Architecture & Algos (Vision AI Mind / Elite Trader Dashboard)

## Overview
- Multi-Asset Trading Dashboard (Crypto + Indices + Commodities + FX) built with Vite/React + Node/Vercel APIs.
- Layered Architektur:
  - **API-Layer (api/)**: Proxy-/Provider-Adapter für Price/OHLC/ETF/Health mit einheitlichem ApiEnvelope (`ok`, `status`, `statusCode`, `source`, `data`, `hint`, `errors`).
  - **Service-Layer (src/services/)**: Normalisiert Provider-Daten (live OHLC, derivatives, ETF correlations) und meldet Health-Status via `safeFetch`-Callbacks.
  - **Config-Layer (src/config/)**: `markets.ts` als zentrale Registry (AssetClass, providerSymbols, defaultProvider), `dataSources.ts` als Provider/Feature-Toggles.
  - **UI-Layer (src/App.jsx + Components)**: Charts, Indikatoren, Signals, AI Protector, System-Status; Tier/Trial-Handling über Hooks/Firebase.
  - **Trial/Tiers**: `useEliteTrial.ts` (7-Tage-Elite-Trial, localStorage), UserTierContext/Firebase für Basic/Pro/Elite.

## Data Flow & Modules
1) **UI Request** (z. B. BTCUSD OHLC) → Asset-Selector liefert `assetId`.
2) **Market Registry** (`src/config/markets.ts`) → mappt `assetId` auf Provider + Symbols.
3) **API-Routen**:
   - `/api/price` → wählt Provider-Priorität (Binance/Kraken/Coingecko oder offene OHLC-Provider für Non-Crypto), liefert ApiEnvelope.
   - `/api/ohlc` → nimmt `asset`, `interval`, `limit`; mappt auf Provider, liefert StandardizedOhlc[] im ApiEnvelope.
   - `/api/health` → Provider-Probes; ApiEnvelope mit Status/Meta.
   - ETF/News/Correlations: ähnliche Struktur, teilweise mit Health-Propagation.
4) **safeFetch** (`src/lib/safeFetch.ts`) → einheitliches Error-Handling, uiLevel (`silent`/`status`/`toast`), Health-Broadcast.
5) **Services**:
   - `marketDataLive.ts` → HTF/LTF OHLC via API + Open Providers; mappt StandardizedOhlc → UI Series; Health Update.
   - `derivativesLive.ts` → /api/derivatives + Open fallback; Tier-Gating.
   - `etfCorrelationLive.ts` → /api/etf/correlations proxy, Health relay.
6) **Chart/Indicators**:
   - `chartLoader.ts` → versucht Kraken/Binance/Proxy in Reihe; normalisiert OHLC; wirft bei zu wenig Daten, nutzt Fallback-Chart sonst.
   - Indicators werden in App.jsx aus geladenen Candles berechnet (RSI, MACD, Bollinger, etc.).
7) **UI**: Recharts-basiert, AI Protector/Signals konsumieren berechnete Serien; System-Status zeigt Health/Degraded statt Toasts bei Hintergrundfeeds.
8) **Resilience**: Cache TTL (5m) in App.jsx, Polling (30s), WS Binance (nur Crypto) mit Fallback auf Polling; ApiEnvelope verhindert 500-Fehler im UI.

## Multi-Asset Model
- Registry (`src/config/markets.ts`): Felder `id`, `label`, `assetClass`, `defaultProvider`, `providerSymbols`, optional `supportsIntraday`, `base`, `quote`.
- Asset-Classes: `crypto`, `index`, `commodity`, `fx`.
- Provider-Mapping: Crypto (coingecko/binance/kraken/coinapi), Indices via `STOOQ` (^DAX/^SPX/^NDQ/^DJI/^FTSE/^NIKKEI), Commodities/FX via `FX_PROVIDER` (e.g. XAUUSD, EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD).

| Asset | Klasse | Haupt-Quelle(n) | Features | Hinweise |
| --- | --- | --- | --- | --- |
| BTCUSD | Crypto | CoinGecko/Binance/Kraken | OHLC, RSI, MACD, Bollinger, AI Protector/Signals, Backtest V3 | Default, WS-Price (Binance), volle Engine |
| ETHUSD/SOLUSD/... | Crypto | CoinGecko/Binance/Kraken | OHLC, Indikatoren, teils AI/Backtest (gleiches Path wie BTC, Datenabhängig) | Abhängig von Provider-Liquidität |
| DAX (DAX 40) | Index | Stooq (^DAX) | OHLC/Charts; AI/Signals eingeschränkt | Daily; Intraday ggf. degradiert |
| SPX (S&P 500) | Index | Stooq (^SPX) | OHLC/Charts; AI eingeschränkt | Daily |
| NDQ100 (Nasdaq 100) | Index | Stooq (^NDQ) | OHLC/Charts | Daily |
| DJI (Dow Jones) | Index | Stooq (^DJI) | OHLC/Charts | Daily |
| FTSE100 | Index | Stooq (^FTSE) | OHLC/Charts | Daily |
| NIKKEI225 | Index | Stooq (^NIKKEI) | OHLC/Charts | Daily |
| XAUUSD (Gold) | Commodity | FX_PROVIDER (XAUUSD) | OHLC/Charts; Indikatoren begrenzt | Daily; Volumen oft 0 |
| EURUSD/GBPUSD/USDJPY/USDCHF/AUDUSD/USDCAD | FX | FX_PROVIDER (pair) | OHLC/Charts; Indikatoren möglich | Intraday-Support abhängig vom Provider |

## Indicators & Trading Engine
- **RSI**: Standard RSI(14) auf Close-Serie; Δ-Gains/Losses, Wilder-Smoothing.
- **MACD**: EMA(12) – EMA(26); Signal = EMA(9) des MACD; Histogram = MACD - Signal.
- **Bollinger Bands**: SMA(20) mit ±2 * StdDev(20) auf Close.
- **Fib Map / Trade Levels**: High/Low Range der Serie; Levels bei 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0; Darstellung im Chart.
- **Stoch RSI/Stoch Osc/CCI/ATR/ADX/EMA/VWAP/OBV**: Berechnet in `lib/indicators` mit klassischen Formeln.
- **Signals / AI Protector / V3+**:
  - Inputs: Candles + Indikatoren (Trend/Momentum/Vol/OBV/Donchian/Stoch), ggf. derivatives risk, smart money heuristics.
  - Outputs: Heuristische Scores (bullish/bearish/neutral), risk levels, suggested SL/TP (Fib), backtest stats (runBacktestV3).
  - Aktiv: Voll für Crypto (insbes. BTCUSD); andere Assets nutzen gleiche Pipeline, aber fehlende Derivatives/Flows → konservative / degradiert.

## Trial, Tiers & Permissions
- **useEliteTrial.ts**: Clientseitiger 7-Tage-Elite-Trial (localStorage timestamps); nach Ablauf Rückfall auf Basic; kein Server-Persist.
- **Tiers**: Basic/Pro/Elite via Firebase (UserTierContext) + Trial Override.
  - Pro/Elite nötig für HTF (4h/1d) in `marketDataLive`, derivatives, einige cards (LockedCard gating).
  - Basic sieht LTF/Indicators, begrenzte signals.

## Error Handling, HTTP 500 & Health
- **ApiEnvelope**: `ok`, `status` ("ok" | "degraded" | "disabled" | "error"), `statusCode`, `source`, `data`, `hint`, `errors`.
- **safeFetch uiLevel**: `status`/`silent` für Hintergrund-Poller; `toast` nur bei Nutzeraktionen.
- **Schema-Konform**: `/api/price`, `/api/ohlc`, `/api/health` nutzen Envelope + HTTP 200. ETF/others largely follow same pattern; legacy proxies (`api/binance.ts`, some ETF/news routes) may still emit custom shapes but avoid 500.
- **Verbleibende 500-Risiken**:
  - Legacy routes mit `send(res, status, ...)` könnten noch non-200 senden bei harten Fehlern.
  - Some proxies (binance et al.) cache fallback and still respond 200; major 500s largely neutralized.
  - UI uses `safeFetch`; background calls set `uiLevel: "status"` to prevent red toasts; degraded health shown in System Status.

## Fear & Greed Index
- Quelle: `https://api.alternative.me/fng/?limit=1&format=json` (UI fetch in App.jsx, serviceName `fear_greed`).
- Mapping: `value` 0–100, `classification` string, `updatedAt` timestamp*1000, `source: "alternative.me"`.
- Abweichungen zu externen Seiten (CMC/CNN): andere Zeitbasis (tägliches Update), andere Methodik (Krypto vs. Aktien), mögliches Caching.
- Verbesserungsideen: Proxy-Cache mit timestamp, optionale Vergleichsanzeige, alternative Provider (z. B. CMC Fear&Greed) als fallback.

## Validation & Confidence
- **Indikatoren**: Standard-Formeln, hohe Vertrauenswürdigkeit; abhängige auf Close-Serie → Datenqualität der Provider entscheidend.
- **Provider Mapping**: Crypto robust (Coingecko/Binance/Kraken); Indices/FX via Stooq/FX_PROVIDER können leere Volumen liefern → Indikatoren laufen, aber Volumen-basierte Signale eingeschränkt.
- **Engine/Signals**: Heuristisch (winrate/backtest lokal auf geladenem Fenster); hohe Sicherheit bei Berechnung, aber Marktübertragbarkeit begrenzt (insb. Nicht-Crypto).
- **Data Integrity**: ApiEnvelope + safeFetch mindern UI-Crashes; degraded states erwartet bei fehlenden Keys oder leeren Feeds.

## Open Issues & Next Steps
- **HTTP 500**: Prüfen/angleichen verbleibender Routen (ETF/news proxies, binance proxy) auf konsequente ApiEnvelope + HTTP 200. P1.
- **Multi-Asset Gaps**: Derivatives/AI Protector voll nur für Crypto; Indices/FX/Gold ohne derivatives/backtest depth → markieren oder weich abschalten. P1.
- **Data Quality**: Stooq/FX_PROVIDER liefern Daily; Intraday für Indices/FX begrenzt → kennzeichnen oder ergänzen alternative Intraday-Feeds. P2.
- **Performance**: Lint warns on hook deps/unused vars in App.jsx; consider memoizing loaders and tightening deps to reduce re-renders. P2.
- **Observability**: Add lightweight health dashboard or log aggregation for slow requests (`DEBUG_PERF`) to validate latency. P2.
- **Testing**: Add integration smoke tests for `/api/ohlc?asset=BTCUSD`, `/api/price?asset=BTCUSD`, and one index/fx asset to guard envelopes. P2.
