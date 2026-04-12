# VISION AI MIND - SYSTEM MASTER PROMPT

> **Zweck:** Dieses Dokument definiert die verbindlichen Regeln fuer Design, Architektur, Datenfluss und Entwicklungsentscheidungen des Vision AI Mind Crypto Risk Managers. Jede Aenderung am System muss diesen Regeln folgen.

---

## 1. PROJEKT-IDENTITAET

| Feld | Wert |
|------|------|
| **Name** | Vision AI Mind - Elite Trader |
| **Typ** | Realtime Crypto & Multi-Asset Risk Dashboard |
| **URL** | https://visionaimind.vercel.app |
| **Stack** | React 19 + Vite 6 + Tailwind 3.4 + Zustand 4.5 + Firebase Auth |
| **Deploy** | Vercel Serverless (Frontend + API) + Express Backend (Port 5176) |
| **Sprache** | Deutsch (Standard) / Englisch (via `?lang=en`) |
| **Zielgruppe** | Krypto-Trader, Risiko-Analysten, Portfolio-Manager |

---

## 2. ARCHITEKTUR-REGELN

### 2.1 Monolith-Management
- **App.jsx** ist das zentrale Dashboard (~3500 Zeilen). Neue Features gehoeren in `src/features/` als eigene Module.
- Neue Feature-Komponenten muessen **lazy-loaded** werden:
  ```jsx
  const NewFeature = lazy(() => import("./features/new/NewFeature"));
  ```
- Maximal **5 gleichzeitige `setInterval`-Timer** in App.jsx. Neue Polling-Logik in Zustand-Stores auslagern.
- Neue `useState`-Variablen in App.jsx nur wenn absolut noetig. Bevorzuge Zustand-Stores.

### 2.2 State-Management-Hierarchie
```
Zustand Stores (global, persistent)
  └── usePriceStore.ts      → Live-Preise (WebSocket + REST)
  └── useCandleStore.ts     → OHLC-Daten (Multi-Timeframe)
  └── useSignalTrackingStore → Signal-Historie

React Context (auth-scoped)
  └── UserTierContext        → Tier + Trial-Status
  └── SubscriptionContext    → Feature-Matrix

App.jsx useState (UI-scoped)
  └── Nur fuer lokale UI-States (Tabs, Modals, Toggles)
```

### 2.3 Datenfluss-Prinzip
```
WebSocket/REST → Zustand Store → React Component → UI
                       ↓
              Server Signal Engine → Signal Panel
```
- **Kein direkter `fetch()` in Komponenten.** Alle API-Aufrufe laufen ueber Services (`src/services/`) oder Zustand-Store-Actions.
- **Kein State-Drilling ueber mehr als 2 Ebenen.** Ab 3 Ebenen → Zustand Store oder Context verwenden.

---

## 3. DATENQUELLEN & REFRESH-RATEN

| Quelle | Protokoll | Refresh | Cache TTL | Fallback |
|--------|-----------|---------|-----------|----------|
| **Binance WebSocket** | WSS | Echtzeit (Trade-Ticks) | Kein Cache | REST Polling 30s |
| **Binance REST** | HTTPS | 30s Polling | 30s | CoinGecko |
| **CoinGecko** | REST | 30s Polling | 30s | CoinCap |
| **OANDA** | REST | 15s Polling | 15s | Yahoo Finance |
| **Kraken** | REST | 60s | 60s | Binance |
| **Fear & Greed** | REST | 30s | 30s | Cache-Wert behalten |
| **TradingView** | Embed/Widget | Echtzeit | Browser-Cache | Kein |

### 3.1 Polling-Regeln
- **POLL_INTERVAL**: 30 Sekunden (minimum, nie unter 15s)
- **WebSocket-Reconnect**: 1.5s Delay, max 5 Versuche, dann REST-Fallback
- **API Rate Limit**: 240 Requests/Minute (Server-seitig)
- **Cache-First**: Immer Cache pruefen vor neuem Fetch. TTL-basierte Invalidierung.
- **Fallback-Kette**: Primaerquelle → Sekundaerquelle → Cache-Wert → Letzter bekannter Wert

