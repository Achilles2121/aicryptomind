# 🚀 FREE Real-Time Trading APIs - Comprehensive Guide

> **Elite Trader Project** - Complete API Reference for Free Trading Data  
> Last Updated: 2025

---

## 📊 Quick Overview Table

| API | Category | Free Tier | WebSocket | API Key | Rate Limits |
|-----|----------|-----------|-----------|---------|-------------|
| **Binance** | Crypto | ✅ Unlimited | ✅ Yes | Optional (public) | 6,000/min weight |
| **Kraken** | Crypto | ✅ Yes | ✅ Yes (v2) | Optional (public) | Generous |
| **CoinGecko** | Crypto | ✅ Limited | ✅ Paid only | Required | 30 calls/min |
| **CoinCap** | Crypto | ✅ 4,000 credits/mo | ✅ Paid only | Required | 600 calls/min |
| **DeFiLlama** | On-Chain/DeFi | ✅ Yes | ❌ No | Not required | Generous |
| **Finnhub** | Stocks | ✅ Limited | ✅ Yes (FREE!) | Required | 30 calls/sec |
| **Alpha Vantage** | Stocks/Forex | ✅ 25 calls/day | ❌ No | Required | Very limited |
| **Frankfurter** | Forex | ✅ Unlimited | ❌ No | Not required | No limits |
| **Fear & Greed** | Sentiment | ✅ Unlimited | ❌ No | Not required | No limits |
| **CryptoCompare** | Crypto | ✅ Limited | ✅ Yes | Required | Tiered |

---

## 🔥 CRYPTO APIs

### 1. Binance API ⭐⭐⭐⭐⭐ (BEST FREE CRYPTO)

**The most comprehensive free crypto API with full WebSocket support.**

| Property | Value |
|----------|-------|
| **Base URL (REST)** | `https://api.binance.com/api/v3/` |
| **Base URL (WebSocket)** | `wss://stream.binance.com:9443/ws/` |
| **WebSocket Streams** | `wss://stream.binance.com:9443/stream?streams=` |
| **Authentication** | Not required for public endpoints |
| **Rate Limits** | 6,000 request weight/min, 300 WS connections/5min |

#### ✅ FREE Public Endpoints (No API Key):

```javascript
// Current Price
GET /api/v3/ticker/price?symbol=BTCUSDT

// 24h Ticker
GET /api/v3/ticker/24hr?symbol=BTCUSDT

// Order Book Depth
GET /api/v3/depth?symbol=BTCUSDT&limit=100

// Recent Trades
GET /api/v3/trades?symbol=BTCUSDT&limit=500

// Klines/Candlesticks (OHLCV)
GET /api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100

// Exchange Info (all symbols)
GET /api/v3/exchangeInfo

// Aggregate Trades
GET /api/v3/aggTrades?symbol=BTCUSDT
```

#### ✅ FREE WebSocket Streams:

```javascript
// Individual Trade Stream
wss://stream.binance.com:9443/ws/btcusdt@trade

// Kline/Candlestick Stream (1m, 5m, 1h, 1d, etc.)
wss://stream.binance.com:9443/ws/btcusdt@kline_1m

// Mini Ticker (24hr stats)
wss://stream.binance.com:9443/ws/btcusdt@miniTicker

// All Market Mini Tickers
wss://stream.binance.com:9443/ws/!miniTicker@arr

// Order Book Depth Updates
wss://stream.binance.com:9443/ws/btcusdt@depth@100ms

// Best Bid/Ask
wss://stream.binance.com:9443/ws/btcusdt@bookTicker

// Combined Streams
wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade
```

#### 📝 Example Usage:

```javascript
// REST API - Get BTC Price
const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
const data = await response.json();
console.log(data.price); // "105234.56"

// WebSocket - Real-time trades
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');
ws.onmessage = (event) => {
  const trade = JSON.parse(event.data);
  console.log(`Price: ${trade.p}, Qty: ${trade.q}`);
};
```

---

### 2. Kraken API ⭐⭐⭐⭐

**Reliable exchange API with WebSocket v2.**

| Property | Value |
|----------|-------|
| **Base URL (REST)** | `https://api.kraken.com/0/public/` |
| **WebSocket v2** | `wss://ws.kraken.com/v2` |
| **Docs** | https://docs.kraken.com/api/ |
| **Authentication** | Not required for public endpoints |

