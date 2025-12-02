# Local Health Report (02.12.2025)

## Build Status
- `npm run build` ✅ (02.12.2025) — vite 7.2.4, ~11.9s, main bundle `dist/assets/index-*.js` ~1.07 MB pre-gzip. No build warnings.

## Backend Proxy Status
- Express 5 server on `http://localhost:5176` with CORS, rate limit, short cache, native fetch.
- Mounted routes: `/api/health`, `/api/price`, `/api/binance`, `/api/kraken`, `/api/ohlc`, `/api/indicators`, `/api/derivatives`, `/api/etf/news`, `/api/etf/flows`, `/api/etf/holdings`, `/api/etf/correlations`.
- Smoke to run (after setting env keys):  
  - `curl http://localhost:5176/api/health` → expect `{ok:true, ts:<number>}`  
  - `curl "http://localhost:5176/api/price?asset=BTC&vs=USD"` → JSON with health array  
  - `curl "http://localhost:5176/api/ohlc?pair=XXBTZUSD&binance=BTCUSDT&interval=60&limit=200"` → OHLC data + health  
  - `curl "http://localhost:5176/api/indicators?type=rsi&symbol=BTCUSDT&interval=60&limit=240"` → indicator series  
  - `curl "http://localhost:5176/api/derivatives?symbol=DERIBIT_PERPETUAL_BTC_USD&period=1HRS&limit=200"` → funding/OI + risk (requires `VITE_COINAPI_KEY`)  
  - `curl "http://localhost:5176/api/etf/holdings?symbols=IBIT,FBTC"` → ETF holdings (requires `VITE_FMP_KEY` etc.)

## Frontend Runtime Notes
- Dev server: `npm run dev` now starts `dev:server` + `dev:frontend` in parallel (ports 5176/5175). Use `npm run dev:server` or `npm run dev:frontend` separately if needed.
- Single ErrorBoundary in `src/main.jsx`; StrictMode removed to avoid double render/reload loops.
- Services updated to use proxy: `marketDataLive` → `/api/ohlc`; `derivativesLive` → `/api/derivatives`; `etfCorrelations` → `/api/etf/correlations`.
- Outstanding: some legacy external fetches in `src/App.jsx` (on-chain/sentiment/news) still bypass the proxy; guard charts against null/empty before rendering.

## Env / Secrets
- Required: `VITE_FIREBASE_*`, `VITE_FMP_KEY`, `VITE_COINAPI_KEY`.
- Keep `.env*` out of VCS; populate locally and in Vercel project settings.

## Open Risks / TODO
- Add CI (lint, typecheck, build, supertest smokes).
- Complete proxy adoption for remaining direct provider calls.
- Verify mobile tab/reload flow once secrets are present and data loads live.
