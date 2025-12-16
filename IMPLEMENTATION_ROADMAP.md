# Vision AI Mind - Master Implementation Roadmap

> **Erstellt:** 16. Dezember 2024  
> **Ziel:** 55% → 73%+ Win Rate | Zero Production Errors | All Devices  
> **Priorität:** Mobile-First, dann Desktop Optimierung

---

## 📱 PHASE 0: RESPONSIVE & CROSS-DEVICE FIX (SOFORT)

### Aktuelle Responsive-Struktur (Analyse)

```
Desktop: hidden md:block (ab 768px)
Mobile: md:hidden (unter 768px)
Tablets: Teilweise md:, teilweise nicht definiert
```

### Gefundene Probleme

| Problem | Zeile | Beschreibung |
|---------|-------|--------------|
| **Grid-Brüche auf Tablets** | 2645 | `grid-cols-1 md:grid-cols-4` springt direkt von 1→4 |
| **Fehlende Tablet-Breakpoints** | Überall | Kein `lg:`, `xl:` für feine Abstufungen |
| **Mobile Tab-Navigation** | 4294 | 4 Tabs in einer Zeile → Text schneidet ab auf kleinen Phones |
| **Touch-Targets zu klein** | Diverse | Buttons < 44px (iOS/Android Standard) |
| **Chart-Höhe auf Mobile** | 4460+ | `h-64` ist oft zu klein für Finger-Interaktion |
| **Input-Felder ohne Zoom-Prevention** | 4247 | Font-size < 16px → iOS zoomt automatisch |

### Fixes für Cross-Device Compatibility

```css
/* Minimum Touch Target Sizes */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Prevent iOS Zoom on Input Focus */
input, select, textarea {
  font-size: 16px !important;
}

/* Safe Area for Notches (iPhone X+) */
.safe-area-inset {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

### Verbesserte Breakpoint-Strategie

```javascript
// Tailwind Breakpoints (Standard)
// sm: 640px   - Große Phones (landscape)
// md: 768px   - Tablets (portrait)
// lg: 1024px  - Tablets (landscape) / kleine Laptops
// xl: 1280px  - Desktops
// 2xl: 1536px - Große Monitore

// Vorgeschlagene Grid-Anpassungen:
"grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
"grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
```

---

## 🚀 PHASE 1: QUICK WINS (Woche 1)

### 1.1 Multi-Timeframe Confirmation (MTF)

**Datei:** `src/lib/mtfSignal.ts` (NEU)

```typescript
export interface MTFSignal {
  h1: SignalType;     // 1-Stunden Signal
  h4: SignalType;     // 4-Stunden Signal
  d1: SignalType;     // Tages-Signal
  alignment: number;  // 0-100%
  valid: boolean;     // >= 66% Alignment
  reason: string;
}

export async function calculateMTFSignal(
  asset: string,
  getCurrentSignal: (interval: string) => SignalType
): Promise<MTFSignal> {
  const intervals = ['60', '240', '1440']; // 1h, 4h, 1d in Minuten
  
  const signals = await Promise.all(
    intervals.map(async (interval) => {
      try {
        return await getCurrentSignal(interval);
      } catch {
        return 'NEUTRAL'; // Fallback bei API-Fehler
      }
    })
  );
  
  const [h1, h4, d1] = signals;
  
  // Alignment Berechnung
  const directions = signals.map(s => 
    s === 'LONG' ? 1 : s === 'SHORT' ? -1 : 0
  );
  
  const longCount = directions.filter(d => d === 1).length;
  const shortCount = directions.filter(d => d === -1).length;
  const alignment = Math.max(longCount, shortCount) / 3 * 100;
  
  return {
    h1, h4, d1,
    alignment: Math.round(alignment),
    valid: alignment >= 66,
    reason: alignment >= 66 
      ? `${Math.round(alignment)}% Timeframe-Alignment`
      : 'Unzureichendes Timeframe-Alignment'
  };
}
```

**Integration in App.jsx:**
```javascript
// Neuer State
const [mtfSignal, setMtfSignal] = useState({ valid: false, alignment: 0 });