#### ✅ FREE Public Endpoints:

```javascript
// Ticker Info
GET /0/public/Ticker?pair=XBTUSD

// OHLC Data
GET /0/public/OHLC?pair=XBTUSD&interval=60

// Order Book
GET /0/public/Depth?pair=XBTUSD&count=100

// Recent Trades
GET /0/public/Trades?pair=XBTUSD

// Asset Pairs Info
GET /0/public/AssetPairs

// Server Time
GET /0/public/Time
```

#### ✅ WebSocket v2 (FREE):

```javascript
// Subscribe to ticker
{
  "method": "subscribe",
  "params": {
    "channel": "ticker",
    "symbol": ["BTC/USD"]
  }
}

// Subscribe to trades
{
  "method": "subscribe",
  "params": {
    "channel": "trade",
    "symbol": ["BTC/USD"]
  }
}

// Subscribe to OHLC
{
  "method": "subscribe",
  "params": {
    "channel": "ohlc",
    "symbol": ["BTC/USD"],
    "interval": 60
  }
}
```

---

### 3. CoinGecko API ⭐⭐⭐⭐

**Best for metadata, market caps, and historical data.**

| Property | Value |
|----------|-------|
| **Base URL (Free)** | `https://api.coingecko.com/api/v3/` |
| **Base URL (Pro)** | `https://pro-api.coingecko.com/api/v3/` |
| **Authentication** | API key required (header: `x-cg-demo-api-key`) |
| **Rate Limits (Free)** | ~30 calls/min |
| **WebSocket** | ❌ Paid plans only (Analyst+) |

#### ✅ FREE Endpoints:

```javascript
// Simple Price (multiple coins)
GET /simple/price?ids=bitcoin,ethereum&vs_currencies=usd,eur&include_24hr_change=true

// Coin List (all coins with IDs)
GET /coins/list

// Coin Markets (top coins with market data)
GET /coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100

// Coin Data (detailed)
GET /coins/bitcoin?localization=false&tickers=false

// Historical Chart Data
GET /coins/bitcoin/market_chart?vs_currency=usd&days=30

// OHLC (1/7/14/30/90/180/365 days)
GET /coins/bitcoin/ohlc?vs_currency=usd&days=30

// Trending Coins
GET /search/trending

// Global Market Data
GET /global

// Exchange Rates
GET /exchange_rates
```

#### 📝 Example with API Key:

```javascript
const response = await fetch(
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
  {
    headers: {
      'x-cg-demo-api-key': 'YOUR_API_KEY'
    }
  }
);
```

---

### 4. CoinCap API ⭐⭐⭐⭐

**Clean API with technical indicators and AI-friendly endpoints.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://rest.coincap.io/v3/` |
| **WebSocket** | `wss://wss.coincap.io/` |
| **Authentication** | Bearer token required |
| **Rate Limits** | 600 calls/min, 4,000 credits/month (Free) |

#### ✅ FREE Endpoints:

```javascript
// All Assets
GET /assets

// Single Asset
GET /assets/bitcoin

// Asset History
GET /assets/bitcoin/history?interval=d1

// Markets for Asset
GET /assets/bitcoin/markets

// Exchanges List
GET /exchanges

// Conversion Rates
GET /rates

// Price by Symbol
GET /price/bysymbol/BTC
```

#### ✅ Technical Analysis Endpoints:

```javascript
// Simple Moving Average
GET /ta/bitcoin/sma?interval=1h&period=20

// Exponential Moving Average
GET /ta/bitcoin/ema?interval=1h&period=20

// RSI
GET /ta/bitcoin/rsi?interval=1h&period=14

// MACD
GET /ta/bitcoin/macd?interval=1h

// All Latest Indicators
GET /ta/bitcoin/allLatest
```

#### ✅ WebSocket (Paid tiers):

```javascript
// Real-time prices
wss://wss.coincap.io/prices?assets=bitcoin,ethereum&apiKey=YOUR_KEY

// All assets
wss://wss.coincap.io/prices?assets=ALL&apiKey=YOUR_KEY
```

---

### 5. CryptoCompare (CoinDesk) ⭐⭐⭐

**Legacy API with good historical data.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://min-api.cryptocompare.com/data/` |
| **Authentication** | API key recommended |
| **Cache** | 10 seconds |

#### ✅ FREE Endpoints:

