# Vision AI Mind – Trading & ETF Dashboard (Aktueller Stand)

## Überblick
- Vite + React + TypeScript, Tailwind; zentrale App in `src/App.jsx`.
- Data-Layer über `safeFetch` (Timeout/Retry/Health/Logging) und apiHealth-Store.
- Firebase Auth (Email/Passwort), Elite-Bypass für `oemeralpay@hotmail.com`; Tier-Context gated (basic/pro/elite).
- Desktop-Layout bleibt unverändert (md:block), Mobile nutzt Tabs (md:hidden: Overview/Charts/Signals/Research).
- Lazy-Loaded ETF-Komponenten mit `Suspense`-Fallback, keine Layout-Änderungen.

## Struktur (relevante Elemente)
- `src/App.jsx`: UI, State, Polling, Health-Status, Tabs, Cards, ETF-Integration.
- `src/lib/safeFetch.ts`: Fetch mit Timeout/Retry, Health- und Toast-Hooks (unverändert).
- `src/stores/apiHealth`: Health-Status inkl. ETF-Keys (FMP/Soso/Coinstats, Corr Primary/Fallback).
- Services:
  - `src/services/etfHoldingsLive.ts`: Multi-Provider Holdings/AUM (FMP → SosoValue → CoinStats), Health-Updates, keine Toasts.
  - `src/services/etfFlowsLive.ts`: Multi-Provider Flows (FMP-AUM-Delta → SosoValue → CoinStats), 30d-Serie, Health-Updates, keine Toasts.
  - `src/services/etfCorrelationLive.ts`: Korrelationen (CG → CryptoCompare → AlphaVantage Demo), Health-Updates, keine Toasts.
  - Bestehende ETF-Cards: Holdings, Flows, Provider-Quality, Correlation, Heatmap; alle nutzen gleiche Daten/Health.
- Indikatoren/Signale/Backtest:
  - `src/lib/indicators.ts`, `signalsV2.ts`, `strategyEngineV3.ts`, `backtestV3.ts`.
  - V3-Signale + Backtest Snapshot (Fees/Slippage, ATR-basierte TP/SL).
- UI-Komponenten: Cards für Live Price, Fear & Greed, Indicators, Live Market, Fib Map, Bubbles, Signals (AI/Pro/V3), System Status, Manual Controls, On-Chain, Sentiment, TP/SL-Rechner, CryptoEdu-Chat.

## Datenquellen (live)
- Preise/Trades: Binance WS (+ Polling Backup), CoinGecko, CryptoCompare.
- OHLC: Kraken.
- On-Chain/Sentiment: Glassnode, Santiment, Funding (Binance).
- ETF:
  - Holdings/AUM: FMP (primär), SosoValue, CoinStats (Fallbacks).
  - Flows: FMP (AUM-Delta), SosoValue, CoinStats.
  - Korrelationen: CoinGecko (BTC/ETH), CryptoCompare, AlphaVantage Demo (Fallback).
  - Health-Keys: `ETF_HOLDINGS_FMP/SOSO/COINSTATS`, `ETF_FLOWS_FMP/SOSO/COINSTATS`, `ETF_CORR_PRIMARY/FALLBACK`.
- News (falls aktiv): ETFNEWS via bestehendem Store.

## UX/Toast/Health
- System-Status-Card zeigt Health aller Provider (Desktop & Mobile unverändert).
- ETF-Toasts unterdrückt (keine Warn/Error/Recovery-Popups mehr); Status nur in der Health-Card.
- Lazy/Suspense für ETF-Cards mit leichten Text-Fallbacks, keine Layoutänderung.

## Environment / Keys
- `.env.local` / Vercel: `VITE_FMP_KEY` (laut Screenshot gesetzt), plus Firebase-Keys (`VITE_FIREBASE_*`).
- Keine Secrets im Code; alle Zugriffe über `import.meta.env`.

## Bekannte Einschränkungen / Fehler
- ETF-Fallback-Provider (Soso/CoinStats) können weiterhin Health auf degraded/error setzen, erscheinen aber nicht mehr als Toast.
- AlphaVantage Demo limitiert; Korrelationen können degraded sein, wenn Rate-Limit greift.
- AUM-Delta als Flow-Proxy (FMP) kann bei fehlenden Daten 0-Flows ergeben.
- Backtest nutzt HTF approximiert (kein echter 4h-Fetch).

## Verbesserungs-Ideen / Nächste Schritte
1) ETF-Datenqualität:
   - Zusätzliche Provider/Keys hinterlegen (voller AlphaVantage Key, alternativer ETF-Flows-Endpunkt).
   - Caching/Rate-Limit-Handling pro Provider.
