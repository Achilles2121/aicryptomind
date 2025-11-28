# Branding, SEO & Mobile Notes

- Branding: `src/config/brand.js` mit `APP_BRAND`, `APP_TAGLINE`. Header-Kommentar in Kern-Libs (`indicators`, `signalsV2`, `strategyEngineV3`, `backtestV3`) als Lizenz/Gravur.
- Secrets: `src/firebase.js` Hinweis, dass Keys nicht clientseitig bleiben sollen.
- Build: `vite.config.js` minify mit terser, sourcemap in Prod deaktiviert (Hinweis im Build-Block).
- SEO/Meta: `index.html` Titel/Description/Keywords auf Vision AI Mind ausgerichtet; OG/Twitter/Geo-Tags; JSON-LD SoftwareApplication + Organization.
- Mobile: Root-Container `overflow-y-auto`, `overscroll-contain`, `touch-pan-y`; Scrollbereiche (Trades/Chat) mit overscroll/touch; Kennzahlen mit `whitespace-nowrap`/`text-ellipsis` bei langen Zahlen; correlation grid mit `break-words`.
- CryptoEduChatCard: `src/components/CryptoEduChatCard.jsx` + Hook `src/lib/useCryptoEduChat.js`, Stubbed Chat (LLM-Backend TODO), eingebunden via Flag in `App.jsx`.
- Tier-System (basic/pro/elite): Context `src/context/UserTierContext.jsx` (simple Email-Mapping; TODO Payment/Admin); LockedCard-Gating fuer Pro/Elite-Karten; Backtest/Spezialkarten ab Pro/Elite.