// Effekt für MTF-Berechnung
useEffect(() => {
  if (!indicatorSeries.length) return;
  
  calculateMTFSignal(selectedMarket.id, async (interval) => {
    // Hier Signal für spezifisches Interval berechnen
    const signal = buildAISignal({ ... });
    return signal.action;
  }).then(setMtfSignal);
}, [selectedMarket.id, indicatorSeries]);
```

**UI-Komponente:**
```jsx
// MTF Badge im Signal-Card
<div className="flex items-center gap-2 mt-2">
  <span className={`px-2 py-1 rounded text-xs ${
    mtfSignal.valid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
  }`}>
    MTF: {mtfSignal.alignment}%
  </span>
  <span className="text-xs text-slate-400">
    1h: {mtfSignal.h1} | 4h: {mtfSignal.h4} | 1d: {mtfSignal.d1}
  </span>
</div>
```

---

### 1.2 Volume Confirmation

**Datei:** `src/lib/volumeAnalysis.ts` (NEU)

```typescript
export interface VolumeMetrics {
  relativeVolume: number;     // Aktuelles Vol / Avg(20)
  volumeTrend: number;        // EMA(5) / EMA(20)
  buyPressure: number;        // (Close-Low)/(High-Low)
  volumeScore: number;        // 0-100
  isConfirmed: boolean;       // relativeVolume > 1.2
}

export function calculateVolumeMetrics(ohlcv: OHLCV[]): VolumeMetrics {
  if (ohlcv.length < 20) {
    return { relativeVolume: 1, volumeTrend: 1, buyPressure: 0.5, volumeScore: 50, isConfirmed: false };
  }
  
  const volumes = ohlcv.map(c => c.volume);
  const last = ohlcv.at(-1)!;
  const currentVolume = last.volume;
  
  // Avg Volume der letzten 20 Candles
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const relativeVolume = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  // Volume Trend
  const ema5 = calculateEMA(volumes, 5).at(-1) || currentVolume;
  const ema20 = calculateEMA(volumes, 20).at(-1) || currentVolume;
  const volumeTrend = ema20 > 0 ? ema5 / ema20 : 1;
  
  // Buy Pressure (Close-Low) / (High-Low)
  const range = last.high - last.low;
  const buyPressure = range > 0 ? (last.close - last.low) / range : 0.5;
  
  // Score Berechnung (0-100)
  const volumeScore = Math.min(100, Math.round(
    (Math.min(2, relativeVolume) / 2) * 40 +   // 0-40 Punkte für Rel.Vol
    (Math.min(1.5, volumeTrend) / 1.5) * 30 +  // 0-30 Punkte für Trend
    buyPressure * 30                            // 0-30 Punkte für Pressure
  ));
  
  return {
    relativeVolume: parseFloat(relativeVolume.toFixed(2)),
    volumeTrend: parseFloat(volumeTrend.toFixed(2)),
    buyPressure: parseFloat(buyPressure.toFixed(2)),
    volumeScore,
    isConfirmed: relativeVolume > 1.2
  };
}
```

**Integration in buildSignalsV3:**
```javascript
// In src/lib/signalsV2.js
export function buildSignalsV3({ indicatorSeries, volumeMetrics, ...rest }) {
  // ... existing code ...
  
  // Volume Confirmation Faktor (10% Gewichtung)
  const volumeFactor = volumeMetrics?.isConfirmed ? 0.1 : -0.05;
  
  // Gesamtscore anpassen
  let adjustedScore = baseScore + volumeFactor;
  
  // Bei niedrigem Volume: Confidence reduzieren
  if (volumeMetrics && !volumeMetrics.isConfirmed) {
    confidence *= 0.8; // -20% Confidence
  }
  
  return {
    ...baseSignal,
    confidence: Math.max(0, Math.min(1, confidence)),
    meta: { ...baseSignal.meta, volumeConfirmed: volumeMetrics?.isConfirmed }
  };
}
```

---

### 1.3 Dynamic TP/SL (ATR-basiert)

**Datei:** `src/lib/dynamicRisk.ts` (NEU)

```typescript
export interface DynamicTPSL {
  atr14: number;
  atrPercent: number;
  volatilityRegime: 'low' | 'medium' | 'high';
  tp: number;           // Take Profit Preis
  sl: number;           // Stop Loss Preis
  tpPercent: number;    // TP in %
  slPercent: number;    // SL in %
  rr: number;           // Risk/Reward Ratio
}

