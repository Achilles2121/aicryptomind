# 🧠 Vision AI Mind - Algorithm Documentation

## 8-Point Analysis System

**Proprietary Trading Algorithm | Confidential**

---

## Overview

The Vision AI Mind 8-Point Analysis is a multi-factor signal generation system that combines technical indicators, market structure analysis, and volatility-adjusted parameters to produce actionable BUY/SELL/HOLD signals with confidence scores.

---

## The 8 Analysis Points

### 1. RSI (Relative Strength Index) - Momentum
- **Purpose**: Identify overbought/oversold conditions
- **Period**: 14 candles (standard)
- **Asset-Adjusted Thresholds**:

| Asset Class | Oversold | Overbought | Weight |
|-------------|----------|------------|--------|
| Crypto      | 30       | 70         | 1.0x   |
| Commodity   | 35       | 65         | 1.2x   |
| Forex       | 40       | 60         | 0.8x   |

**Why Different Thresholds?**
- **Crypto**: High volatility means extreme readings are common → wider bands
- **Commodity (Gold)**: Safe-haven asset with mean-reversion tendency → tighter bands + higher weight
- **Forex**: Very low volatility, readings rarely go extreme → tightest bands

### 2. MACD - Trend Direction
- **Fast EMA**: 12
- **Slow EMA**: 26  
- **Signal Line**: 9
- **Analysis**:
  - Histogram direction (positive/negative)
  - Signal line crossover (bullish/bearish)
  - Divergence detection

### 3. Bollinger Bands - Volatility
- **Period**: 20
- **Standard Deviation**: 2
- **Signals**:
  - Price at lower band (< 10% position) → BUY potential
  - Price at upper band (> 90% position) → SELL potential
  - Band squeeze → Breakout imminent

### 4. EMA Cross (20/50) - Trend Confirmation
- **Golden Cross**: EMA20 crosses above EMA50 → Strong BUY
- **Death Cross**: EMA20 crosses below EMA50 → Strong SELL
- **Alignment**: Both EMAs trending same direction → Trend confirmation

### 5. Volume Profile - Market Participation
- **High Volume (>150% avg) + Price Up** → Bullish confirmation
- **High Volume + Price Down** → Bearish confirmation
- **Low Volume (<50% avg)** → Weak signal, reduce confidence

### 6. Support/Resistance Levels - Price Structure
- **Near Support (bottom 20%)** → BUY zone
- **Near Resistance (top 20%)** → SELL zone
- **Mid-Range** → No signal

### 7. Fibonacci Retracement - Key Levels
- **Key Levels**: 0.382, 0.5, 0.618 (Golden Zone)
- **Signal**: Price within 0.5% of key Fib level
- **618 Level** (Golden Zone) → Strongest reversal probability

### 8. Market Regime Detection - Context
- **High Volatility + Trend** → Strong signals valid
- **Low Volatility** → Range-bound, weaker signals
- **Regime Change** → Reset expectations

---

## Signal Computation Formula

```
Net Score = Σ(BUY scores) - Σ(SELL scores)

If Net Score > +50  → BUY
If Net Score < -50  → SELL
Otherwise           → HOLD

Confidence = |Net Score| / 500 × 100%
```

---

## ATR-Based TP/SL Calculation

### Asset-Adjusted ATR Parameters

| Asset Class | ATR Multiplier | Stop-Loss Factor |
|-------------|---------------|------------------|
| Crypto      | 1.5x          | 2.0x ATR         |
| Commodity   | 1.2x          | 1.5x ATR         |
| Forex       | 1.0x          | 1.2x ATR         |

### Take Profit Levels

```
TP1 = Entry ± (ATR × Multiplier × 1.5)  → 1:1 R/R minimum
TP2 = Entry ± (ATR × Multiplier × 2.5)  → 1.5:1 R/R
TP3 = Entry ± (ATR × Multiplier × 4.0)  → 2:1 R/R maximum
```

---

## Gold/Forex Specific Adjustments

### Gold (XAUUSD)
- **Volatility Profile**: MEDIUM (vs Crypto HIGH/EXTREME)
- **Safe-Haven**: Inverted correlation with risk assets
- **RSI Sensitivity**: Higher weight (1.2x) because:
  - Mean-reversion is stronger
  - Fewer whipsaw signals
  - Institutional participation is more predictable

### Forex Pairs (EUR, GBP, JPY)
- **Volatility Profile**: LOW to ULTRA_LOW
- **RSI Bands**: Tightest (40/60) because:
  - Daily ranges are small (0.3-0.8%)
  - 30/70 would almost never trigger
  - Central bank policies create slower trends
- **ATR Multiplier**: 1.0x (no scaling needed)

---

## Data Sources & Routing

### TradingView Symbol Resolution

| Asset Class | Provider | Symbol Format | Example |
|-------------|----------|---------------|---------|
| Crypto      | BINANCE  | BINANCE:XXXUSDT | BINANCE:BTCUSDT |
| Gold        | OANDA    | OANDA:XAUUSD | OANDA:XAUUSD |
| Forex EUR   | FX_IDC   | FX_IDC:EURUSD | FX_IDC:EURUSD |
| Forex GBP   | FX_IDC   | FX_IDC:GBPUSD | FX_IDC:GBPUSD |
| Forex JPY   | FX       | FX:USDJPY | FX:USDJPY |

### API Priority (Fallback Chain)

1. **Primary**: Binance WebSocket (crypto), OANDA API (gold)
2. **Secondary**: CoinGecko REST (crypto backup)
3. **Tertiary**: Yahoo Finance (forex, fallback)

---

## Confidence Levels Interpretation

| Confidence | Interpretation | Recommended Action |
|------------|---------------|-------------------|
| 0-25%      | Very weak     | HOLD, wait for clarity |
| 25-50%     | Moderate      | Small position if aligned with trend |
| 50-75%     | Good          | Standard position sizing |
| 75-100%    | Very strong   | Full position, consider pyramiding |

---

## Risk Management Rules

1. **Never risk more than 2%** of portfolio per trade
2. **Position size** = (Risk Amount) / (Entry - SL)
3. **Correlation check**: Don't take same-direction trades on correlated assets
4. **Regime filter**: Reduce size in high-volatility regimes

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0   | 2025-01-01 | Initial 8-point system |
| 1.1.0   | 2025-03-01 | Added Gold/Forex support |
| 1.2.0   | 2025-06-01 | ATR-based TP/SL, regime detection |

---

**© 2025 Vision AI Mind. All Rights Reserved.**
**CONFIDENTIAL - Unauthorized distribution prohibited.**
