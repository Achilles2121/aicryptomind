# Vision AI Mind Dashboard - Trading- & Backtest-Analyse (Stand V3 Signals/Backtest)

## Ueberblick
- Single-Page React + Vite + Tailwind App; Firebase Auth/Firestore Stub in `src/firebase.js`.
- Ziel: Crypto Risk Manager mit Live-Preisen (Binance WS + CoinGecko/CryptoCompare), Kraken-OHLC, Indikator-Berechnung clientseitig, Signal-Widgets (AI/Pro/V3), Backtest-Snapshot (V3).
- Paywall-Tiers (basic/pro/elite) steuern Zugriff auf Pro/Elite-Karten.

## Projektstruktur (relevante Teile)
- src/App.jsx: UI, Datenfetching, State-Management; holt Logik aus `lib`.
- src/lib/indicators.js: Reine Indikator-Utilities (EMA, RSI, MACD, Bollinger, ATR, ADX, Donchian, VWAP, OBV, CCI, StochRSI/Oszillator, Pearson).
- src/lib/signalsV2.js: Signal-Builder fuer AI/Pro + Backtest-Signal-Generator + V3 Kombi-Signale.
- src/lib/strategyEngineV3.js: Setup-Evaluierung (Trend/Breakout/Reversion), Confidence-Modell, Ultra-Signal-Kennzeichnung, Flow/Vol-Scores.
- src/lib/backtestV3.js: Event-basierter Backtester ohne Lookahead, jetzt mit Fees+Slippage und Setup/Regime-Stats.
- src/firebase.js: Firebase-Init (nutzt ENV); src/main.jsx, src/index.css: Bootstrapping/Styles.

## Datenquellen
- Preise: Binance WebSocket Trades (live), Fallback CoinGecko Simple Price, zweiter Fallback CryptoCompare.
- OHLC: Kraken Public OHLC API (configurierbares Intervall via UI-`timeFrame`, Default 60 min).
- Sentiment/On-Chain/Meta: Glassnode Active Addresses, CryptoCompare Social (Social Score), CoinGecko Correlations, Binance Funding, ETF-News/Flows (FMP), DeFiLlama APY, AlphaVantage, HuggingFace Ping (Reachability/Meta).
- Caching/Polling: `CACHE_TTL=5min`, `POLL_INTERVAL=30s`, WS Auto-Reconnect mit Polling-Backup.

## Aktuelle Signal-Engine
### Indikator-Basis (`indicatorSeries` aus Kraken-OHLC)
- Preise/OHLC + Volumen; daraus: RSI14, MACD(12/26/9), Bollinger(20/2), StochRSI(14,3,3), Stoch-Oszillator (14,3,3), CCI20, EMA20/50/200, ATR14 + ATR%, ADX14, Donchian20, VWAP, OBV, Volume-Spike, ADX-basiertes Regime.
- Market Regime: EMA200-Bias + ADX>25 + BBW>5% -> Bull/Bear, sonst Crab/Choppy; Confidence aus ADX/Bias/BBW.
- Smart Money: Binance-Trades (3h), Netflow %-Score.

### AI Signal (Elite) - `buildAISignal` (lib/signalsV2)
- Inputs: RSI, MACD-Diff, Bollinger, Close, TP/SL aus Form.
- Regeln wie zuvor; Confidence 0.6-0.68; kein Regime/Flow/Social-Filter.

### Pro/V3 Signals - `buildSignalsV3` (lib/signalsV2 + strategyEngineV3)
- Setups: Trend (Bull/Bear + MACD + VWAP + ATR-Filter), Breakout (Donchian + Vol-Spike, breite Bänder), Reversion (RSI extrem + Bollinger, bevorzugt Crab/Choppy).
- Multi-Timeframe: HTF-Regime (approx. 4h Sample) filtert Setups (Trend/Breakout nur Bull/Bear; Reversion nur Crab/Choppy).
- Social: Social Score >0.7 blockiert Shorts; < -0.7 blockiert Longs; starker Bias fließt in Ultra.
- Confidence: `0.35*setupWinrate + 0.25*regimeWinrate + 0.20*volatilityScore + 0.20*flowScore` (0-1).
- Ultra-Signal: SetupWinrate>=0.75, RegimeWinrate>=0.80, FlowScore>=0.7, VolatilityScore>=0.7, ATR%<3, starker Social-Bias ok.
- Output kompatibel zur Pro-Karte (action/tp/sl/confidence/setupLabel/regimeLabel/ultra-Flag).

### Backtest-Signale fuer V3 - `buildBacktestSignals`
- Generiert Trend/Breakout/Reversion-Signale je Kerze ohne Lookahead; versieht sie mit Setup + Regime.
- TP/SL ATR%-basiert (RiskPad, RR ~2.2:1).