### 3.2 Daten-Zuverlaessigkeit
| Datentyp | Latenz | Genauigkeit |
|----------|--------|-------------|
| Live-Preis (WebSocket) | <100ms | Tick-genau von Binance |
| Live-Preis (REST) | 1-5s | ±0.1% (API-Aggregation) |
| OHLC-Kerzen | 60s Cache | Exchange-genau |
| Fear & Greed Index | ~30s | Tagesdaten (alternative.me) |
| Sentiment-Daten | ~30s | Aggregiert (mehrere Quellen) |
| Signal-Engine | Echtzeit auf Basis der letzten Daten | Abhaengig von Indikator-Inputs |

---

## 4. SIGNAL ENGINE

### 4.1 8-Punkt-Algorithmus (Server-seitig, IP-geschuetzt)
Der Signal-Engine in `server/signalEngine.js` berechnet:

1. **RSI** (Relative Strength Index) - Momentum
2. **MACD** (Moving Average Convergence Divergence) - Trend-Bestaetigung
3. **EMA Cross** (20/50/200) - Trend-Richtung
4. **ATR** (Average True Range) - Volatilitaet & TP/SL
5. **Bollinger Bands** - Standardabweichung
6. **Stochastic Oscillator** - Momentum-Bestaetigung
7. **Volume Profile** - Volumen-Analyse
8. **Market Regime** - Marktphase (Bull/Bear/Range)

### 4.2 Asset-Klassen-Parameter
| Parameter | Crypto | Commodity | Forex |
|-----------|--------|-----------|-------|
| RSI Oversold | 30 | 35 | 40 |
| RSI Overbought | 70 | 65 | 60 |
| ATR Multiplier | 1.5x | 1.2x | 1.0x |
| Bollinger StdDev | 2.0-2.5 | 2.0 | 1.5 |

### 4.3 Market Regime Detection
| Regime | Anpassung | Confidence |
|--------|-----------|------------|
| BULL_TREND | Overbought weiter, Oversold enger | 1.2x |
| BEAR_TREND | Oversold weiter, Overbought enger | 1.2x |
| RANGE | Engere Baender | 0.8x |
| HIGH_VOLATILITY | Weitere Baender | Standard |
| CONSOLIDATION | Warten auf Breakout | 0.6x |

### 4.4 Signal-Output
```json
{
  "signal": "BUY | SELL | NEUTRAL",
  "confidence": 0.0 - 1.0,
  "entry": 64250.00,
  "takeProfit": 66800.00,
  "stopLoss": 63100.00,
  "reasoning": "RSI oversold + MACD bullish cross + EMA trend aligned",
  "regime": "BULL_TREND"
}
```

---

## 5. DESIGN-SYSTEM

### 5.1 Farbpalette
```css
--background:   #0f172a   /* Slate-950 - Haupt-Hintergrund */
--surface:      #1e293b   /* Slate-800 - Karten-Hintergrund */
--border:       #334155   /* Slate-700 - Raender */
--text:         #e2e8f0   /* Slate-200 - Haupttext */
--text-muted:   #94a3b8   /* Slate-400 - Sekundaertext */
--emerald:      #10b981   /* Positiv / Bullish / Buy */
--red:          #ef4444   /* Negativ / Bearish / Sell */
--amber:        #f59e0b   /* Warnung / Neutral */
--cyan:         #22d3ee   /* Akzent / Links / Highlights */
```

### 5.2 Karten-Styling
```
VERBOTEN:
  ✗ backdrop-filter: blur()     → GPU-Killer beim Scrollen
  ✗ filter: blur() auf grossen Elementen
  ✗ animation laenger als 3s auf sichtbaren Elementen
  ✗ box-shadow mit spread > 20px

PFLICHT:
  ✓ background: rgba(30,41,59,0.85)  → Solide Opacity statt Blur
  ✓ contain: layout style             → CSS Containment fuer Karten
  ✓ border: 1px solid rgba(51,65,85,0.3)
  ✓ border-radius: 12px (0.75rem)
  ✓ will-change: nur auf animierten Elementen
```

### 5.3 Responsive Design
| Breakpoint | Layout | Touch-Target |
|------------|--------|-------------|
| < 768px | Mobile (single column) | Min 44px Hoehe |
| 768px-1024px | Tablet (2 columns) | Min 44px Hoehe |
| > 1024px | Desktop (grid layout) | Standard |

### 5.4 Scroll-Regeln
```
VERBOTEN:
  ✗ overflow-y: auto auf Root-Container
  ✗ Verschachtelte Scroll-Container (ausser in Karten mit max-height)
  ✗ overscroll-behavior auf dem Root
  ✗ JavaScript-basiertes Scroll-Hijacking

PFLICHT:
  ✓ Native Body-Scroll (html, body { overflow-x: hidden; })
  ✓ scroll-behavior: smooth auf html
  ✓ Scroll-Container nur innerhalb von Karten (z.B. Coin-Listen)
```

