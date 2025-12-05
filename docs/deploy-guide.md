# Deployment Guide (Module 9)

## 1. Prerequisites
- Node.js 20.x + npm 10.x (Vercel build image uses Node 20 by default).
- Vercel CLI (`npm i -g vercel`) with access to the target project.
- Required env values stored in Vercel project (`VITE_FIREBASE_*`, `VITE_FMP_KEY`, `VITE_COINAPI_KEY`, optional `VITE_ENABLE_*` flags).

## 2. Local Verification
1. Install dependencies: `npm install`.
2. Run full build: `npm run build` (current run ✓, bundle in `dist/`).
3. Launch SPA + APIs locally:
   - Frontend: `npm run dev` (served on http://localhost:5175).
   - Edge routes: `npm run dev:api` (requires `vercel dev`, serves http://localhost:5176/api/*). Use two terminals.
4. Smoke-test routes:
   - `curl http://localhost:5176/api/health` → aggregated provider status.
   - `curl "http://localhost:5176/api/ohlc?pair=XXBTZUSD&binance=BTCUSDT&interval=60"` → ≥5 candles.
   - `curl "http://localhost:5176/api/price?asset=btc&vs=usd"` → latest price payload.

## 3. vercel.json (Routing & Headers)
`vercel.json` pins the Vite build (`npm run build`, output `dist/`), enables immutable caching for `/assets/*`, and rewrites all non-API paths to `index.html` so client-side routing works. `regions` is scoped to `fra1` + `iad1` for low latency in EU/US. Edge handlers keep running via per-file `export const config = { runtime: "edge" }` declarations.

## 4. Deployment Steps
1. Authenticate and link: `vercel login`, then `vercel link` inside the repo.
2. Sync envs from cloud → local for sanity checks: `vercel env pull .env.local`.
3. (Optional) Dry run: `vercel --prebuilt` to deploy the existing `dist/` output.
4. Production deploy: `vercel --prod`. Vercel will:
   - Install deps, run `npm run build`, upload `dist/` as static assets.
   - Bundle each `api/**/*.js` file as an Edge Function (Node-less runtime).
5. Post-deploy smoke tests:
   - `curl https://<deploy>/api/health`.
   - Open `https://<deploy>/live` (or any deep link) to ensure SPA rewrite serves `index.html`.

## 5. Routing & Static Asset Check
- Static files under `dist/assets/**` are served with `Cache-Control: public, max-age=31536000, immutable`.
- `/api/*` requests are never rewritten to the SPA; they map 1:1 to the serverless handlers.
- `/(*)` minus `api` rewrites to `/index.html`, so refreshing nested routes works.

## 6. API Performance Checklist
| Endpoint | Runtime | Expected Latency | Notes |
| --- | --- | --- | --- |
| `/api/ohlc` | Edge | 120-250 ms EU | Kraken → Binance → CoinGecko fallback, health metadata in body. |
| `/api/price` | Edge | 80-180 ms | Aggregates CoinGecko + CryptoCompare; returns `health` array. |
| `/api/etf/*` | Edge | 200-400 ms | Multi-provider (FMP/SosoValue/CoinStats) with circuit-breaker logging. |
| `/api/health` | Edge | < 50 ms | No upstream fetch; returns cached provider map. |

Monitoring tips:
- Use `vercel logs <deployment-url>` to watch Edge latency and uncaught errors.
- `createHealthTracker()` already reports per-provider state; compare with client-side `apiHealth` card for drift.
- Consider enabling Vercel Analytics on the project for request-level percentiles.

## 7. Deployment Troubleshooting
- **Build fails** → ensure `npm install` ran with lockfile, or clear `.vercel/output`. Re-run `npm run build` locally.
- **Routing issues** → confirm `vercel.json` deployed and no legacy `routes` config in project settings overrides it.
- **Edge cold starts** → keep regions list short (current 2). Use `vercel env rm` to clean unused secrets.
- **API spikes** → adjust provider rate limits via `VITE_ENABLE_*` flags or widen `timeoutMs` inside `api/_lib/http.js`.

## 8. Rollback Procedure
- `vercel list` to find previous deployments.
- `vercel rollback <deployment-id>` instantly switches prod alias back.
- Update Status dashboard (`docs/status-review.md`) after rollback to capture context.
