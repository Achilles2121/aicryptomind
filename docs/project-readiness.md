# Project Readiness & Master Prompt (Vision AI Mind)

## Quick Status
- Dev stack runs: `npm run dev` (5175 FE, 5176 proxy), `npm run build` green (Vite 7.2.4).
- Current front-end bundle ~1.07 MB (before gzip) – acceptable but can be trimmed with more lazy chunks.
- Keys are present in `.env.local`; treat them as exposed and rotate for production.

## What’s Missing for “1A” Ship
- **Real HTF data**: Wire true 4h/1d OHLC (Kraken/CoinAPI) to kill lookahead risk; expose `MARKET_HTF_PRIMARY/FALLBACK` in health.
- **Backtest fidelity**: Use real HTF candles in `backtestV3` instead of approximated; render equity curve, max drawdown, profit factor, expectancy in UI.
- **Derivatives risk gating**: Ensure CoinAPI key works in `derivativesLive.ts`; propagate funding/OI z-scores into signals and visibly clamp risk when `riskLevel="hot"`.
- **Resilience**: Add `lastSuccess` + `maxRetry` + capped `retryDelay` to `safeFetch`; per-provider cache TTLs (ETFs, OHLC) to avoid flapping and rate limits.
- **Monitoring**: Central log funnel (console + toast-free) for provider errors; lightweight health pings with timestamps in System Status card.
- **Performance**: Split the main App chunk further (lazy-load heavy tabs/ETF cards/backtest widgets); keep animations cheap on mobile; audit Recharts for memoization.
- **Mobile polish**: Verify all tabs/cards in small viewports; add skeletons where loaders are still text-only.
- **Security**: Rotate all leaked keys; keep `.env.local` out of git; tighten CORS if you don’t need `origin: true`.
- **Testing**: Add unit tests for indicators/signals; a smoke test that fetches `/api/health`, `/api/ohlc`, `/api/indicators` with mocked responses.

## GitHub/Vercel Push Checklist
- Rotate and reissue API keys; update `.env.local` and Vercel env vars (don’t commit secrets).
- Run: `npm run lint && npm run typecheck && npm run build`. Add tests, then `npm test` (or `npm run vitest` if you add Vitest).
- Verify `vercel.json` matches ports and `vite.config.js` proxy (5175 -> 5176).
- Ensure `.gitignore` covers `.env*`, `node_modules`, `dist`.
- Commit after checks: `git add . && git commit -m "chore: prep release"` then push to GitHub; Vercel auto-redeploys.

## Algorithm & Signal Blueprint
- Indicators (pure math in `src/lib/indicators.js`):
  - **EMA** k = 2/(n+1); **RSI 14** with Wilder smoothing; **MACD 12/26/9** + histogram; **Bollinger 20, 2σ**; **StochRSI** (14, 3/3); **ATR 14** (true range EMA); **ADX 14**; **Donchian 20**; **VWAP** cumulative PV/Vol; **OBV** directional volume; **CCI 20**; **Pearson r** for correlations.
- Signal layers:
  - **AI signal**: Heuristic on RSI bands + MACD cross + Bollinger extremes; TP/SL auto-padded.
  - **Pro signal**: Combines trend (EMA200 + MACD + VWAP), Donchian breakouts with volume spike, mean reversion (RSI extremes vs Bollinger), ATR% sizing; flow bias tweaks confidence; TP/SL via ATR%.
  - **V3 engine** (`signalsV2` + `strategyEngineV3`): Trend/Breakout/Reversion evaluators gated by market regime; confidence from setup winrate, regime winrate, volatility score (ATR%), flow score (smart money); filters with social sentiment and HTF regime; “ultra” flags require high winrates + tame ATR + social alignment. TP/SL and riskPad derived from ATR% caps.
- Data flow:
  - Prices/OHLC from `/api/ohlc` (Kraken primary, Binance fallback); derivatives from `/api/derivatives`; ETFs via `/api/etf/*`.
  - `safeFetch` enforces timeout/retries, emits health snapshots for the System Status card.

## Master Prompt (copy/paste for next Codex run)
```
You are Codex on the Vision AI Mind trading dashboard. Goals: high speed, stable foundation, keep current design/layout. Deliver a GitHub/Vercel-ready build with no runtime errors.

Scope and priorities:
- Wire real 4h/1d OHLC (Kraken/CoinAPI) into HTF regime to eliminate lookahead; expose health keys MARKET_HTF_PRIMARY/FALLBACK.
- Finish backtest fidelity: use real HTF candles, show equity curve, max drawdown, profit factor, expectancy in UI.
- Harden derivatives risk: ensure CoinAPI funding/OI metrics feed signals; clamp confidence when riskLevel="hot".
- Improve resilience: in safeFetch add lastSuccess + maxRetry + bounded retryDelay; per-provider cache TTLs for ETF/ohlc to avoid rate limits.
- Improve performance: further code-split heavy tabs/ETF/backtest; memoize Recharts; keep mobile animations cheap. Target main chunk <800kB pre-gzip.
- Mobile polish: verify all tabs/cards on small screens; add skeletons where loaders are text-only.
- Monitoring/logging: central log for provider errors without user toasts; timestamps in System Status card.
- Security: rotate all leaked keys; ensure .env.local stays gitignored; tighten CORS if possible.
- Testing: add unit tests for indicators/signals; smoke test hitting /api/health, /api/ohlc, /api/indicators with mocks; run lint/typecheck/build.

Constraints: keep existing design language; avoid introducing new heavy deps; do not ship secrets. Commands allowed: npm run lint/typecheck/build/test.

Deliverables: code changes + brief summary of what was done, remaining risks, and how to run/tests.```
