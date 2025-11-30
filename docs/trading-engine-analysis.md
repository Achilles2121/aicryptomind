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