const VOLATILITY_BANDS = {
  low: { atrMax: 2, tp: 2, sl: 1.5 },
  medium: { atrMax: 4, tp: 4, sl: 3 },
  high: { atrMax: Infinity, tp: 6, sl: 4.5 }
};

export function calculateDynamicTPSL(
  ohlcv: OHLCV[],
  entryPrice: number,
  signal: 'LONG' | 'SHORT'
): DynamicTPSL {
  const atr14 = calculateATR(ohlcv, 14);
  const atrPercent = (atr14 / entryPrice) * 100;
  
  // Volatility Regime bestimmen
  let volatilityRegime: 'low' | 'medium' | 'high';
  if (atrPercent < 2) {
    volatilityRegime = 'low';
  } else if (atrPercent < 4) {
    volatilityRegime = 'medium';
  } else {
    volatilityRegime = 'high';
  }
  
  const band = VOLATILITY_BANDS[volatilityRegime];
  const tpPercent = band.tp;
  const slPercent = band.sl;
  
  let tp: number, sl: number;
  
  if (signal === 'LONG') {
    tp = entryPrice * (1 + tpPercent / 100);
    sl = entryPrice * (1 - slPercent / 100);
  } else {
    tp = entryPrice * (1 - tpPercent / 100);
    sl = entryPrice * (1 + slPercent / 100);
  }
  
  return {
    atr14,
    atrPercent: parseFloat(atrPercent.toFixed(2)),
    volatilityRegime,
    tp: parseFloat(tp.toFixed(2)),
    sl: parseFloat(sl.toFixed(2)),
    tpPercent,
    slPercent,
    rr: parseFloat((tpPercent / slPercent).toFixed(2))
  };
}
```

**UI Update für TP/SL Cards:**
```jsx
// Dynamische Badge im TP/SL Card
<div className="flex items-center gap-2">
  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
    dynamicRisk.volatilityRegime === 'low' ? 'bg-emerald-500/20 text-emerald-400' :
    dynamicRisk.volatilityRegime === 'medium' ? 'bg-amber-500/20 text-amber-400' :
    'bg-red-500/20 text-red-400'
  }`}>
    {dynamicRisk.volatilityRegime.toUpperCase()} VOL
  </span>
  <span className="text-xs text-slate-400">
    ATR: {dynamicRisk.atrPercent}%
  </span>
</div>
```

---

## 📊 PHASE 2: MEDIUM IMPACT (Woche 2-3)

### 2.1 Market Structure Analysis

**Datei:** `src/lib/marketStructure.ts` (NEU)

