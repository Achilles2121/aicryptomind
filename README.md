# Vision AI Mind Dashboard

React/Vite/Tailwind Crypto Risk Manager mit Live-Daten, AI-Hinweisen und Backtest-Snapshots.

## Features
- Live OHLC/Charts (Kraken/Coingecko) mit Fallbacks
- AI-Predictor + Schnell-Backtest
- Beginner/Pro Umschaltung, Paywalling nach Tier
- Mehrsprachig (DE/EN), Onboarding Modal
- Terser-minifiziertes Vite-Build, envPrefix `VITE_`

## Schnellstart

```bash
npm install

# Frontend (Vite) unter http://localhost:5175
npm run dev

# Optional: Serverless-Routen lokal mit Vercel CLI
npm run dev:api   # startet vercel dev --listen 5176
```

Der Vite-Dev-Server proxied alle `/api/*` Requests standardmäßig nach `http://localhost:5176`. Für einen vollständigen Stack muss daher zusätzlich die Vercel-CLI laufen (`npm run dev:api`). Alternativ können die API-Routen direkt auf Vercel getestet werden.

## Serverless-API

- Alle Provider-Aufrufe laufen jetzt über Edge-Routen im Ordner `api/`.
- Keine Express-Instanz, keine offenen Ports im Build – vollständig Vercel-kompatibel.
- Relevante Endpunkte:
  - `GET /api/health`
  - `GET /api/ohlc?pair=XXBTZUSD&interval=60`
  - `GET /api/price?asset=BTC&vs=USD`
  - `GET /api/etf/holdings?symbols=IBIT,FBTC`
  - `GET /api/etf/flows?symbols=IBIT,FBTC`
  - `GET /api/etf/news?limit=8`
  - `GET /api/kraken/ohlc`, `GET /api/binance/klines` (Direktzugriff für ChartLoader)
- Fallback-Kaskaden (Kraken → Binance → CoinGecko bzw. FMP → SosoValue → CoinStats) werden in den Routen selbst gehandhabt.
- Benötigte Environment-Variablen (lokal & Vercel):
  - `VITE_FMP_KEY` / `FMP_API_KEY`
  - optionale zusätzliche Provider-Keys (`ALPHAVANTAGE_API_KEY`, etc.)
  - `VITE_FIREBASE_*` für Auth.

## Builds & Tests

```bash
npm run lint       # eslint .   (falls eslint konfiguriert)
npm run typecheck  # tsc --noEmit
npm run build      # vite build
npm run preview    # serve production build
```

## Umgebungsvariablen

1. Kopiere `.env.local.example` zu `.env.local`
2. Trage deine Werte ein (alle Keys beginnen mit `VITE_`)
3. Datei nicht committen; in Vercel/Netlify als Environment Variables setzen

## Vercel-Deploy

- Build Command: `npm run build`
- Output Directory: `dist`
- Env Prefix: `VITE_` (in Vercel unter Project Settings → Environment Variables setzen)
- Optional: `_redirects` für SPA (`/* /index.html 200`) oder Netlify/Vercel-Rewrites

## GitHub-Repo Struktur

```text
├─ src/            # React-Code (UI, Logic)
├─ public/         # statische Assets
├─ dist/           # Build-Output (nicht committen)
├─ .env.local      # lokale Secrets (nicht committen)
├─ .env.local.example
├─ vite.config.js
├─ package.json
└─ README.md
```

## Hinweise

- UI/Design und Funktionen bleiben unverändert; Config ist Vercel-ready.
- Encoding auf UTF-8 achten; keine Secrets ins Repo legen.
- Bei Routen/Refresh auf Static Hosts: `_redirects` oder Rewrites aktivieren, damit SPA funktioniert.