### 5.5 Animationen
| Animation | Dauer | Einsatz | GPU-Safe |
|-----------|-------|---------|----------|
| pulseSoft | 2s | Live-Indikatoren | Ja (opacity + scale) |
| tickUp/tickDown | 0.5s | Preis-Updates | Ja (color) |
| shimmer | 1.5s | Skeleton-Loading | Ja (translateX) |
| fadeIn | 0.3s | Karten-Einblendung | Ja (opacity) |

---

## 6. TIER-SYSTEM

### 6.1 Feature-Matrix
| Feature | Basic (Free) | Pro | Elite |
|---------|-------------|-----|-------|
| Live-Preise | ✓ | ✓ | ✓ |
| Charts (Basic) | ✓ | ✓ | ✓ |
| Indikatoren (5) | ✓ | ✓ | ✓ |
| Multi-Timeframe | ✗ | ✓ | ✓ |
| Portfolio-Tracker | ✗ | ✓ | ✓ |
| AI Signal Engine | ✗ | ✗ | ✓ |
| Fibonacci Levels | ✗ | ✗ | ✓ |
| Alerts (10 max) | ✗ | ✓ | ✓ |
| Correlations | ✗ | ✗ | ✓ |

### 6.2 Trial-System
- **Dauer**: 7 Tage
- **Speicher**: Firebase Firestore + LocalStorage (trialService.ts)
- **Upgrade-Pfad**: Trial → Basic (automatisch) → Pro/Elite (Payment)
- **Feature-Gating**: `FeatureGate` Komponente oder `hasFeature()` aus SubscriptionContext

---

## 7. PERFORMANCE-REGELN

### 7.1 Bundle-Limits
| Metrik | Maximum | Aktuell |
|--------|---------|---------|
| Groesster Chunk (gzip) | 120 KB | ~112 KB |
| Total Bundle (gzip) | 300 KB | ~280 KB |
| Build-Zeit | 15s | ~10s |
| First Contentful Paint | 2s | ~1.8s |
| Lazy-loaded Chunks | Min 3 | 3 (Signal, Chart, Risk) |

### 7.2 Rendering-Regeln
```
VERBOTEN:
  ✗ useEffect ohne Dependency-Array
  ✗ Mehr als 5 setInterval gleichzeitig in einer Komponente
  ✗ Inline-Objekte als Props (erzeugt Re-Renders)
  ✗ Indicator-Berechnung im Render-Pfad (ohne useMemo)

PFLICHT:
  ✓ useMemo fuer teure Berechnungen (Indikatoren, Chart-Daten)
  ✓ useCallback fuer Event-Handler die als Props weitergegeben werden
  ✓ React.lazy fuer Features > 20KB
  ✓ Suspense-Wrapper um lazy-loaded Bereiche
```

### 7.3 Netzwerk-Regeln
```
VERBOTEN:
  ✗ Fetch ohne Timeout (max 5s)
  ✗ Fetch ohne Error-Handling
  ✗ Parallele Fetches zur gleichen API (Race Conditions)
  ✗ Polling unter 15s Intervall

PFLICHT:
  ✓ safeFetch() Utility mit Timeout + Retry
  ✓ Cache-Check vor jedem Fetch
  ✓ AbortController fuer abbrechbare Requests
  ✓ Fallback-Kette bei API-Fehlern
```

---

## 8. DATEI-STRUKTUR-REGELN

```
src/
├── App.jsx            → Dashboard-Orchestrierung (KEIN neuer Code hier)
├── components/        → Wiederverwendbare UI-Bausteine
├── features/          → Feature-Module (lazy-loaded)
│   ├── charts/        → Chart-Rendering
│   ├── signals/       → Signal-Panel
│   ├── risk/          → Risk-Terminal
│   └── [neu]/         → Neue Features hier anlegen
├── config/            → Konfigurationsdateien (Assets, Tiers, Branding)
├── context/           → React Context (Auth, Subscription)
├── hooks/             → Custom Hooks
├── lib/               → Business-Logik (Indikatoren, Signals)
├── services/          → API-Service-Layer
├── stores/            → Zustand Stores (globaler State)
├── styles/            → Zusaetzliche CSS-Dateien
└── types/             → TypeScript-Typen

api/                   → Vercel Serverless Functions
server/                → Express Backend (lokaler Dev-Server)
├── indicators/        → Technische Indikatoren (serverseitig)
├── routes/            → API-Routen
└── signalEngine.js    → Signal-Algorithmus (IP-geschuetzt)
```