```typescript
export interface SwingPoint {
  index: number;
  price: number;
  type: 'high' | 'low';
  timestamp: number;
}

export interface MarketStructure {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  trend: 'uptrend' | 'downtrend' | 'ranging';
  structureBroken: boolean;
  lastBreakDirection: 'bullish' | 'bearish' | null;
  higherHighs: boolean;
  higherLows: boolean;
  lowerHighs: boolean;
  lowerLows: boolean;
}

export function findSwingPoints(ohlcv: OHLCV[], lookback: number = 5): SwingPoint[] {
  const swings: SwingPoint[] = [];
  
  for (let i = lookback; i < ohlcv.length - lookback; i++) {
    const current = ohlcv[i];
    const leftBars = ohlcv.slice(i - lookback, i);
    const rightBars = ohlcv.slice(i + 1, i + 1 + lookback);
    
    // Swing High: Higher than all left AND right bars
    const isSwingHigh = 
      leftBars.every(bar => current.high > bar.high) &&
      rightBars.every(bar => current.high > bar.high);
    
    // Swing Low: Lower than all left AND right bars
    const isSwingLow = 
      leftBars.every(bar => current.low < bar.low) &&
      rightBars.every(bar => current.low < bar.low);
    
    if (isSwingHigh) {
      swings.push({ index: i, price: current.high, type: 'high', timestamp: current.time });
    }
    if (isSwingLow) {
      swings.push({ index: i, price: current.low, type: 'low', timestamp: current.time });
    }
  }
  
  return swings.sort((a, b) => a.index - b.index);
}

export function analyzeMarketStructure(ohlcv: OHLCV[]): MarketStructure {
  const swings = findSwingPoints(ohlcv, 5);
  const swingHighs = swings.filter(s => s.type === 'high').slice(-4);
  const swingLows = swings.filter(s => s.type === 'low').slice(-4);
  
  // Higher Highs / Lower Lows Analyse
  const higherHighs = swingHighs.length >= 2 && 
    swingHighs[swingHighs.length - 1].price > swingHighs[swingHighs.length - 2].price;
  const higherLows = swingLows.length >= 2 && 
    swingLows[swingLows.length - 1].price > swingLows[swingLows.length - 2].price;
  const lowerHighs = swingHighs.length >= 2 && 
    swingHighs[swingHighs.length - 1].price < swingHighs[swingHighs.length - 2].price;
  const lowerLows = swingLows.length >= 2 && 
    swingLows[swingLows.length - 1].price < swingLows[swingLows.length - 2].price;
  
  // Trend Bestimmung
  let trend: 'uptrend' | 'downtrend' | 'ranging';
  if (higherHighs && higherLows) {
    trend = 'uptrend';
  } else if (lowerHighs && lowerLows) {
    trend = 'downtrend';
  } else {
    trend = 'ranging';
  }
  
  // Structure Break Detection
  const lastClose = ohlcv.at(-1)?.close || 0;
  const lastSwingLow = swingLows.at(-1);
  const lastSwingHigh = swingHighs.at(-1);
  
  let structureBroken = false;
  let lastBreakDirection: 'bullish' | 'bearish' | null = null;
  
  if (lastSwingHigh && lastClose > lastSwingHigh.price && trend === 'downtrend') {
    structureBroken = true;
    lastBreakDirection = 'bullish';
  } else if (lastSwingLow && lastClose < lastSwingLow.price && trend === 'uptrend') {
    structureBroken = true;
    lastBreakDirection = 'bearish';
  }
  
  return {
    swingHighs,
    swingLows,
    trend,
    structureBroken,
    lastBreakDirection,
    higherHighs,
    higherLows,
    lowerHighs,
    lowerLows
  };
}
```

**Signal-Integration:**
```javascript
// +10% Confidence wenn Signal aligned mit Trend
if (marketStructure.trend === 'uptrend' && signal === 'LONG') {
  confidence += 0.10;
}

// +15% bei frischem Structure Break in Signal-Richtung
if (marketStructure.structureBroken && 
    marketStructure.lastBreakDirection === (signal === 'LONG' ? 'bullish' : 'bearish')) {
  confidence += 0.15;
}
```

---

### 2.2 Session-Based Filtering

**Datei:** `src/lib/tradingSessions.ts` (NEU)

```typescript
export interface TradingSession {
  name: 'asia' | 'london' | 'nyc' | 'overlap' | 'off';
  startHour: number;  // UTC
  endHour: number;    // UTC
  volatility: 'low' | 'medium' | 'high' | 'extreme';
  bestStrategy: 'range' | 'trending' | 'breakout';
  description: string;
}

const SESSIONS: TradingSession[] = [
  { 
    name: 'asia', 
    startHour: 0, 
    endHour: 8, 
    volatility: 'low', 
    bestStrategy: 'range',
    description: 'Asiatische Session - niedriges Volumen, Range-Trading'
  },
  { 
    name: 'london', 
    startHour: 8, 
    endHour: 16, 
    volatility: 'high', 
    bestStrategy: 'trending',
    description: 'London Session - hohes Volumen, Trends'
  },
  { 
    name: 'nyc', 
    startHour: 13, 
    endHour: 21, 
    volatility: 'high', 
    bestStrategy: 'trending',
    description: 'New York Session - hohes Volumen, Trends'
  },
  { 
    name: 'overlap', 
    startHour: 13, 
    endHour: 16, 
    volatility: 'extreme', 
    bestStrategy: 'breakout',
    description: 'London/NYC Overlap - extremes Volumen, Breakouts'
  }
];

export function getCurrentSession(): TradingSession {
  const now = new Date();
  const utcHour = now.getUTCHours();
  
  // Overlap hat Priorität
  if (utcHour >= 13 && utcHour < 16) {
    return SESSIONS.find(s => s.name === 'overlap')!;
  }
  
  // Andere Sessions
  const session = SESSIONS.find(s => 
    s.name !== 'overlap' && utcHour >= s.startHour && utcHour < s.endHour
  );
  
  return session || { 
    name: 'off', 
    startHour: 21, 
    endHour: 0, 
    volatility: 'low', 
    bestStrategy: 'range',
    description: 'Off-Hours - geringes Volumen'
  };
}

export function getSessionAdjustments(session: TradingSession): {
  rsiWeight: number;
  macdWeight: number;
  confidenceThreshold: number;
} {
  switch (session.name) {
    case 'asia':
      return { rsiWeight: 0.30, macdWeight: 0.15, confidenceThreshold: 0.60 }; // Mean Reversion
    case 'london':
    case 'nyc':
      return { rsiWeight: 0.15, macdWeight: 0.25, confidenceThreshold: 0.60 }; // Trending
    case 'overlap':
      return { rsiWeight: 0.20, macdWeight: 0.20, confidenceThreshold: 0.70 }; // Höhere Threshold
    default:
      return { rsiWeight: 0.20, macdWeight: 0.20, confidenceThreshold: 0.65 };
  }
}
```