```javascript
// Single Price
GET /price?fsym=BTC&tsyms=USD,EUR,JPY

// Multiple Prices
GET /pricemulti?fsyms=BTC,ETH&tsyms=USD,EUR

// Full Price Data
GET /pricemultifull?fsyms=BTC&tsyms=USD

// Historical Daily
GET /histoday?fsym=BTC&tsym=USD&limit=30

// Historical Hourly
GET /histohour?fsym=BTC&tsym=USD&limit=24

// Historical Minute
GET /histominute?fsym=BTC&tsym=USD&limit=60

// Top Coins by Market Cap
GET /top/mktcapfull?limit=10&tsym=USD
```

---

## 📈 STOCK & INDEX APIs

### 6. Finnhub ⭐⭐⭐⭐⭐ (BEST FREE STOCKS)

**Excellent free tier with real-time WebSocket!**

| Property | Value |
|----------|-------|
| **Base URL** | `https://finnhub.io/api/v1/` |
| **WebSocket** | `wss://ws.finnhub.io?token=YOUR_TOKEN` |
| **Authentication** | `token` param or `X-Finnhub-Token` header |
| **Rate Limits** | 30 calls/second |
| **WebSocket** | ✅ FREE real-time trades! |

#### ✅ FREE Endpoints:

```javascript
// Stock Quote
GET /quote?symbol=AAPL&token=YOUR_TOKEN

// Company Profile
GET /stock/profile2?symbol=AAPL&token=YOUR_TOKEN

// Market News
GET /news?category=general&token=YOUR_TOKEN

// Company News
GET /company-news?symbol=AAPL&from=2024-01-01&to=2024-12-31&token=YOUR_TOKEN

// Stock Symbols
GET /stock/symbol?exchange=US&token=YOUR_TOKEN

// Market Status
GET /stock/market-status?exchange=US&token=YOUR_TOKEN

// Forex Rates
GET /forex/rates?base=USD&token=YOUR_TOKEN

// Crypto Candles
GET /crypto/candle?symbol=BINANCE:BTCUSDT&resolution=D&from=1609459200&to=1640995200&token=YOUR_TOKEN

// IPO Calendar
GET /calendar/ipo?from=2024-01-01&to=2024-12-31&token=YOUR_TOKEN
```

#### ✅ FREE WebSocket (Real-time trades):

```javascript
const ws = new WebSocket('wss://ws.finnhub.io?token=YOUR_TOKEN');

ws.onopen = () => {
  // Subscribe to US stocks
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL' }));
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'GOOGL' }));
  
  // Subscribe to crypto
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'BINANCE:BTCUSDT' }));
  
  // Subscribe to forex
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'OANDA:EUR_USD' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'trade') {
    data.data.forEach(trade => {
      console.log(`${trade.s}: $${trade.p} x ${trade.v}`);
    });
  }
};
```

---

### 7. Alpha Vantage ⭐⭐⭐

**Good for technical indicators, but very limited free tier.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://www.alphavantage.co/query` |
| **Authentication** | `apikey` param required |
| **Rate Limits** | 25 calls/day (FREE) ⚠️ Very limited |
| **WebSocket** | ❌ No |

#### ✅ FREE Endpoints:

```javascript
// Daily Stock Data
GET ?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=YOUR_KEY

// Weekly Stock Data
GET ?function=TIME_SERIES_WEEKLY&symbol=AAPL&apikey=YOUR_KEY

// Monthly Stock Data
GET ?function=TIME_SERIES_MONTHLY&symbol=AAPL&apikey=YOUR_KEY

// Global Quote (Current Price)
GET ?function=GLOBAL_QUOTE&symbol=AAPL&apikey=YOUR_KEY

// Symbol Search
GET ?function=SYMBOL_SEARCH&keywords=apple&apikey=YOUR_KEY

// News & Sentiment
GET ?function=NEWS_SENTIMENT&tickers=AAPL&apikey=YOUR_KEY

// Economic Indicators
GET ?function=REAL_GDP&interval=annual&apikey=YOUR_KEY
GET ?function=CPI&interval=monthly&apikey=YOUR_KEY
GET ?function=INFLATION&apikey=YOUR_KEY
GET ?function=UNEMPLOYMENT&apikey=YOUR_KEY

// Technical Indicators (FREE)
GET ?function=SMA&symbol=AAPL&interval=daily&time_period=20&series_type=close&apikey=YOUR_KEY
GET ?function=EMA&symbol=AAPL&interval=daily&time_period=20&series_type=close&apikey=YOUR_KEY
GET ?function=RSI&symbol=AAPL&interval=daily&time_period=14&series_type=close&apikey=YOUR_KEY
GET ?function=MACD&symbol=AAPL&interval=daily&series_type=close&apikey=YOUR_KEY
GET ?function=BBANDS&symbol=AAPL&interval=daily&time_period=20&series_type=close&apikey=YOUR_KEY
GET ?function=STOCH&symbol=AAPL&interval=daily&apikey=YOUR_KEY
GET ?function=ADX&symbol=AAPL&interval=daily&time_period=14&apikey=YOUR_KEY
```