2) Stabilität/UX:
   - Optionale Retry-Limits pro Service UI-seitig anzeigen („Letzter Erfolg“).
   - Skeletons/Progress in ETF-Cards verfeinern (Load-States).
3) Performance:
   - Chunk-Splitting weiter optimieren (Charts/libs).
   - Optionales Lazy-Load weiterer Heavy-Widgets.
4) Backtest/Signals:
   - Echte HTF-Daten laden (4h) für Regime-Filter.
   - Equity-Curve/Drawdown/Expectancy in Backtest-UI.
5) Monitoring:
   - Konsolidiertes Logging/Telemetry-Hook nutzen, um Provider-Fehler zentral zu zählen (ohne Toasts).

## Test/Build
- Letzter Build lokal: `npm run build` ✅.
- Main ist up to date, Vercel redeployt automatisch nach Push.

## Master Prompt: Crypto Risk Manager (V3 -> V3+)

**Role:** Senior TypeScript/React/Vite engineer + HF crypto trading architect. Ziel: Crypto Risk Manager V3 auf V3+ (institutionell) heben, Lookahead eliminieren, Risikokennzahlen implementieren.

**Stack & Health**
- Vite + React/TS, strikte Trennung UI vs. Services/Libs.
- Zentrale Fetch-Schicht: `src/lib/safeFetch.ts` (Timeouts, Retries, Health-Callbacks).
- Health Store: `src/stores/apiHealth.ts` mit Status `ok/degraded/error`.

**Prioritat 1 — Data Integrity / Lookahead-Fix**
- Problem: `strategyEngineV3` approximiert HTF (4h/1D) via 4x Sampling von 60m -> Lookahead.
- Losung: Dedizierte HTF-Fetches (z. B. in `src/services/marketDataLive.ts`) von Kraken OHLC (`interval=240/1440`) oder CoinAPI; kein Resampling.
- Health Keys erganzen: `MARKET_HTF_PRIMARY`, `MARKET_HTF_FALLBACK`.

**Prioritat 2 — Derivate-Risikometrics**
- Neuer Service `src/services/derivativesLive.ts`.
- CoinAPI Metrics REST `/v1/metrics/symbol/history`:
  - `DERIVATIVES_FUNDING_RATE_CURRENT`
  - `DERIVATIVES_OPEN_INTEREST`
- OI- & Funding-Delta normalisieren -> `DerivativesRiskScore` in `strategyEngineV3` einspeisen.

**Prioritat 3 — Backtest Engine**
- `backtestV3.js` erweitern:
  - Kumulative Equity Curve (fixes Risk-% pro Trade).
  - Max Drawdown & Profit Factor berechnen/anzeigen.
  - Slippage stochastisch (z. B. Normalverteilung auf Slippage-%), nicht statisch.
  - Confidence-Persistenz: Stub in `src/firebase.js` zum Speichern/Laden von Setup/Regime-Winrates (Firestore).

**Optional — LLM-Integration**
- Wrapper fur Research-Tab-Ausgabe via ChainGPT API (oder OSS LLM + RAG spezialisiert auf Krypto).

**Health-Aggregation**
- Aggregatoren (`ETFFLOWS`, `ETFNEWS`): Primary OK => Aggregator OK; Primary Error + Fallback Error => Aggregator Error.

**APIs**
- Kraken OHLC (HTF 4h/1D) oder CoinAPI/CoinDesk.
- CoinAPI Metrics: Funding, Open Interest.
- Deribit (IV-Proxy via Price Index oder eigene IV aus Options-Ticks).
- IntoTheBlock / CoinDesk On-Chain (Institutional Flow).
- LLM: ChainGPT oder OSS Llama 3 + RAG.

## Implementierungsanweisung V3 -> V3+

- Rolle: Senior TypeScript/React/Vite Full-Stack Engineer mit HF-Krypto-Risikomanagement.
- Ziel: Crypto Risk Manager von V3 auf V3+ (institutionell); Lookahead entfernen, Risikometriken absichern; UI-Layout unveraendert lassen.

**Architektur & Health-Regeln**
- Stack: Vite + React/TS; zentrale Fetch-Schicht bleibt `src/lib/safeFetch.ts` (nicht grundlegend aendern).
- Health-Store: Status `ok|degraded|error` in `src/stores/apiHealth.ts` setzen.
- Health-Aggregation (neu):
  - ETFFLOWS, ETFNEWS: Primary ok => Aggregator ok; Primary error + Fallback error => Aggregator error; sonst degraded.
- Neue Health-Keys: `MARKET_HTF_PRIMARY`, `MARKET_HTF_FALLBACK`, `DERIVATIVES_PRIMARY`.

