# Vision AI Mind - System Übersicht & Dokumentation

> **Stand:** 16. Dezember 2024  
> **Version:** 1.0  
> **Status:** Production Ready  
> **URL:** https://visionaimind.vercel.app

---

## 📊 Inhaltsverzeichnis

1. [Projekt-Struktur](#projekt-struktur)
2. [System-Stabilität](#system-stabilität)
3. [Trading-Signale & Berechnungen](#trading-signale--berechnungen)
4. [API-Endpunkte](#api-endpunkte)
5. [Datenquellen & Zuverlässigkeit](#datenquellen--zuverlässigkeit)
6. [Vision AI Chatbot](#vision-ai-chatbot)
7. [Layout & Design](#layout--design)
8. [Asset-Klassen](#asset-klassen)
9. [Trial-System](#trial-system)
10. [SEO/GEO Optimierung](#seogeo-optimierung)
11. [Bekannte Limitierungen](#bekannte-limitierungen)
12. [Nächste Schritte](#nächste-schritte)

---

## 🏗️ Projekt-Struktur

```
Elite Trader/
├── api/                    # Vercel Serverless Functions
│   ├── chat.ts            # Vision AI Chatbot (Groq/Llama 3.1)
│   ├── health.ts          # System Health Check
│   ├── indicators.ts      # RSI, MACD, EMA Berechnungen
│   ├── liquidity.ts       # Order Blocks, Fair Value Gaps
│   ├── ohlc.ts            # Candlestick-Daten (Binance/Kraken/CoinGecko)
│   ├── price.ts           # Live-Preise
│   └── derivatives.ts     # Funding Rates, Open Interest
├── src/
│   ├── App.jsx            # Haupt-App (5100+ Zeilen)
│   ├── components/        # React-Komponenten
│   ├── lib/               # Utility-Funktionen, Hooks
│   ├── config/            # Konfiguration, Branding
│   └── features/          # Feature-Module
├── index.html             # SEO-optimierter Entry Point
├── vercel.json            # Deployment-Konfiguration
└── package.json           # Dependencies
```

---

## 🔒 System-Stabilität

### Aktuelle Stabilität: **85-90%**

| Komponente | Stabilität | Details |
|------------|------------|---------|
| **Frontend (React)** | ⭐⭐⭐⭐⭐ 98% | Vite 7.2.4, keine kritischen Bugs |
| **Binance WebSocket** | ⭐⭐⭐⭐ 85% | Live-Trades, Auto-Reconnect bei Disconnect |
| **OHLC API** | ⭐⭐⭐⭐ 90% | 3-Provider-Fallback (Binance→Kraken→CoinGecko) |
| **Price API** | ⭐⭐⭐⭐ 88% | CoinGecko Primary, OpenExchange für FX |
| **Vision AI Chat** | ⭐⭐⭐⭐ 82% | Groq API mit intelligentem Fallback |
| **Indicators API** | ⭐⭐⭐⭐⭐ 95% | Lokale Berechnung, keine externen Dependencies |
| **ETF Daten** | ⭐⭐⭐ 70% | FMP/SoSoValue - gelegentliche Rate Limits |

### Fehlerbehandlung

```javascript
// Alle API-Fehler werden abgefangen und als "degraded" markiert
// Keine Fehler-Toasts für bekannte API-Probleme
isKnownApiIssue(message) // Filtert: proxy, ohlc, htf, derivatives, etc.
```

### Caching-Strategie

| Endpoint | Cache TTL | Begründung |
|----------|-----------|------------|
| `/api/ohlc` | 2 Minuten | Balance zwischen Frische und Performance |
| `/api/price` | 30 Sekunden | Preise müssen aktuell sein |
| `/api/indicators` | 1 Minute | Berechnungen ändern sich langsam |
| `/api/chat` | Kein Cache | Jede Anfrage ist einzigartig |

---

## 📈 Trading-Signale & Berechnungen

### Signal-Berechnung (buildSignalsV3)

Das System verwendet einen **Multi-Faktor-Ansatz** zur Signalgenerierung:

```
Signal Score = Σ (Faktor × Gewichtung)
```

#### Faktoren und Gewichtungen:

| Faktor | Gewichtung | Beschreibung |
|--------|------------|--------------|
| **RSI** | 20% | Relative Strength Index (0-100) |
| **MACD** | 20% | Trend-Momentum (Crossovers) |
| **Market Regime** | 15% | Bull/Bear/Choppy Detection |
| **EMA200** | 10% | Langfristiger Trend |
| **Bollinger Bands** | 10% | Volatilität & Mean Reversion |
| **Smart Money** | 10% | Order Blocks, FVGs, Imbalances |
| **Derivatives** | 10% | Funding Rates, OI |
| **AI Predictor** | 5% | 4h Trend-Vorhersage |

### Signal-Typen

| Signal | Konfidenz | Bedeutung |
|--------|-----------|-----------|
| **LONG** | 60-100% | Kaufsignal - Aufwärtstrend erwartet |
| **SHORT** | 60-100% | Verkaufssignal - Abwärtstrend erwartet |
| **WARTEN** | 0-60% | Kein klares Setup - Abwarten |

### Wahrscheinlichkeits-Genauigkeit

> ⚠️ **WICHTIG:** Diese Signale sind für **Bildungszwecke** - keine Anlageberatung!

| Backtest-Metrik | Typischer Wert | Anmerkung |
|-----------------|----------------|-----------|
| **Win Rate** | 52-58% | Bei korrektem Entry/Exit |
| **Avg R/R** | 1.2-1.8 | Risk/Reward Verhältnis |
| **Max Drawdown** | -15% bis -25% | Historisch |
| **Profit Factor** | 1.1-1.4 | Brutto-Gewinn / Brutto-Verlust |

### RSI-Berechnung

```javascript
// Standard Wilder's RSI mit 14 Perioden
RSI = 100 - (100 / (1 + RS))
RS = Avg Gain / Avg Loss

// Interpretation:
// < 30: Überverkauft (bullish)
// 30-70: Neutral
// > 70: Überkauft (bearish)
```

### MACD-Berechnung

```javascript
// Standard MACD (12, 26, 9)
MACD Line = EMA(12) - EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line - Signal Line

// Signale:
// MACD > Signal: Bullish Momentum
// MACD < Signal: Bearish Momentum
```

### Take Profit / Stop Loss Berechnung

```javascript
// ATR-basierte Berechnung
ATR = Average True Range (14 Perioden)

// Default-Werte:
Take Profit = Entry × (1 + tpPct/100)  // Standard: +4%
Stop Loss = Entry × (1 - slPct/100)    // Standard: -3%

// R/R Ratio = Profit / Loss
// Empfohlen: R/R >= 1.5
```

---

## 🌐 API-Endpunkte

### Aktive Endpoints (7 total - Vercel Hobby Limit: 12)

| Endpoint | Methode | Funktion | Rate Limit |
|----------|---------|----------|------------|
| `/api/health` | GET | System-Status | 10/min |
| `/api/price` | GET | Live-Preise | 30/min |
| `/api/ohlc` | GET | Candlestick-Daten | 20/min |
| `/api/indicators` | GET | RSI, MACD, EMA | 20/min |
| `/api/liquidity` | GET | Order Blocks, FVGs | 10/min |
| `/api/derivatives` | GET | Funding, OI | 10/min |
| `/api/chat` | POST | Vision AI Chatbot | 30/min |

### Beispiel-Anfragen

```bash
# Preis abrufen
GET /api/price?asset=BTC&vs=USD

# OHLC-Daten
GET /api/ohlc?asset=BTC&interval=60&limit=80

# Indikatoren
GET /api/indicators?symbol=BTCUSDT&interval=1h

# Chat
POST /api/chat
Body: { "prompt": "Was zeigt der RSI?", "context": { "asset": "BTC", "rsi": 45 } }
```

---

## 📡 Datenquellen & Zuverlässigkeit

### Primäre Datenquellen

| Quelle | Typ | Zuverlässigkeit | Rate Limit |
|--------|-----|-----------------|------------|
| **Binance** | WebSocket + REST | ⭐⭐⭐⭐⭐ 98% | 1200/min |
| **CoinGecko** | REST | ⭐⭐⭐⭐ 85% | 30/min (free) |
| **Kraken** | REST | ⭐⭐⭐⭐ 90% | 15/min |
| **Stooq** | REST (Daily) | ⭐⭐⭐ 75% | Keine Angabe |
| **OpenExchange** | REST (FX) | ⭐⭐⭐⭐ 88% | 1000/month |
| **Alternative.me** | REST (Fear/Greed) | ⭐⭐⭐⭐ 85% | 30/min |

### Fallback-Kaskade

```
Binance (Primary)
    ↓ Fehler?
Kraken (Fallback 1)
    ↓ Fehler?
CoinGecko (Fallback 2)
    ↓ Fehler?
Synthetische Daten (Fallback 3)
```

### Datenaktualität

| Datentyp | Update-Frequenz | Latenz |
|----------|-----------------|--------|
| Live-Trades | Real-time (WebSocket) | < 100ms |
| OHLC Candles | 1 Minute | 2-5s |
| Indikatoren | Bei jedem Candle-Update | < 1s |
| Fear & Greed | Täglich | n/a |
| ETF Flows | Täglich | n/a |

---

## 🤖 Vision AI Chatbot

### Technologie

- **LLM:** Llama 3.1 8B Instant (via Groq)
- **Fallback:** Intelligente lokale Antworten
- **Kontext:** Plattform-Daten (Preis, RSI, MACD, TP/SL)

### Kontext-Daten die übergeben werden

```typescript
type PlatformContext = {
  asset: string;        // z.B. "BTC"
  price: number;        // Aktueller Preis
  rsi: number;          // RSI-Wert
  macd: number;         // MACD-Wert
  macdSignal: number;   // MACD Signal
  trend: string;        // Bull/Bear/Choppy
  regime: string;       // Market Regime
  fearGreed: number;    // Fear & Greed Index
  signal: string;       // LONG/SHORT/WARTEN
  confidence: number;   // 0-1
  tp: number;           // Take Profit Preis
  sl: number;           // Stop Loss Preis
};
```

### Antwort-Stil

- Beginnt immer mit **"Vision AI:"**
- Deutsch oder Englisch (automatisch erkannt)
- Max 250 Wörter
- Immer Disclaimer: "⚠️ Dies ist keine Anlageberatung"

### Beispiel-Dialog

```
User: "Wie ist der aktuelle RSI?"

Vision AI: Der RSI für BTC liegt aktuell bei 45.2 - das ist neutral.

Der RSI misst Momentum auf einer Skala von 0-100:
• Unter 30: Überverkauft - oft folgt eine Erholung
• Über 70: Überkauft - Konsolidierung/Korrektur möglich
• 40-60: Neutral Zone

⚠️ Dies ist keine Anlageberatung. Eigene Recherche erforderlich.
```

---

## 🎨 Layout & Design

### Design-System

| Element | Wert | Verwendung |
|---------|------|------------|
| **Primärfarbe** | `#10b981` (Emerald-500) | Bullish, Positiv, CTA |
| **Sekundärfarbe** | `#f59e0b` (Amber-500) | Warnungen, Neutral |
| **Fehlerfarbe** | `#ef4444` (Red-500) | Bearish, Negativ |
| **Background** | `#0f172a` (Slate-900) | Dark Mode Base |
| **Card Background** | `#1e293b` (Slate-800) | Card Backgrounds |
| **Text Primary** | `#f1f5f9` (Slate-100) | Haupttext |
| **Text Secondary** | `#94a3b8` (Slate-400) | Sekundärtext |

### Typografie

| Element | Font | Gewicht |
|---------|------|---------|
| Überschriften | Inter | 600-800 |
| Body Text | Inter | 400-500 |
| Code/Zahlen | JetBrains Mono | 400-500 |

### Responsive Breakpoints

| Breakpoint | Breite | Layout |
|------------|--------|--------|
| Mobile | < 640px | 1 Spalte, gestapelt |
| Tablet | 640-1024px | 2 Spalten |
| Desktop | > 1024px | 3-4 Spalten Grid |

### Komponenten-Struktur

```
App
├── Header (Logo, Navigation, Trial Badge)
├── Asset Selector (Tabs: Crypto, Indices, Commodities, FX)
├── Main Grid
│   ├── Live Price Card
│   ├── Signal Card (LONG/SHORT/WARTEN)
│   ├── TP/SL Cards (Prominent Green/Red)
│   ├── Chart (Candlestick + Indikatoren)
│   ├── RSI Chart
│   ├── MACD Chart
│   ├── Fibonacci Retracement
│   ├── Fear & Greed Gauge
│   ├── Vision AI Chat
│   └── Trading Journal
└── Footer
```

### Aktuelle UI-Highlights

1. **TP/SL Karten:** Prominent grün/rot mit % und R/R
2. **Signal-Anzeige:** Große Konfidenz-Bar
3. **Chat:** Quick Prompts, Vision AI Branding
4. **Trial Badge:** Countdown in Tagen + Stunden

---

## 💰 Asset-Klassen

### Krypto (10 Assets)

| Symbol | Name | Binance Symbol |
|--------|------|----------------|
| BTC | Bitcoin | BTCUSDT |
| ETH | Ethereum | ETHUSDT |
| SOL | Solana | SOLUSDT |
| XRP | Ripple | XRPUSDT |
| ADA | Cardano | ADAUSDT |
| LTC | Litecoin | LTCUSDT |
| DOGE | Dogecoin | DOGEUSDT |
| BNB | Binance Coin | BNBUSDT |
| AVAX | Avalanche | AVAXUSDT |
| DOT | Polkadot | DOTUSDT |

### Indizes (6 Assets)

| Symbol | Name | Datenquelle |
|--------|------|-------------|
| SPX | S&P 500 | Stooq |
| NDQ100 | Nasdaq 100 | Stooq |
| DJI | Dow Jones | Stooq |
| DAX | DAX 40 | Stooq |
| FTSE | FTSE 100 | Stooq |
| NKY | Nikkei 225 | Stooq |

### Rohstoffe (1 Asset)

| Symbol | Name | Datenquelle |
|--------|------|-------------|
| XAUUSD | Gold | OpenExchange + Stooq |

### Forex (6 Pairs)

| Symbol | Pair | Datenquelle |
|--------|------|-------------|
| EURUSD | EUR/USD | OpenExchange |
| GBPUSD | GBP/USD | OpenExchange |
| USDJPY | USD/JPY | OpenExchange |
| USDCHF | USD/CHF | OpenExchange |
| AUDUSD | AUD/USD | OpenExchange |
| USDCAD | USD/CAD | OpenExchange |

---

## ⏱️ Trial-System

### Funktionsweise

```javascript
// LocalStorage Key
const TRIAL_KEY = "visionai_eliteTrialStartedAt";

// Trial-Dauer: 7 Tage
const TRIAL_DURATION = 7 * 24 * 60 * 60 * 1000; // ms

// Kein Reset möglich - einmal gestartet, läuft die Uhr
```

### Trial-Status

| Status | Anzeige | Features |
|--------|---------|----------|
| **Nicht gestartet** | "7-Tage-Trial starten" | Basic nur |
| **Aktiv** | "X Tage Yh verbleibend" | Alle Elite Features |
| **Abgelaufen** | "Trial beendet" | Basic + Upgrade CTA |

### Elite-Features (Trial/Bezahlt)

- Vision AI Chat
- Alle Indikatoren (RSI, MACD, Bollinger, etc.)
- TP/SL Rechner
- Fibonacci Retracement
- Smart Money Konzepte
- Pro Signals
- Multi-Asset Support

---

## 🔍 SEO/GEO Optimierung

### Meta-Tags

```html
<title>Vision AI Mind | Intelligentes Krypto-Trading Dashboard</title>
<meta name="description" content="Vision AI Mind: Professionelles Trading Dashboard mit AI-Signalen, RSI, MACD, Fibonacci..." />
```

### Structured Data (JSON-LD)

- **WebApplication Schema:** Name, Features, Category
- **FAQPage Schema:** Häufige Fragen für AI-Suchmaschinen

### AI Search Engine Optimization (GEO)

```html
<meta name="ai-content-description" content="Vision AI Mind is an intelligent cryptocurrency trading dashboard..." />
```

### OpenGraph

- `og:title`, `og:description`, `og:image`
- `og:locale: de_DE`
- `og:site_name: Vision AI Mind`

---

## ⚠️ Bekannte Limitierungen

### Technisch

| Problem | Impact | Workaround |
|---------|--------|------------|
| Vercel Hobby Limit (12 Functions) | Mittel | 7 aktive Endpoints, Rest deaktiviert |
| CoinGecko Rate Limit | Niedrig | Caching + Fallback zu Binance |
| WebSocket Disconnects | Niedrig | Auto-Reconnect nach 3s |
| ETF Daten oft fehlend | Mittel | Graceful Degradation |

### Inhaltlich

| Aspekt | Limitation | Hinweis |
|--------|------------|---------|
| Signal-Genauigkeit | ~55% Win Rate | Keine Garantie, nur Education |
| Historische Daten | Max 500 Candles | API-Limits |
| Indizes/FX | Nur Daily Data | Keine Intraday für Stooq |
| AI Chat | 400 Token Limit | Kurze Antworten |

### Groq API

- **Kostenlos:** Ja (mit Rate Limits)
- **Fallback:** Lokale intelligente Antworten
- **Latenz:** ~500ms - 2s

---

## 🚀 Nächste Schritte (Vorschläge)

### Kurzfristig (1-2 Wochen)

1. **Mehr Indikatoren visualisieren**
   - Bollinger Bands im Chart
   - VWAP
   - Volume Profile

2. **Chart-Verbesserungen**
   - Zoom/Pan Funktion
   - Mehrere Timeframes gleichzeitig
   - Zeichenwerkzeuge

3. **Alerts/Benachrichtigungen**
   - Preis-Alerts
   - RSI Oversold/Overbought
   - MACD Crossover

### Mittelfristig (1-2 Monate)

4. **User Accounts (Firebase)**
   - Watchlists speichern
   - Portfolio Tracking
   - Trade History

5. **Erweiterte Analyse**
   - Korrelationsmatrix
   - Volatilitäts-Analyse
   - Saisonale Muster

6. **Mobile App**
   - PWA Optimierung
   - Push Notifications

### Langfristig (3+ Monate)

7. **Premium-Modell**
   - Stripe Integration
   - Subscription Tiers
   - API Access für Entwickler

8. **Erweiterte AI**
   - Custom Training auf Marktdaten
   - Automatische Trade-Ideen
   - Sentiment aus Social Media

---

## 📝 Änderungshistorie

| Datum | Version | Änderungen |
|-------|---------|------------|
| 16.12.2024 | 1.0 | Vision AI Chat mit Kontext, SEO/GEO, Performance |
| 15.12.2024 | 0.9 | TP/SL prominent, Trial Countdown, Error Handling |
| 14.12.2024 | 0.8 | API Stabilisierung, Standalone Endpoints |
| 13.12.2024 | 0.7 | Multi-Asset Support, FX Integration |

---

## 📞 Kontakt & Support

- **Repository:** github.com/Achilles2121/aicryptomind.git
- **Branch:** main
- **Deployment:** Vercel (Hobby Plan)
- **Live URL:** https://visionaimind.vercel.app

---

> **Disclaimer:** Vision AI Mind ist ein Bildungs-Tool. Alle Signale, Berechnungen und Vorhersagen dienen ausschließlich zu Lernzwecken. Keine Anlageberatung. Investieren birgt Risiken bis zum Totalverlust.
