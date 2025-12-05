# Statusreview: Vision AI Mind Dashboard

## Was geklappt hat ✅

- **Build-Pipeline stabil**: `npm run build` läuft lokal ohne Fehler (Stand: 01.12.2025) und bestätigt, dass Vite/Tailwind/Bundling unverändert funktionieren.
- **Error Boundary konsolidiert**: `src/App.jsx` exportiert wieder den nackten `App`-Component; die einzige ErrorBoundary lebt in `src/main.jsx`, wodurch das iOS-Safari-Reload-Loop verschwindet und StrictMode keine Doppel-Mounts mehr provoziert.
- **StrictMode/Hydration**: Durch das Verschieben der Boundary außerhalb von `React.StrictMode` bleibt die Dev-Doppelung auf UI-State beschränkt, ohne dass die Fehlerseite erneut getriggert wird.
- **Projektanalyse dokumentiert**: `docs/trading-engine-analysis.md` fasst Architektur, Datenquellen, Health-Store-Regeln und offene V3+ Anforderungen zusammen und dient als Referenz für weitere Arbeiten.

## Was noch nicht geklappt hat ⚠️

- **Proxy/Serverless-Umstellung**: Express-basierter Proxy in `server/index.js` kollidiert weiter mit Vercel; `/api`-Rewrite ist noch nicht auf einzelne Endpunkte/Serverless Handler reduziert.
- **Chart-/Datenpipeline**: Kraken-OHLC + Binance-WS-Fallbacks blockieren gelegentlich das Rendern; Guard-Checks für `indicatorSeries`, `hasProAccess` etc. sind noch nicht vollständig umgesetzt.
- **safeFetch & Tier-Flow**: Aggregated Errors aus Nicht-JSON-Antworten und Trial-Persistenz (localStorage vs. Firebase) führen weiterhin zu doppelten API-Aufrufen und zurückgesetzten Trials.
- **ETF-Proxy-Dienste**: Holdings/Flows/News laufen noch über direkte Drittanbieter-Aufrufe statt über die geplanten `/api/etf/*`-Handler, wodurch Health-Status und Rate-Limits unkontrolliert bleiben.
- **Dokumentation & Tests**: README/Release Notes spiegeln die anstehenden Änderungen (Proxy, SafeFetch, Trials, Mobile) noch nicht wider; automatisierte Tests oder erneute Builds nach den kommenden Fixes fehlen.

## Nächste Schritte

1. Proxy/Serverless refactor abschließen und `/api/*`-Calls anpassen.
2. Chart/HTF/ETF-Services härten, damit Erst-Load + Mobile stabil bleiben.
3. safeFetch/Tier-Handling finalisieren, danach README & Release-Notes aktualisieren.
