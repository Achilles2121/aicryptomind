# Vision AI Mind – Trading & ETF Dashboard (Stand Dez 2025)

## Aktuelle Änderungen

- Deployment-Check: neues `vercel.json`, bestätigter `npm run build`, aktualisierte `docs/deploy-guide.md`.
- Investor-README ergänzt (Produktpitch, Architektur, Datenquellen, Tier/Trial-System, Security, Mobile-Story).
- Chart-Loader-Integration WIP: `src/App.jsx` nutzt `loadChart`/`buildFallbackChart`; WS-Rehydration und kürzeres TTL noch offen.
- Backend-Hardening: Express-Proxy (Rate-Limit + Kurzzeit-Cache) mit `/api/indicators` (RSI/MACD/Stoch/ATR/EMA/Trend/SMF) und `/api/derivatives` (CoinAPI Funding/OI Risk Score); `vite.config.js` strikt auf 5175/5176.

## Überblick

- Stack: Vite + React + TypeScript, Tailwind; zentrale App in `src/App.jsx`.
- Data-Layer: `safeFetch` (Timeout/Retry/Health/Logging) + apiHealth-Store.
- Auth/Tier: Firebase (Email/Passwort), Elite-Bypass für `oemeralpay@hotmail.com`; Tier-Context (basic/pro/elite).
- Layout: Desktop unverändert, Mobile Tabs (Overview/Charts/Signals/Research). ETF-Komponenten lazy mit Suspense-Fallbacks.

## Struktur (relevante Elemente)

- `src/App.jsx`: UI, State, Polling, Health, Tabs, Cards, ETF-Integration.
- `src/lib/safeFetch.ts`: zentrale Fetch-Logik.
- `src/stores/apiHealth`: Health-Status inkl. ETF-Keys.
- Services: `etfHoldingsLive.ts`, `etfFlowsLive.ts`, `etfCorrelationLive.ts`, `marketDataLive.ts`, `derivativesLive.ts`.
- Indikatoren/Signale/Backtest: `indicators.ts`, `signalsV2.ts`, `strategyEngineV3.ts`, `backtestV3.js`.
- UI: Cards für Live Price, Indicators, Signals (AI/Pro/V3), System Status, ETF (Holdings/Flows/Correlation/Heatmap), On-Chain, Sentiment, TP/SL-Rechner, CryptoEdu-Chat.

## Datenquellen (live)

- Preise/Trades: Binance WS (Backup Polling), CoinGecko, CryptoCompare.
- OHLC: Kraken (primär), Binance (Fallback), via `/api/ohlc`.
- ETF: Holdings/Flows (FMP → SosoValue → CoinStats), Korrelationen (CG → CryptoCompare → AlphaVantage Demo).
- Derivate: CoinAPI Metrics für Funding/OI (über `/api/derivatives`).
- News (optional): ETFNEWS Store.

## UX/Health

- System-Status-Card zeigt Health aller Provider.
- ETF-Toasts unterdrückt; Status nur in Health-Card.
- Lazy/Suspense für ETF-Cards mit leichten Text-Fallbacks.

## Trial/Tier-Logik

- Trial-Fenster: 7 Tage (siehe `TRIAL_WINDOW_MS` in `src/firebase.js`).
- Während des Trials gilt Tier=Elite; danach nur mit Premium/Elite-Tier, sonst Basic-Limits.
- `useAuthStatus`/`UserTierContext` fangen fehlende `trialStart`-Werte ab, setzen Defaults und vermeiden Crashes.

## Environment / Keys

- `.env.local` / Vercel: `VITE_FMP_KEY`, `VITE_COINAPI_KEY`, Firebase Keys `VITE_FIREBASE_*`.
- Keine Secrets im Code; Zugriff nur via `import.meta.env`.

## Bekannte Einschränkungen / Fehler

- ETF-Fallbacks können degraded/error melden; keine Toasts.
- AlphaVantage Demo limitiert → Korrelationen teils degraded.
- AUM-Delta als Flow-Proxy kann 0-Flows liefern.
- Backtest nutzt approximierte HTF; echte 4h/1d Fetch-Integration noch ausstehend.
- Echtzeit-Feed hängt noch am alten WS/Polling; Cache-Expiry bestimmt Aktualisierung.

## Verbesserungs-Ideen / Nächste Schritte

1) ETF-Datenqualität: zusätzliche Provider/Keys, Caching/Rate-Limit pro Provider.
2) Stabilität/UX: Retry-Limits und „Letzter Erfolg“, bessere Skeletons.
3) Performance: Chunk-Splitting optimieren, weitere Widgets lazy laden.
4) Backtest/Signals: echte HTF-Daten, Equity-Curve/Drawdown/Expectancy in UI.
5) Monitoring: konsolidiertes Logging/Telemetry für Provider-Fehler ohne Toasts.

## Test/Build

- Letzter Build lokal: `npm run build` ✅ (02.12.2025, ~9s, Vite 7.2.4).
- Main ist up to date, Vercel redeployt automatisch nach Push.

## Master Prompt: Crypto Risk Manager (V3 -> V3+)

- Priorität 1: Lookahead-Fix mit echten HTF-Kerzen (Kraken 4h/1d oder CoinAPI), Health-Keys `MARKET_HTF_PRIMARY/FALLBACK`.
- Priorität 2: Derivate-Risikometrics (CoinAPI Funding/OI, Z-Scores, `DerivativesRiskScore` in strategyEngineV3).
- Priorität 3: Backtest-Engine (Equity-Curve, Max Drawdown, Profit Factor, stochastische Slippage).
- Optionale LLM-Integration: Research-Tab via ChainGPT oder OSS LLM + RAG.