## Backtest-Engine V3 ("Backtest Snapshot" / "Backtest (Local JS)")
- Ort: `src/lib/backtestV3.js`; Inputs: `candles` = indicatorSeries, `signals` = `buildBacktestSignals`, `maxHoldBars=5`.
- Simulation: Entry = Close[i], Slippage = ATR%*0.1, Fees 0.075% je Seite; TP/SL-Check forward bis Hold-Limit; Exit sonst per Close.
- RR: LONG `(exit-entry_eff)/(entry_eff-sl)`, SHORT `(entry_eff-exit)/(sl-entry_eff)`; Result win/loss/be.
- Kennzahlen: Trades, Winrate, AvgRR, ProfitPct, Long/Short-Stats, per-Setup-Winrates, per-Regime-Winrates.
- UI: Backtest-Cards in `src/App.jsx` (Titel "Backtest V3 Snapshot") lesen `backtestStats` aus `runBacktestV3` (Winrate, Trades, Wins/Losses, AvgRR) und zeigen Hinweistext zu TP/SL + Fees/Slippage; Confidence-Modell nutzt Setup/Regime-Winrates.

## Kennzahlen-Anzeigen
- Backtest Cards: Trades, Winrate, Wins/Losses, AvgRR (live per OHLC-Reload, mit Fees/Slippage).
- V3-Signal Confidence: gewichtete Kombination aus Backtest-Winrates + Vol/Flow.
- Market Regime Confidence: bleibt ADX/EMA/BBW-gestuetzt.

## Konfiguration & Settings
- Konstanten: `CACHE_TTL=5min`, `POLL_INTERVAL=30s`, `NEWS_REFRESH=5min`, `FLOWS_REFRESH=5min`.
- Assets: BTC, ETH, SOL, XRP, ADA, LTC, DOGE, BNB, AVAX, DOT.
- Timeframe: State `timeFrame` (Default 60m); HTF-Regime approximiert via 4er-Sampling derselben Serie.
- TP/SL Defaults (UI-Form): TP 4%, SL 3%, Qty 1; AI-Vorschlag per RSI/MACD.
- ENV (Namen): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

## Schwachstellen & Ansatz fuer V3+
- HTF-Regime aus gleicher Serie approximiert (kein echtes 4h-Fetch); Social-Score grob normiert.
- Backtest noch ohne Positionsgroessen/Equity-Curve/Fees variabel; keine per-Setup RR-Optimierung; keine Slippage-Stochastik.
- Confidence nutzt Setup/Regime-Winrates, aber Historie nur aus aktuellem Dataset; keine Persistenz/Parameter-Tuning.
- ATR-TP/SL capped (2% RiskPad-Basis) kann enge Stops bedeuten.

## Umgesetzte Aenderungen (Logik & Tier/Branding)
- Backtest V3 an UI angebunden: `runBacktestV3` in `src/App.jsx` via `buildBacktestSignals`; Stats (Trades, Winrate, Wins/Losses, AvgRR) befuellen Backtest-Karten ("Backtest V3 Snapshot"), Hinweistext zu TP/SL + Fees/Slippage.
- Confidence/Signals: `buildSignalsV3` nutzt Setup/Regime-Winrates aus Backtest, Flow/Vol/Social-Filter, HTF-Regime-Filter, Ultra-Flag.
- Tier-System (basic/pro/elite) via Context (`src/context/UserTierContext.jsx`), LockedCard fuer gated Karten (Backtest ab Pro, Chat ab Elite), Context in `main.jsx` um App.
- Branding/SEO: `src/config/brand.js` (APP_BRAND/APP_TAGLINE), Meta/JSON-LD aktualisiert; Kern-Libs mit Vision-AI-Header.
- Mobile/Overflow: Root overflow-y-auto/overscroll/touch; Kennzahlen nowrap/ellipsis; Scrollbereiche mit overscroll-contain.
- CryptoEduChatCard Stub + Hook (`useCryptoEduChat`) eingebunden (Elite-gated), Hinweis auf spaeteres LLM-Backend; TODO Payment-/Admin-System und Chat-API Anbindung.

### Potenzielle V3-Verbesserungen
- Echte HTF-Daten laden (4h), Funding/Sentiment als Hard-Filter einbauen.
- Backtest: Positionsgroessen, Fees/Slippage stochastisch, Equity-Curve, PF/MaxDD/Expectancy.
- Persistente Stats pro Setup/Regime; Parameter-Tuning/MC-Sims; Logging/Heatmaps fuer TP/SL-Treffer.
- Multi-Timeframe/HTF+LTF Kombi-Signale, Beta/Korrelations-Filter, Volatility-Banding.
