# 1. Projekt-Überblick
- **Was tut aicryptomind?** Ein webbasiertes Krypto-Dashboard mit Live-Preisen, OHLC-Charts, Indikatoren, Signal-Engine (Trend/Breakout/Reversion), Backtests und einfachen Risiko-Hinweisen (TP/SL-Rechner, Risk-Score). Fokus: „AI-Powered Crypto Risk Manager“.
- **Haupt-Module**
  - `src/App.jsx` – Zentrale Trading-/Signal-Logik, Datenbeschaffung, Risiko-Hinweise, UI-Routing der Cards.
  - `src/lib/indicators.js` – Berechnung aller technischen Indikatoren (EMA/RSI/MACD/Bollinger/ATR/ADX usw.).
  - `src/lib/signalsV2.js` – Signal-Builder (Basic & Pro), ATR-basierte TP/SL, Scoring.
  - `src/lib/strategyEngineV3.js` – Trend/Breakout/Reversion-Setups, Volatilitäts- & Flow-Scores, Regime-Filter.
  - `src/lib/backtestV3.js` – Event-basierter Backtest mit TP/SL, Slippage/Fee, Positionsgrößen aus Risikoprozent.
  - `src/lib/chartLoader.ts` – Mehrquellen-OHLC (Kraken/Binance/Proxy) inkl. Fallback.
  - `src/services/marketDataLive.ts` – High-Timeframe (4h/1d) Fetch + Health-Handling.
  - `src/services/derivativesLive.ts` – Funding/Open-Interest-Risiko-Score (hot/neutral/cool).
  - `src/features/indicators/IndicatorCards.jsx` – API-basierte V4-Indikatorwerte (1h).
  - `src/features/risk/RiskPanel.jsx` – Korrelationsanzeige (Cross-Asset).
  - `src/pages/Dashboard.jsx` – Bindet IndicatorCards/RiskPanel ins Layout.

# 2. Datenquellen & Kursentwicklung
- **Preis-Feed (Spot)**
  - Live-Ticks über Binance WebSocket `wss://stream.binance.com:9443/ws/{symbol}@trade` (`src/App.jsx`, WS-Setup in Hook ab Zeile ~1760). Fallback: Polling `loadPrice()` über `/api/price` Proxy (`fetchPriceProxy` in `src/App.jsx`).
  - Quelle/Status-Tracking via `safeFetch`/`apiHealth`.
- **OHLC**
  - `loadOHLC()` ruft `loadChart` (`src/lib/chartLoader.ts`) mit Priorität: Kraken → Binance → Proxy. Intervalle gesteuert durch `timeFrame` (15m, 1h, 4h, 1d), Default 1h; Limit 200 Kerzen.
  - Kerzen werden mit Labels versehen (`decorateCandles`) und in `ohlcv` gespeichert.
- **High-Timeframe (HTF)**
  - `loadHTF()` holt 4h und 1d via `fetchHtfOhlc` (`src/services/marketDataLive.ts`), nur für Pro/Elite. Nutzt ebenfalls Kraken-Proxy.
- **Derivate-Risiko**
  - `loadDerivatives()` → `fetchDerivativesLive` (`src/services/derivativesLive.ts`), Symbol-Format `DERIBIT_PERPETUAL_{CC}_USD`. Proxy `/api/derivatives` liefert Funding/Open-Interest, daraus Composite-Score & `riskLevel` (hot/cool/neutral).
- **Weitere Daten**
  - Fear & Greed: `https://api.alternative.me/fng` (`fetchFearGreed`).
  - Funding-Rates (Binance), On-Chain/Sentiment (Glassnode/Santiment), Korrelationen (CoinGecko); alle via `safeFetch` mit Health-Monitoring.
- **Kennzahlen**
  - Preis: `value`, `change24h`, `source`, `updatedAt` (`priceState` in `src/App.jsx`).
  - Funding/Open-Interest-Z-Scores → `composite` → `riskLevel` (hot ≥1.2, cool ≤-1).
  - Smart-Money: aus letzten 3h Trades (WS) Netflow %-Berechnung.
  - Regime: EMA200-Abstand, ADX, Bollinger-Breite → Label (Bull/Bear/Crab/Choppy) mit Confidence (`computeRegime` in `src/App.jsx`).