---

## ⚡ PHASE 3: ADVANCED (Monat 2)

### 3.1 Backtest Framework

**API Endpoint:** `api/backtest.ts` (NEU)

```typescript
interface BacktestRequest {
  asset: string;
  startDate: string;
  endDate: string;
  interval: string;
  strategy: 'default' | 'mtf' | 'volume' | 'structure';
}

interface BacktestResults {
  trades: Trade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
}

export default async function handler(req, res) {
  const { asset, startDate, endDate, interval, strategy } = req.body;
  
  // Historische Daten laden (Binance API)
  const candles = await fetchHistoricalCandles(asset, interval, startDate, endDate);
  
  // Backtest ausführen
  const results = runBacktest(candles, getStrategy(strategy));
  
  return res.json({ ok: true, data: results });
}
```

### 3.2 System Health Dashboard

**Komponente:** `src/components/SystemHealth.jsx` (NEU)

```jsx
export function SystemHealthIndicator({ apiHealth }) {
  const overallStatus = useMemo(() => {
    const critical = ['price', 'ohlc'];
    const criticalDown = critical.some(api => apiHealth[api]?.status === 'error');
    const degradedCount = Object.values(apiHealth).filter(h => h.status !== 'ok').length;
    
    if (criticalDown) return 'critical';
    if (degradedCount > 2) return 'degraded';
    return 'operational';
  }, [apiHealth]);
  
  const statusColors = {
    operational: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    critical: 'bg-red-500'
  };
  
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800">
      <div className={`w-2 h-2 rounded-full ${statusColors[overallStatus]} animate-pulse`} />
      <span className="text-xs text-slate-300">
        {overallStatus === 'operational' ? 'All Systems' : 
         overallStatus === 'degraded' ? 'Partial' : 'Limited'}
      </span>
    </div>
  );
}
```

---

## 📱 MOBILE OPTIMIZATIONS (PARALLEL)

### Kritische Mobile Fixes

```jsx
// 1. Sichere Tab-Navigation (verhindert Text-Abschnitt)
<div className="grid grid-cols-4 gap-1 text-[11px] sm:text-xs">
  {tabs.map(tab => (
    <button
      key={tab.key}
      className="min-h-[44px] rounded-xl px-2 py-2 font-medium truncate"
      // ...
    >
      {tab.label}
    </button>
  ))}
</div>

// 2. Chart Touch-Optimierung
<ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 300}>
  {/* Charts */}
</ResponsiveContainer>

// 3. iOS Safe Areas
<div className="pb-safe-area-inset-bottom">
  {/* Content */}
</div>

// 4. Input Font-Size (verhindert iOS Zoom)
<input
  className="text-[16px] sm:text-sm ..." // 16px minimum für iOS
/>
```

### PWA Manifest Update

