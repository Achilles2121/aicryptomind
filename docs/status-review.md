# Statusreview: Vision AI Mind Dashboard

## Diagnose (Kurzfassung)
- **Backend issues:** Kein separater `/api/health` Router (jetzt ergänzt); Express lief auf 5176 ohne kombiniertes Dev-Skript; teils fehlende shared safeFetch/cache; direkte Provider-Calls aus dem Frontend führten zu CORS/ECONNREFUSED, wenn der Proxy aus war.
- **Frontend issues:** StrictMode-Doppel-Mount; mehrere ErrorBoundaries unnötig; einige Services nutzten weiterhin externe URLs statt `/api`.
- **Chart & indicator issues:** Charts konnten `undefined`/leere Arrays erhalten; Indikator- und Derivate-Services riefen externe APIs direkt.
- **Trial / tier issues:** Trial-/Tier-Logik vorhanden, aber weiter zu testen (7 Tage Trial, Elite während Trial); muss fehlertolerant bei fehlender `trialStart` bleiben.
- **Build/deploy issues:** Vite-Proxy zuvor nicht strikt auf 5175/5176; fehlende kombinierte Dev-Skripte; teils veraltete/fehlerhafte Docs (Encoding).

## Erledigt (aktuelle Runde)
- Express-Proxy gehärtet: `/api/health` Router, Rate-Limit, Kurzzeit-Cache, nativer Fetch.
- Neue/aktualisierte Routen: `/api/indicators`, `/api/derivatives`, gecachte `/api/price` und `/api/ohlc` inkl. Health.
- Frontend-Services: `marketDataLive` nutzt `/api/ohlc`, `derivativesLive` nutzt `/api/derivatives`, `etfCorrelations` nutzt `/api/etf/correlations`.
- Vite-Proxy fixiert (Port 5175 strict → Proxy 5176). Eine ErrorBoundary in `src/main.jsx`, StrictMode entfernt.
- Scripts: `dev` startet parallel `dev:server` + `dev:frontend` via npm-run-all; Abhängigkeiten express/cors/morgan/npm-run-all deklariert.
- Docs bereinigt/aktualisiert: `trading-engine-analysis.md`, `deploy-guide.md`, `status-review.md`, `final-system-validation.md`.

## Offene Punkte
- Secrets (`VITE_COINAPI_KEY`, `VITE_FMP_KEY`, Firebase) fehlen → ETF/Derivate bleiben degraded/null ohne sie.
- Charts brauchen durchgehend Guards/Skeletons (Recharts nie mit null/empty) und Anbindung aller Widgets an `/api/indicators`/`/api/derivatives`.
- Keine aktuellen Lint/Typecheck-Läufe oder automatisierte CI-Smokes; Mobile Tab-/Reload-Flow nach Proxy-Anpassung noch nicht verifiziert.

## Nächste Schritte (kurz)
1. Secrets setzen und Smoke-Tests: `curl /api/health`, `/api/price`, `/api/ohlc`, `/api/indicators`, `/api/derivatives`, `/api/etf/*`; Ergebnisse in `docs/local-health-report.md` notieren.
2. Frontend-Wiring finalisieren: alle Charts auf Proxy-Endpunkte umstellen, Null/Empty-Guards setzen, Error/Skeleton-UI nutzen.
3. CI ergänzen (`lint`, `typecheck`, `build`, supertest-smokes) und Mobile/Reload-Verhalten prüfen; Deploy-Doku ggf. erweitern.
