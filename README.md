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
npm run dev
```
Lokal: http://localhost:5173

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
```
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