# 3. Indikatoren (Technical Analysis)
- **Berechnung lokal (auf `indicatorSeries` in `src/App.jsx`)** – alle Funktionen aus `src/lib/indicators.js`:
  - `EMA`: 20/50/200.
  - `RSI`: Periode 14.
  - `MACD`: 12/26/9 (inkl. Signal/Histogramm).
  - `Bollinger Bands`: 20 / 2σ (upper/lower/basis).
  - `StochRSI`: 14, SmoothK=3, SmoothD=3.
  - `Stoch Osc` (Preis): 14/3/3.
  - `CCI`: Periode 20.
  - `ATR`: 14 + `atrPct` (ATR/Close*100).
  - `ADX`: 14.
  - `Donchian`: Periode 20 (upper/lower/mid).
  - `VWAP`, `OBV`.
  - Zusätze: `volumeSpike` = Vol/MaxVol, `volumeUp/Down`.
- **API-basierte Indikator-Karten (V4)** `src/features/indicators/IndicatorCards.jsx`: `/api/indicators` (1h, limit 180) liefert u.a. RSI, TrendStrength, ATR, Volatility, SmartMoneyFlow, Stochastic K/D.
- **Verwendung**
  - `indicatorSeries` füllt Charts, Signale, Regime-Detector, Risk-Score.
  - HTF-Regime berechnet EMA200/BB/ADX erneut auf 4h/1d (`htfRegime` in `src/App.jsx`).

# 4. Risk-Management-Logik
- **Variablen**
  - TP/SL-Form (`tpForm` in `src/App.jsx`): Entry, Menge, TP%-Punkt, SL%-Punkt.
  - Ableitung: `takeProfitPrice = entry * (1 + tpPct/100)`, `stopLossPrice = entry * (1 - slPct/100)`, `profit = (TP-Entry)*Qty`, `loss = (Entry-SL)*Qty`, `rr = profit/loss`.
  - `suggestRisk()` passt TP/SL-Prozente an RSI/MACD an (z.B. RSI<30 → TP 6%, SL 2.5%).
  - `Risk Score Summary` (UI) = clamp(10..95, (RSI/2 + MACD*8)/2) – grobe Ampel, kein hartes Gating.
- **Positionsgröße (Backtest)** `runBacktestV3` (`src/lib/backtestV3.js`):
  - `riskPct` (Default 0.01) = Anteil des aktuellen `equity`.
  - `stopDistance = |entry - sl|`; `positionSize = (equity * riskPct) / stopDistance`.
  - PnL = `positionSize * (exit - entry)` (Richtungssensitiv).
  - Equity-Kurve, Max-Drawdown, Profit-Factor werden berechnet.
- **Stops/Targets in Signalen**
  - ATR-basiert: `atrFrac = min(atrPct/100, 0.02)`.
  - `riskPad = atrFrac * 0.5` (Trend/Reversion) oder `0.6` (Breakout).
  - TP = Close*(1 ± riskPad*2.2), SL = Close*(1 ∓ riskPad) je nach Long/Short (in `strategyEngineV3` & `signalsV2`).
- **Hebel/Margin**
  - Kein Leverage/Margin-Handling im Code. Alles in Nominalgrößen & Prozent-Risiko.
- **Daily Drawdown**
  - Kein hartes Tageslimit. Backtest liefert `maxDrawdown`, aber keine Blockier-Logik.

# 5. AI-Protector / Schutz-Mechanismen
- **Regime-Filter** (`computeRegime` in `src/App.jsx`, `htfRegime` aus 4h/1d):
  - Trend/Breakout-Signale nur, wenn HTF-Regime Bull/Bear; Reversion nur bei Crab/Choppy (`buildSignalsV3` Filter).
- **Volatilitäts- & Liquiditäts-Tore**
  - Trend/Breakout verlangen `atrPct < 3` + VWAP/MACD-Alignment (`evaluateTrendSetup` in `src/lib/strategyEngineV3.js`).
  - Breakout benötigt Bollinger-Bandbreite ≥4% und `volumeSpike >= 1.3`.
- **Social Bias Guard**
  - Starke positive Stimmung (`socialBias > 0.7`) entfernt Shorts; starke negative (< -0.7) entfernt Longs (`buildSignalsV3`).
- **Derivate-Risiko Guard**
  - `derivativesRisk.riskLevel === "hot"` → Confidence *0.85 (dämpft); `"cool"` → *1.05 (leicht verstärkt) in `buildSignalsV3`.