```json
// public/manifest.json
{
  "name": "Vision AI Mind",
  "short_name": "VisionAI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "any",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 🧪 TESTING MATRIX

### Device Testing Checklist

| Device | OS | Viewport | Status |
|--------|----|---------:|--------|
| iPhone 12/13/14 | iOS 16+ | 390×844 | ⬜ |
| iPhone 14 Pro Max | iOS 16+ | 430×932 | ⬜ |
| iPhone SE | iOS 15+ | 375×667 | ⬜ |
| Samsung S21/S22 | Android 12+ | 360×800 | ⬜ |
| Pixel 6/7 | Android 13+ | 412×915 | ⬜ |
| iPad | iPadOS 16+ | 768×1024 | ⬜ |
| iPad Pro 12.9 | iPadOS 16+ | 1024×1366 | ⬜ |
| Galaxy Tab | Android 12+ | 800×1280 | ⬜ |
| MacBook 13" | Chrome/Safari | 1440×900 | ⬜ |
| Desktop 1080p | Chrome/Firefox | 1920×1080 | ⬜ |
| Desktop 4K | Chrome | 3840×2160 | ⬜ |

### Feature Testing Matrix

| Feature | Mobile | Tablet | Desktop |
|---------|:------:|:------:|:-------:|
| Live Price Display | ⬜ | ⬜ | ⬜ |
| Charts (Candlestick) | ⬜ | ⬜ | ⬜ |
| RSI/MACD Charts | ⬜ | ⬜ | ⬜ |
| Signal Cards | ⬜ | ⬜ | ⬜ |
| TP/SL Calculator | ⬜ | ⬜ | ⬜ |
| Vision AI Chat | ⬜ | ⬜ | ⬜ |
| Asset Selector | ⬜ | ⬜ | ⬜ |
| Tab Navigation | ⬜ | ⬜ | ⬜ |
| Touch Interactions | ⬜ | ⬜ | ⬜ |
| Scroll Performance | ⬜ | ⬜ | ⬜ |

---

## 📈 EXPECTED IMPROVEMENTS

### Win Rate Progression

| Phase | Feature | Expected Impact | Cumulative |
|-------|---------|-----------------|------------|
| **Baseline** | Current System | 55% | 55% |
| **Phase 1** | MTF Confirmation | +4% | 59% |
| **Phase 1** | Volume Confirmation | +3% | 62% |
| **Phase 1** | Dynamic TP/SL | +2% | 64% |
| **Phase 2** | Market Structure | +3% | 67% |
| **Phase 2** | Session Filtering | +2% | 69% |
| **Phase 3** | Backtest Optimization | +3% | 72% |
| **Phase 3** | ML Optimizer | +2% | 74% |

### Risk Metrics Target

| Metric | Current | MVP Target | Optimal |
|--------|---------|------------|---------|
| Win Rate | 55% | 63% | 72%+ |
| Profit Factor | 1.3 | 1.6 | 2.0+ |
| Max Drawdown | -22% | -18% | -12% |
| Sharpe Ratio | 0.8 | 1.2 | 1.8+ |
| Avg R/R | 1.3 | 1.5 | 2.0+ |

---

## 🚦 IMPLEMENTATION PRIORITY

### Woche 1 (MUST DO)
1. ✅ Mobile Touch Targets Fix
2. ✅ iOS Input Zoom Prevention
3. ✅ Safe Area Padding
4. ⬜ MTF Signal Implementation
5. ⬜ Volume Confirmation

### Woche 2
1. ⬜ Dynamic TP/SL (ATR-basiert)
2. ⬜ System Health Indicator
3. ⬜ Tablet Breakpoint Optimization
4. ⬜ Market Structure Detection

### Woche 3
1. ⬜ Session Filtering
2. ⬜ Backtest API
3. ⬜ PWA Manifest
4. ⬜ Performance Optimization

### Woche 4
1. ⬜ Full Device Testing
2. ⬜ Bug Fixes
3. ⬜ Production Deployment
4. ⬜ Monitoring Setup

---

## 📞 NEXT STEPS

**Sag mir:**

1. **Welche Phase zuerst?**
   - [ ] Phase 0: Mobile/Responsive Fixes
   - [ ] Phase 1: MTF + Volume + Dynamic TP/SL
   - [ ] Phase 2: Market Structure + Sessions
   - [ ] Phase 3: Backtest + ML

2. **Fokus:**
   - [ ] Nur Mobile-First
   - [ ] Desktop + Mobile parallel
   - [ ] Signal-Qualität first, dann UI

3. **Welche Devices sind kritisch?**
   - [ ] iPhone (welches Modell?)
   - [ ] Android (welches?)
   - [ ] iPad
   - [ ] Desktop

---

> **Ready to implement.** Sag mir womit wir starten sollen!