**Prioritaet 1: Lookahead-Fix (HTF-Daten)**
- Problem: `strategyEngineV3` nutzt 4x Sampling von 60m-Kerzen fuer 4h/1D -> Lookahead.
- Lösung: Dedizierter HTF-Service (z. B. `src/services/marketDataLive.ts`) mit echten 4h/1D-Kerzen via Kraken OHLC (`interval=240/1440`) oder CoinAPI (`period_id=1DAY` etc.), strikt zeitlich alignen. Keine Aggregation der 60m-Serie.
- strategyEngineV3 muss diese separaten HTF-Daten fuer Regime-Filter nutzen.

**Prioritaet 2: DerivativesRiskScore**
- Neuer Service: `src/services/derivativesLive.ts`.
- API: CoinAPI Metrics REST `/v1/metrics/symbol/history` fuer Funding Rate History und Open Interest History.
- Score: Funding Delta + OI Delta berechnen, ueber letzte ~20 Perioden normalisieren (z. B. z-Score), gewichten (z. B. 0.6 OI, 0.4 Funding) und zu `DerivativesRiskScore` aggregieren.
- Integration: Score als neuen Filter in `strategyEngineV3` einspeisen.

**Prioritaet 3: Backtest-Validierung**
- Datei: `src/lib/backtestV3.js`.
- Equity Curve: Startkapital, fixes Risiko-% pro Trade, nach jedem Trade Equity inkl. PnL/Fees/Slippage updaten.
- Risikometriken: Max Drawdown (Peak-to-Trough %) und Profit Factor (Summe Gewinne / Summe Verluste, >1 anstreben) berechnen/ausgeben.
- Slippage: Stochastisch (Normalverteilung um Basis-Slippage mit kleiner StdDev) statt statisch.
- Confidence-Persistenz: Stub in `src/firebase.js` fuer Speichern/Laden von Setup-/Regime-Winrates in Firestore.

**Optionale LLM-Erweiterung**
- Wrapper-Service `src/services/llmMentor.ts` fuer ChainGPT API oder OSS-LLM mit RAG.

**Environment**
- Neue Secrets immer ueber `import.meta.env.VITE_...` (z. B. `VITE_COINAPI_KEY`); keine Secrets im Code.

## V3+ Logik & Architektur (Kurzreferenz)

- **HTF-Regime (kein Lookahead):** Echte 4h/1D-Kerzen via `src/services/marketDataLive.ts` (Kraken primär, CoinAPI Fallback). Regime-Berechnung mit EMA200-Bias, ADX>25, Bollinger-Bandbreite. Setups nur zulässig, wenn sie zum HTF-Regime passen (Trend/Breakout nur Bull/Bear; Reversion nur Crab/Choppy).
- **Signal-Engine (`buildSignalsV3`):** Kandidaten Trend/Breakout/Reversion; Scores aus VolatilityScore (ATR%), FlowScore (Smart Money), SocialBias, Setup-/Regime-Winrates. Konfidenz: 0.35 Setup-WR + 0.25 Regime-WR + 0.2 VolScore + 0.2 FlowScore (0..1). DerivativesRisk (Funding/OI) dämpft/erhöht: Hot -15%, Cool +5%.
- **Derivate-Service (`src/services/derivativesLive.ts`):** CoinAPI Metrics `/v1/metrics/symbol/history` für Funding Rate & Open Interest (1H, 200 Punkte). Z-Score auf Deltas, Composite (0.6 OI, 0.4 Funding) → `DerivativesRiskScore`, RiskLevel hot/cool/neutral. Health-Key: `DERIVATIVES_PRIMARY`.
- **Backtest (`src/lib/backtestV3.js`):** Equity-Curve mit fixem Risiko-% pro Trade; Kennzahlen Max Drawdown, Profit Factor, WinRate, AvgRR, ProfitPct. Slippage stochastisch (Normalverteilung um ATR-basierten Mean), Fees 0.075%. TP/SL-Candle-Lauf ohne Lookahead. Setup-/Regime-Winrates werden zurückgegeben. Firebase-Stubs (`saveWinrateSnapshot`/`loadWinrateSnapshot`) noch ohne echte Persistenz.
- **Health-Aggregation:** `ETFFLOWS`/`ETFNEWS`: Primary ok ⇒ Aggregator ok; Primary error + alle Fallbacks error ⇒ Aggregator error; sonst degraded. Neue Keys: `MARKET_HTF_PRIMARY`, `MARKET_HTF_FALLBACK`, `DERIVATIVES_PRIMARY`.
- **Env:** `VITE_COINAPI_KEY` erforderlich (lokal & Deployment), sonst leere HTF/Derivatives-Daten.