- **Outcome**
  - Nur Kandidaten, die alle Filter bestehen, werden gewertet; Confidence & Ultra-Flag bestimmen Freigabe/Signalstärke. Kein expliziter „Defense Mode“-Schalter, aber obige Bedingungen blocken/gewichten Trades.

# 6. Signal-Logik & Scoring
- **Basis-Signal** `buildAISignal` (`src/lib/signalsV2.js`)
  - Regeln: RSI<30 & MACD bull → Kaufen; RSI>70 & MACD bear → Verkaufen; obere/untere Bollinger-Bänder triggern TP/SL-Checks.
  - Output: Action, Reason, Confidence (~0.6), TP/SL Default (±5%/±2.5% je nach Richtung).
- **Pro-Signal (Single-Frame)** `buildProSignal`
  - Inputs: letzter `indicatorSeries`-Punkt, Smart-Money-Netflow, Regime.
  - Setups: Trend (EMA200 + MACD + VWAP + ATR<3), Breakout (Donchian + VolumeSpike), Reversion (RSI Extrem + Bollinger Touch).
  - TP/SL: ATR-abhängig (siehe Risk-Logic). Score aus TrendBias, Momentum (MACD∆), FlowBias, VolQuality.
- **Backtest-Signale** `buildBacktestSignals`
  - Gleiche Setups wie Pro, erzeugen Zeitreihe mit Entry/TP/SL/Setup/Regime für Backtest.
- **Strategy Engine V3** (`src/lib/strategyEngineV3.js`)
  - `evaluateTrendSetup`, `evaluateBreakoutSetup`, `evaluateReversionSetup` liefern {trigger, direction, tp, sl, meta(reason, volScore, flowScore, setup)}.
  - `computeVolatilityScore` mappt ATR% auf 0.2–0.9; `computeFlowScore` skaliert Smart-Money-% auf 0..1.
  - `computeConfidenceFromBacktest`: 35% Setup-Winrate + 25% Regime-Winrate + 20% Vol-Score + 20% Flow-Score → clamp 0..1.
  - `isUltraSignal`: braucht SetupWinrate≥0.75, RegimeWinrate≥0.8, Flow/Vol≥0.7, ATR%<3, starker SocialBias → markiert High-Conviction.
- **Ensemble** `buildSignalsV3`
  - Kandidaten = Trend/Breakout/Reversion (mit Setup-Meta).
  - Filter: SocialBias (kein Short bei stark positiv, kein Long bei stark negativ), HTF-Regime (Trend/Breakout nur Bull/Bear, Reversion nur Crab/Choppy).
  - Confidence-Anpassung mit Backtest-Winraten + Derivate-Risk-Dämpfung.
  - Auswahl höchster Confidence; Output: action (long/short/wait), reason (Meta-Reason concat), confidence/score, tp/sl, setup, ultra-Flag, Meta inkl. Winraten & derivativesRisk.

# 7. Beispiel-Flow (BTCUSDT)
- **Daten laden**
  - Live-Preis: Binance WS `btcusdt@trade` → `livePrice` & Trades-Stream (`src/App.jsx`).
  - OHLC: `loadOHLC()` → Kraken/Binance/Proxy (1h default, 200 Kerzen) → `ohlcv`.
  - HTF: `loadHTF()` → 4h/1d (Pro) für `htfRegime`.
  - Derivate-Risiko: `fetchDerivativesLive("DERIBIT_PERPETUAL_BTC_USD")` → `derivativesRisk`.
- **Indikatoren**
  - `indicatorSeries` aus `ohlcv` mit RSI14, MACD12/26/9, BB20/2, StochRSI/OSC, CCI20, EMA20/50/200, ATR14(+%), ADX14, Donchian20, VWAP, OBV, volumeSpike.
- **Risiko-Parameter**
  - TP/SL-Rechner: Entry = Live-Preis, Default TP 4%, SL 3% (oder `suggestRisk` abhängig von RSI/MACD).
  - Pro/Strategy-Signale setzen TP/SL ATR-basiert (riskPad).
  - Backtest-Positionsgröße: 1% Equity / Stop-Distanz.
- **AI-Protector**
  - Regime-Check (1h + HTF): Bull/Bear zwingend für Trend/Breakout.
  - Social Bias filtert Richtung; derivativesRisk hot dämpft Confidence.
  - Vol- und Volume-Spike-Filter verhindern Trades bei enger BB-Breite (<4) oder ATR>3.