#### ⚠️ Premium Only Endpoints:
- `TIME_SERIES_INTRADAY` (1min, 5min, etc.)
- `FX_INTRADAY`
- `CRYPTO_INTRADAY`
- `VWAP`

---

## 💱 FOREX APIs

### 8. Frankfurter ⭐⭐⭐⭐⭐ (BEST FREE FOREX)

**100% free, no limits, no API key, open-source!**

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.frankfurter.dev/v1/` |
| **Authentication** | ❌ Not required |
| **Rate Limits** | ✅ Unlimited |
| **Data Source** | European Central Bank |
| **Update Frequency** | Daily ~16:00 CET |
| **Self-host** | Docker available |

#### ✅ FREE Endpoints:

```javascript
// Latest Rates (base EUR)
GET /latest

// Latest with custom base
GET /latest?base=USD

// Filter currencies
GET /latest?base=EUR&symbols=USD,GBP,JPY

// Historical Rates
GET /1999-01-04

// Historical with filters
GET /2024-01-01?base=USD&symbols=EUR

// Time Series
GET /2024-01-01..2024-12-31

// Time Series to present
GET /2024-01-01..

// Available Currencies
GET /currencies
```

#### 📝 Example Response:

```json
{
  "base": "EUR",
  "date": "2025-01-15",
  "rates": {
    "USD": 1.0292,
    "GBP": 0.8421,
    "JPY": 161.23,
    "CHF": 0.9355,
    "AUD": 1.6492
  }
}
```

#### 📝 Conversion Example:

```javascript
async function convert(from, to, amount) {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`);
  const data = await res.json();
  return amount * data.rates[to];
}

// Convert 100 EUR to USD
const usd = await convert('EUR', 'USD', 100); // ~102.92
```

---

### 9. ExchangeRatesAPI ⭐⭐

**Note: Now paid service, but affordable tiers.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.exchangeratesapi.io/v1/` |
| **Authentication** | API key required |
| **Free Tier** | ❌ Paid only |

---

### 10. FreeCurrencyAPI ⭐⭐⭐

**Limited free tier available.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.freecurrencyapi.com/v1/` |
| **Authentication** | `apikey` param or header |
| **Free Tier** | ✅ Limited monthly calls |

```javascript
GET /latest?apikey=YOUR_KEY&base_currency=USD&currencies=EUR,GBP
```

---

## 🔗 ON-CHAIN & DeFi APIs

### 11. DeFiLlama ⭐⭐⭐⭐⭐ (BEST FREE DeFi)

**Completely free DeFi data API!**

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.llama.fi/` |
| **Pro URL** | `https://pro-api.llama.fi/` |
| **Authentication** | ❌ Not required (free tier) |
| **Rate Limits** | Generous |

#### ✅ FREE Endpoints:

```javascript
// All Protocols with TVL
GET /protocols

// Single Protocol TVL History
GET /protocol/aave

// Current TVL (simple)
GET /tvl/aave

// Historical Chain TVL
GET /v2/historicalChainTvl

// Chain-specific TVL
GET /v2/historicalChainTvl/ethereum

// All Chains TVL
GET /v2/chains

// Stablecoins
GET /stablecoins
GET /stablecoincharts/all
GET /stablecoin/{asset}

// Yields/APY
GET /pools

// DEX Volumes
GET /overview/dexs
GET /overview/dexs/ethereum
GET /summary/dexs/uniswap

// Fees & Revenue
GET /overview/fees
GET /summary/fees/uniswap

// Bridges
GET /bridges

// Current Prices (by address)
GET /prices/current/ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7

// Historical Prices
GET /prices/historical/1609459200/ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7
```

#### 📝 Example Usage:

```javascript
// Get all protocol TVLs
const protocols = await fetch('https://api.llama.fi/protocols').then(r => r.json());
console.log(protocols[0]); // { name: "Lido", tvl: 25000000000, ... }

// Get Ethereum chain TVL history
const ethTvl = await fetch('https://api.llama.fi/v2/historicalChainTvl/ethereum').then(r => r.json());
```

---

### 12. Fear & Greed Index ⭐⭐⭐⭐⭐ (FREE SENTIMENT)

**Simple, free sentiment indicator.**

| Property | Value |
|----------|-------|
| **Base URL** | `https://api.alternative.me/fng/` |
| **Authentication** | ❌ Not required |
| **Rate Limits** | ✅ Unlimited |

#### ✅ FREE Endpoints:

```javascript
// Current Fear & Greed
GET /

// Historical (last N days)
GET /?limit=10

// Date range
GET /?date_format=world&limit=365
```

#### 📝 Example Response:

```json
{
  "name": "Fear and Greed Index",
  "data": [
    {
      "value": "16",
      "value_classification": "Extreme Fear",
      "timestamp": "1736899200",
      "time_until_update": "43200"
    }
  ]
}
```

#### Value Classifications:
- **0-24**: Extreme Fear 😱
- **25-49**: Fear 😰
- **50**: Neutral 😐
- **51-74**: Greed 😊
- **75-100**: Extreme Greed 🤑

---

## 🏆 RECOMMENDED API COMBINATIONS

### For Crypto Trading Dashboard:

```
1. Binance WebSocket   → Real-time prices & trades
2. CoinGecko           → Market caps, metadata
3. DeFiLlama           → DeFi TVL & yields
4. Fear & Greed        → Sentiment indicator
```

### For Multi-Asset Dashboard:

```
1. Binance             → Crypto real-time
2. Finnhub WebSocket   → Stocks real-time
3. Frankfurter         → Forex rates
4. Alpha Vantage       → Technical indicators
```

### For DeFi Analytics:

```
1. DeFiLlama           → TVL, yields, volumes
2. CoinGecko           → Token prices
3. Binance             → CEX prices for comparison
```

---

## 📝 Implementation Notes

### Rate Limiting Best Practices:

```javascript
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  async throttle() {
    const now = Date.now();
    this.requests = this.requests.filter(t => now - t < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0]);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(Date.now());
  }
}

// Usage for Finnhub (30 calls/sec)
const finnhubLimiter = new RateLimiter(30, 1000);
```

### WebSocket Reconnection:

```javascript
function createReconnectingWebSocket(url, onMessage) {
  let ws;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
  
  function connect() {
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('Connected');
      reconnectAttempts = 0;
    };
    
    ws.onmessage = onMessage;
    
    ws.onclose = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(connect, delay);
        reconnectAttempts++;
      }
    };
    
    ws.onerror = (error) => console.error('WebSocket error:', error);
  }
  
  connect();
  return { getSocket: () => ws };
}
```

---

## 🔗 Quick Links

| API | Documentation | Get API Key |
|-----|---------------|-------------|
| Binance | [docs.binance.com](https://developers.binance.com/docs/binance-spot-api-docs) | Not required |
| Kraken | [docs.kraken.com](https://docs.kraken.com/api/) | Not required |
| CoinGecko | [docs.coingecko.com](https://docs.coingecko.com/) | [Get Key](https://www.coingecko.com/en/api) |
| CoinCap | [pro.coincap.io](https://pro.coincap.io/api-docs) | [Dashboard](https://pro.coincap.io/dashboard) |
| DeFiLlama | [api-docs.defillama.com](https://api-docs.defillama.com/) | Not required |
| Finnhub | [finnhub.io/docs](https://finnhub.io/docs/api) | [Get Key](https://finnhub.io/) |
| Alpha Vantage | [alphavantage.co/documentation](https://www.alphavantage.co/documentation/) | [Get Key](https://www.alphavantage.co/support/#api-key) |
| Frankfurter | [frankfurter.dev/docs](https://frankfurter.dev/docs/) | Not required |
| Fear & Greed | [alternative.me/crypto/fear-and-greed-index](https://alternative.me/crypto/fear-and-greed-index/) | Not required |

---

> **Note**: Rate limits and free tier offerings may change. Always check the official documentation for the most up-to-date information.
