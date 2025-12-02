# Deployment Guide (Module 9)

## 1. Prerequisites
- Node.js 20.x + npm 10.x.
- Vercel CLI (`npm i -g vercel`) if you deploy the `api/` Edge handlers.
- Required env values: `VITE_FIREBASE_*`, `VITE_FMP_KEY`, `VITE_COINAPI_KEY` (plus optional `VITE_ENABLE_*` flags). Keep secrets out of the repo.

## 2. Local Verification
1. Install dependencies: `npm install`.
2. Build once: `npm run build` (bundle lands in `dist/`).
3. Start locally:
   - Parallel (empfohlen): `npm run dev` startet Proxy (5176) + Frontend (5175) via npm-run-all.
   - Alternativ: `npm run dev:server` (Proxy) und `npm run dev:frontend` (Vite) in zwei Terminals.
   - Für Vercel Edge Handler bleibt `npm run dev:api` optional verfügbar.
4. Smoke-test core routes:
   - `curl http://localhost:5176/api/health`
   - `curl "http://localhost:5176/api/price?asset=btc&vs=usd"`
   - `curl "http://localhost:5176/api/ohlc?pair=XXBTZUSD&binance=BTCUSDT&interval=60"`
   - `curl "http://localhost:5176/api/indicators?type=rsi&symbol=BTCUSDT&interval=60&limit=240"`
   - `curl "http://localhost:5176/api/derivatives?symbol=DERIBIT_PERPETUAL_BTC_USD&period=1HRS&limit=200"` (needs `VITE_COINAPI_KEY`)

## 3. vercel.json & Routing
- `vercel.json` keeps the Vite build (`npm run build`, output `dist/`), rewrites all non-API paths to `index.html`, and applies immutable caching for `/assets/*`.
- `/api/*` is reserved for API traffic. On Vercel, each `api/**/*.js` file is bundled as an Edge Function; locally, the Express proxy on :5176 handles the same paths.
- Regions remain scoped to `fra1` + `iad1` for lower latency.

## 4. Deployment Steps (Vercel)
1. `vercel login` and `vercel link` inside the repo.
2. Sync secrets: `vercel env pull .env.local`.
3. (Optional) Dry run existing build: `vercel --prebuilt`.
4. Production deploy: `vercel --prod`. Vercel will install, run `npm run build`, upload `dist/`, and bundle `api/**/*.js` as Edge handlers.
5. Post-deploy checks:
   - `curl https://<deploy>/api/health`
   - `curl "https://<deploy>/api/price?asset=btc&vs=usd"`
   - Open `https://<deploy>/` (or any deep link) to confirm SPA rewrite works.

## 5. API Performance Checklist
| Endpoint | Runtime | Expected Latency | Notes |
| --- | --- | --- | --- |
| `/api/ohlc` | Proxy/Edge | 120-250 ms EU | Kraken → Binance → CoinGecko fallback, returns `health`. |
| `/api/price` | Proxy/Edge | 80-180 ms | CoinGecko → Binance → CryptoCompare cascade; cached 500 ms. |
| `/api/indicators` | Proxy | 180-320 ms | Server-side RSI/MACD/ATR/Stoch/EMA/Trend/SMF; uses cached OHLC. |
| `/api/derivatives` | Proxy | 220-400 ms | CoinAPI funding/OI + composite risk score (needs `VITE_COINAPI_KEY`). |
| `/api/etf/*` | Edge | 200-400 ms | Multi-provider (FMP/SosoValue/CoinStats) with circuit-breaker logging. |
| `/api/health` | Proxy/Edge | < 50 ms | No upstream fetch; returns timestamp + ok:true. |

Monitoring tips:
- `vercel logs <deployment-url>` for Edge handlers; local proxy logs via `morgan`.
- `createHealthTracker()` entries are returned in every proxy response; compare with frontend health card.
- Keep regions list short to reduce cold starts; purge unused env vars regularly.

## 6. Troubleshooting
- **Build fails** → ensure `npm install` used the lockfile; rerun `npm run build` locally.
- **Routing issues** → confirm `vercel.json` deployed and no legacy project-level route overrides.
- **Provider throttling** → widen `timeoutMs`/`retries` in proxy routes or raise cache TTLs; provide real API keys.
- **Charts blank** → verify proxy routes respond with data (not an error) before passing arrays into Recharts.