- **Signal & UI**
  - `buildSignalsV3` wählt Best-Kandidat → Action/Confidence/TP/SL angezeigt (Cards um Zeile ~3300ff).
  - Risk Score Bar (RSI/MACD) + Regime/Smart-Money Cards visualisieren Kontext.
  - Charts (`Candle + BB/EMA/MACD/RSI`) zeigen gleiche `indicatorSeries`.

# 8. Technische Struktur & wichtige Dateien
- `src/App.jsx` – Hauptlogik (Datenfetch, Indicator-Pipeline, Regime, Signals, TP/SL-Rechner, UI).
- `src/lib/indicators.js` – Implementierung aller TA-Indikatoren.
- `src/lib/signalsV2.js` – AI/Pro/Backtest-Signale, ATR-TP/SL, Scoring, Social/Regime-Filter (V3 Wrapper).
- `src/lib/strategyEngineV3.js` – Setup-Detektoren, Vol/Flow-Scores, Ultra-Kriterium.
- `src/lib/backtestV3.js` – Tradesimulation mit Slippage/Fee, Risiko-Prozent Positionssizing, DD/ProfitFactor.
- `src/lib/chartLoader.ts` – Mehrquellen-OHLC, Normalisierung, Fallback-Build.
- `src/services/marketDataLive.ts` – HTF-OHLC (4h/1d) Proxy + Health.
- `src/services/derivativesLive.ts` – Funding/OI → Composite → `riskLevel` (hot/cool/neutral).
- `src/features/indicators/IndicatorCards.jsx` – Anzeige V4-Indikatorwerte aus `/api/indicators`.
- `src/features/risk/RiskPanel.jsx` – Cross-Asset-Korrelationen aus `/api/correlations`.
- `src/pages/Dashboard.jsx` – Seite, die IndicatorCards/RiskPanel einbettet.

# 9. Optional: Verbesserungsvorschläge
1) **Klare Trennung von UI/Logik**: Signals/TP-SL-Berechnung aus `src/App.jsx` in dedizierte Hooks/Services auslagern; erleichtert Tests.
2) **Einheitliche Risiko-Engine**: Gemeinsames Modul für TP/SL/Positionsgröße, das sowohl UI-Rechner als auch Signal-Engine und Backtest nutzen (gleiche Parameter/Defaults).
3) **Leverage/Margin-Support**: Optionale Hebel-Eingabe + Margin-Check im Positionsgrößen-Formula ergänzen; Warnungen bei Überhebelung.
4) **Daily-Risk-Gates**: Max-Tagesverlust/Max-Trades implementieren, gekoppelt an `derivativesRisk` und `maxDrawdown` aus Backtests.
5) **Protector-Transparenz**: UI-Panel, das zeigt, welche Filter (Regime/Sentiment/Derivate/Vol) gerade blocken oder dämpfen.
6) **Backtest/Live-Konvergenz**: Gleiche Slippage/Fee/ATR-Parameter in Pro-Signalen anzeigen, damit Nutzer die erwartete RR sehen.

## V3+ Engine – Final
- **EdgeScore**: Kombiniert Technical Confidence, FundamentalScore (Liquidität/Stabilität) und Liquidity-Anteil zu einem Edge-Faktor; fließt in `buildSignalsV3` Confidence ein.
- **Derivate-Gate**: `riskLevel=hot` blockt Trend/Breakout, `cool` hebt Confidence leicht an (max 0.95); Meta nennt Ursache.
- **Daily Risk Gate**: `computeDailyRiskGate` (Limit -3% default) – Backtest stoppt Tages-Trades nach Überschreitung; Live-Signale akzeptieren `dayPnlPct` als Blocker.
- **Unified Stops/Sizing**: `computeStopAndTarget` (ATR/Setup/Regime-basiert) + `computePositionSize` (1% Equity default) werden in Signals, Backtest und TP/SL-Suggestor genutzt.
- **ETF-Fallback & EdgeScore**: ETF-Korrelationen nutzen FMP, fallen bei fehlendem Key/Timeout auf Stooq-Fetch zurück (Health `degraded`, data empty). EdgeScore kombiniert Technical + Fundamental (Liquidität/Stabilität); Confidence wird damit geclamped.