### 8.1 Neue Feature Checkliste
1. Feature-Ordner in `src/features/[name]/` erstellen
2. Hauptkomponente als Default-Export
3. Lazy-Import in App.jsx oder Router
4. Suspense-Wrapper um die Komponente
5. Feature-Gate fuer Tier-Beschraenkung
6. Mobile-Responsive testen (< 768px)
7. Performance pruefen: keine neuen setInterval, useMemo fuer teure Ops

---

## 9. API-DESIGN-REGELN

### 9.1 Endpoint-Konvention
```
GET /api/[resource]          → Daten abrufen
GET /api/[resource]?symbol=X → Asset-spezifisch
POST /api/[resource]         → Daten senden/berechnen

Response-Format:
{
  "ok": true/false,
  "data": { ... },
  "error": "Fehlerbeschreibung",
  "cached": true/false,
  "timestamp": 1234567890
}
```

### 9.2 Error-Handling
```
4xx → Client-Fehler (ungueltige Parameter)
5xx → Server-Fehler (API-Ausfall, Timeout)

Jeder Endpoint:
  1. Parameter validieren
  2. Cache pruefen
  3. Primaerquelle fetchen (mit Timeout)
  4. Bei Fehler → Fallback-Quelle
  5. Bei komplettem Fehler → Cache-Wert oder sinnvoller Default
```

---

## 10. GIT-WORKFLOW

### 10.1 Branch-Strategie
```
main          → Produktion (Vercel Auto-Deploy)
feature/*     → Neue Features
fix/*         → Bugfixes
perf/*        → Performance-Optimierungen
```

### 10.2 Commit-Konvention
```
feat: Neue Funktion hinzugefuegt
fix: Bug behoben
perf: Performance-Optimierung
refactor: Code-Umstrukturierung (keine Funktionsaenderung)
style: UI/CSS-Aenderung
docs: Dokumentation
chore: Build, Dependencies, Config
```

### 10.3 Deploy-Regel
- **Vor jedem Push**: `npx vite build` muss erfolgreich sein
- **Vor jedem Push**: `npx eslint src/` muss 0 Errors haben
- **Kein Force-Push** auf main
- **Vercel Auto-Deploy** bei Push auf main

---

## 11. SICHERHEITS-REGELN

1. **Keine API-Keys im Frontend-Code** → Nur ueber Vercel Environment Variables
2. **Firebase Security Rules** → Tier-Validierung serverseitig
3. **Rate Limiting** → 240 req/min auf Express, Vercel Edge Protection
4. **CORS** → Nur erlaubte Origins in vercel.json
5. **Input-Validierung** → Alle Query-Parameter sanitizen
6. **Kein `eval()`, kein `dangerouslySetInnerHTML`** ohne Sanitization
7. **Signal Engine** → Nur auf Server berechnet (IP-Schutz)

---

## 12. VERBOTENE MUSTER

| Muster | Warum verboten | Alternative |
|--------|---------------|-------------|
| `backdrop-filter: blur()` | GPU-Killer, Scroll-Lag | Solide rgba() Backgrounds |
| `overflow-y: auto` auf Root | Blockiert nativen Scroll | Body-Scroll nutzen |
| `setInterval` in Komponenten | Memory Leaks, CPU-Spikes | Zustand Store + cleanup |
| Inline-Objekte als Props | Unnoetige Re-Renders | useMemo/useCallback |
| `console.log` in Production | Bundle-Groesse, Noise | Entfernt durch Vite Terser |
| Nested Scroll-Container | Scroll-Jank, UX-Horror | Flache Layouts |
| ETF-bezogener Code | Feature entfernt | Nicht wieder einfuegen |
| `useEffect` ohne Cleanup | Timer-Leaks | Return Cleanup-Funktion |
| CSS `filter: blur()` > 10px | GPU-Heavy | Solide Farben oder SVG |
| Fetch ohne Timeout | Haengende Requests | safeFetch() mit 5s Timeout |

---

*Letzte Aktualisierung: Alle Aenderungen muessen diesen Regeln folgen. Bei Regelkonflikten gilt: Performance > Design > Features.*
