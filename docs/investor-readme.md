# Vision AI Mind — Investor Brief

## 1. Executive Snapshot

Vision AI Mind is a Vite/React institutional dashboard that unifies crypto market risk, ETF flows, derivatives metrics, and AI-driven signals into a single responsive experience. Data quality is preserved through redundant providers (Kraken/Binance/CoinGecko for OHLC, FMP/SosoValue/CoinStats for ETF analytics) and an opinionated health system that surfaces degraded APIs without breaking UX. The product already ships as a fully static SPA plus Edge Functions, making it inexpensive to host on Vercel while keeping latency under 250 ms for EU/US traders.

## 2. Architecture Overview

- **Client (React + Tailwind)**: `src/App.jsx` orchestrates all cards, charts, and trials. UI splits into desktop grid and mobile tabs without re-rendering heavy ETF widgets until needed (`LazyRender`).
- **Edge API Layer (`api/`)**: Each route (price, ohlc, ETF flows/holdings/news, Kraken/Binance passthrough) is an Edge Function with per-provider fallback logic and shared helpers under `api/_lib/` (HTTP client, health tracker, providers, utilities).
- **Shared Data Services (`src/services/*`)**: Frontend fetches HTF OHLC, derivatives risk, ETF correlations/flows via composable hooks that already enforce provider order and health updates.
- **State & Health**: `safeFetch` publishes provider status to a global store; the System Status card and toasts consume the same data, so investors immediately see degraded vendors.
- **Build & Hosting**: `npm run build` emits static assets in `dist/`; `vercel.json` routes everything else to Edge handlers. No custom servers are required, which keeps op-ex low.

## 3. Data Source Overview

| Domain | Primary | Fallbacks | Usage |
| --- | --- | --- | --- |
| OHLC / Live Charts | Kraken | Binance, CoinGecko | Candle engine, indicators, Fib map. |
| Prices / Quotes | CoinGecko | CryptoCompare | Live price card, smart-money flows. |
| ETF Holdings & AUM | FMP | SosoValue, CoinStats | Holdings card, provider quality scoring. |
| ETF Flows | FMP (AUM delta) | SosoValue, CoinStats | Flow heatmaps, inflow ranking. |
| ETF Correlations | CoinGecko | CryptoCompare, AlphaVantage | Correlation + heatmap cards. |
| Derivatives Metrics | CoinAPI | (Pluggable) | Funding/OI risk monitor. |
| On-chain / Sentiment | Glassnode, Santiment | Binance funding snapshot | Regime + AI signal context. |

Health keys such as `ETF_FLOWS_FMP` or `DERIVATIVES_PRIMARY` keep governance transparent—investors can audit uptime by reading `/api/health`.

## 4. Trial & Tier System

- **Basic (default)**: read-only access to price cards, fear & greed, limited ETF previews.
- **Pro**: unlocks advanced indicators, derivatives risk, ETF deep dives, and HTF views.
- **Elite**: full AI signals, automated journaling, ETF provider analytics. Includes 7‑day Elite trial with countdown badge and automatic lockback when the trial expires.
- **Persistence & Auth**: Email/password via Firebase Auth; tier selections sync to Firestore via `saveUserTier`. Local storage mirrors the tier for instant boot while remote auth hydrates.

## 5. Crypto Indicator Stack

- Momentum & Trend: RSI, EMA ribbons, MACD/Signal delta, ADX, Donchian channels.
- Volatility: ATR%, Bollinger Bands (upper/lower/basis), VWAP, fib confluence zones.
- Volume & Flow: OBV, Smart Money net flows, AI-derived flow sentiment, ETF inflow ladder.
- Oscillators: Stoch RSI, Stoch Oscillator, CCI for mean-reversion calls.
- Risk Modules: DerivativesRiskScore (Funding vs OI), Fear & Greed, On-chain metrics, Backtest V3 statistics (win rate, avg RR, drawdown soon).

## 6. Security & Compliance Notes

- No secrets in source control; every key is injected via `import.meta.env.VITE_*` and mirrored in Vercel project settings.
- Edge Functions sanitize outbound requests through `_lib/http.js` (timeouts, retry with jitter, JSON validation) to avoid hanging executions.
- `safeFetch` enforces provider enable/disable flags so sensitive APIs can be toggled instantly without redeploy.
- Firebase Auth handles credential storage; the app never touches raw passwords beyond the SDK.
- Logging: user-facing toasts hide ETF provider noise, but structured logs (source + level + metadata) are emitted in dev and via health trackers for later SIEM ingestion.

## 7. Mobile Readiness

The layout keeps a single code path while adapting via Tailwind breakpoints:

- Desktop (`md:block`): 4-column grid with persistent ETF panels.
- Mobile (`md:hidden`): Tabbed workflow (Overview → Charts → Signals → Research) that only renders heavy components when the tab is active, cutting bandwidth for LTE users.
- Touch gestures are tuned (`touch-pan-y`, `overscroll-contain`), and fallback charts render instantly on weak networks via `buildFallbackChart`.

This package positions Vision AI Mind as a deployment-ready, fund-facing cockpit with transparent data lineage, redundancy, and a clear monetization ladder.
