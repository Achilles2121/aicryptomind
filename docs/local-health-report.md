# Local Health Report

## Build Status

- `npm run build` **OK** (Vite 7.2.4, Node 24.11.1). Last run 2025-02-15 17:10 UTC completed in ~9s with no warnings after resolving the previous `dataSources.ts` syntax issue.

## Backend Proxy Status

- Express proxy now lives in `server/index.js` with rate limiting, caching, and provider fallbacks. Start via `npm run dev:server` (or `node server/index.js`) which listens on `http://localhost:5176` by default.
- CORS is restricted to `FRONTEND_ORIGIN` (defaults to `http://localhost:5175`), so the React app can make authenticated `fetch("/api/...")` calls without browser-side secrets.
- Verified endpoints on 2025-02-15 (fresh server boot):
  - `GET /api/health` → `200` `{status:"ok", time:"2025-02-15T17:13:56.948Z"}`
  - `GET /api/price?asset=BTC&vs=USD` → `200` payload with CoinGecko price + health snapshot; cache misses flip to cached responses on subsequent calls.
  - `GET /api/etf/holdings?symbols=IBIT,FBTC` → `200` with `health` entries for FMP/SosoValue fallbacks (data may be `null` locally without provider keys, but request succeeds).
- Remaining follow-ups: run `/api/etf/flows` + `/api/etf/correlations` once provider keys are present to confirm the same caching path.

## Frontend Runtime Status

- React app (Vite dev server on port 5175) boots cleanly; `App.jsx` consumes the new live ETF services (`fetchEtfHoldingsLive`, `fetchEtfFlowsLive`, `fetchEtfCorrelationLive`) which call the proxy endpoints above.
- `safeFetch.ts` still classifies 401/403, disabled sources, and CORS failures; combined with proxy routing, UI health badges now reflect both upstream provider status and proxy availability.
- Remaining known runtime warnings:
  - Direct-to-provider code paths are still present for legacy modules (e.g., `etfHoldings.ts`, news widgets); enable the proxy route for those calls to remove mixed-mode traffic.
  - APIs that require paid keys (FMP, CoinAPI, HuggingFace Inference) respond 401/403 unless env vars are set; UI shows degraded state but continues rendering fallback time series.
  - `useCryptoEduChat` still contains a TODO to connect to a backend `/api/crypto-edu-chat` endpoint.

## Changes Overview

- `src/lib/safeFetch.ts`: centralized source detection, disabled-source handling, health snapshot broadcasting, and richer error classification.
- `src/config/dataSources.ts`: new registry of upstream APIs with enable flags (`VITE_ENABLE_*`) used by `safeFetch` and the System Status UI.
- `src/App.jsx`: consumes health snapshots, throttles logging, normalizes Recharts containers, and surfaces per-source badges plus ETF layouts.
- `src/services/*Live.ts` (ETF flows/holdings/correlations, marketDataLive, derivativesLive) now rely on the enhanced `safeFetch` callbacks which feed the global health monitor.
- `src/firebase.js`: safer tier fetching with explicit permission error metadata; avoids crashing when Firestore security rules reject reads.
- `.gitignore` and auxiliary files updated as part of Master Prompts for stability.

## Configuration / Env Notes

- Required Firebase vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`.
- Data providers:
  - `VITE_FMP_KEY` (Financial Modeling Prep)
  - `VITE_COINAPI_KEY` (CoinAPI for OHLC + derivatives)
- Optional feature toggles: `VITE_ENABLE_COINGECKO`, `VITE_ENABLE_CRYPTOCOMPARE`, `VITE_ENABLE_GLASSNODE`, `VITE_ENABLE_SANTIMENT`, `VITE_ENABLE_HUGGINGFACE`, `VITE_ENABLE_FMP`, `VITE_ENABLE_SOSOVALUE`, `VITE_ENABLE_COINSTATS`, `VITE_ENABLE_BINANCE`, `VITE_ENABLE_KRAKEN`, `VITE_ENABLE_COINAPI`.
- No proxy/server-specific env vars currently exist.

## Open TODOs / Limitations

- Expand proxy coverage for every remaining upstream call (news widgets, HuggingFace probes) to avoid mixed browser/server fetch paths.
- Premium APIs (FMP, CoinAPI, HuggingFace) still require valid keys; without them the UI stays in "degraded" mode using fallback values.
- ETF flow/holding data ultimately depends on providers that may throttle; proxy caching mitigates this but does not guarantee completeness.
- AI chat (`useCryptoEduChat`) is still a stub until an LLM endpoint is exposed.
- No automated tests or CI scripts are present; consider adding lint/typecheck/build steps to CI to catch regressions early.
