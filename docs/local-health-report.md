# Local Health Report
<!-- Trial/Tier (Stand jetzt): Tier stammt aus UserTierContext/Firebase (effectiveTier, trial* flags) mit manuellem Trial-Button im Header; Elite-Zugriff bisher login-/trial-getrieben. Toast/Warn: safeFetch triggert Health/Toasts (uiLevel), App.jsx logEvent/addToast zeigt Fehler/Recoveries, einzelne Warn-Banner im Header für Trial/Hinweise. Anpassungen erfolgen in App.jsx (Tier/Trial-UI, Toast-Gating), neuem Hook useEliteTrial (clientseitiger Auto-Trial), safeFetch uiLevel-Policy, sowie ggf. Layout-Komponenten für Warn-Banner. -->
<!-- Data-Pipeline Kurz: Spot/OHLC über CoinGecko/Binance/Kraken (free) plus CryptoCompare/CoinStats je nach Flag; Premium (FMP/CoinAPI/Glassnode/Santiment/HuggingFace) melden degraded ohne Keys. openProviders.ts liefert StandardizedOhlc (t/o/h/l/c/v + source) und StandardizedPrice. marketDataLive kombiniert offene Provider + Proxy (/api/ohlc, /api/kraken/ohlc) für Live Market, FIB Map, Indicators; derivativesLive für Funding/OI; etfCorrelationLive nur System-Status. -->
<!-- Quick status (2025-02): FE dev 5175 via `npm run dev`, API/proxy 5176 via `npm run dev:api` or `npm run dev:server`; free sources (CoinGecko, CryptoCompare, Binance, Kraken, CoinStats, SosoValue) default active, premium (FMP, CoinAPI, Glassnode, Santiment, HuggingFace) degrade when keys missing/401/403; safeFetch marks disabled only if VITE_ENABLE_* = "false", 401/403 => degraded/warn, Abort => warn/error, CORS => warn; api/etf/correlations returns structured JSON with status codes, catches abort/timeout, and skips upstream entirely when ETF_CORRELATIONS_DISABLED=true (returns disabled response); multiple disabled entries in System Status currently come from explicit VITE_ENABLE_* flags or upstream health reporting missing keys. -->



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

## Dev Setup & Ports (2025-12 update)

- Frontend: `npm run dev` → http://localhost:5175

- API/Proxy: `npm run dev:api` (Vercel dev) oder `npm run dev:server` → http://localhost:5176

- CORS: `FRONTEND_ORIGIN` default ist `http://localhost:5175`.

- ETF-Korrelationen: FMP primär, Fallback Stooq (CSV) bei fehlendem Key/Fehler → Health `degraded`, leere Daten. Dev-Flag: `ETF_CORRELATIONS_DISABLED=true` zum Abschalten.

- Provider-Toggles: `VITE_ENABLE_*` Flags steuern SafeFetch-Quellen; fehlende Keys ergeben `degraded` statt Crash.

## 2025-02 Update

- Flags & Disabled: `ETF_CORRELATIONS_DISABLED=true` beantwortet `/api/etf/correlations` sofort mit `ok:false`, `status:"disabled"`, `503`, ohne Upstream-Call; System-Status zeigt „Disabled (Config)“.
- Enable/Degrade: `VITE_ENABLE_* = "false"` schaltet Quellen hart auf disabled; fehlende Premium-Keys (FMP, CoinAPI, Glassnode, Santiment, HuggingFace) melden jetzt `degraded`/warn statt disabled, Free-Sources bleiben standardmäßig aktiv.
- Default Active vs Premium: CoinGecko, CryptoCompare, Binance, Kraken, CoinStats, SosoValue laufen out-of-the-box; Premium-Quellen liefern erst mit Keys volle Daten, sonst „degraded“ Fallbacks.
- Checks zum Durchführen: `npm run lint:encoding` → `npm run lint` → `npm run typecheck` → `npm run build` → `npm run test:unit`.
- Funktionale Kurzfassung: System-Status trennt jetzt klar zwischen disabled (per Flag) und degraded (Key/Rate/Timeout), ETF-Korrelationen geben bei deaktiviertem Flag sofort eine strukturierte 503-Antwort ohne Polling-Flut zurück.
- Open-Source-Provider: Neue Feeds über `MARKET_DATA_PROVIDERS` (src/config/dataSources.ts) + Adapter in `src/services/providers/openProviders.ts`; Aktivierung via Env-Flags wie `VITE_ENABLE_OPENPROVIDER1/2` (müssen explizit "true" sein).
- Warnungen: Hintergrund-Provider-Warnungen erscheinen nur noch im System-Status/Health, nicht mehr als Toast-Flut; Toasts bleiben für Login/Billing/kritische Fehler reserviert.

## 2025-02 Runtime-Stabilisierung
- Price/OHLC-APIs liefern bei Upstream-Problemen keine 500er mehr, sondern strukturierte `ok:false`-Antworten mit `status:"degraded"/"disabled"` und passenden Status-Codes (502/503/504); erfolgreiche Free-Provider reichen für `ok:true`.
- Hintergrund-Feeds (price, ohlc, etfCorrelations) erzeugen keine roten Toasts mehr; Fehler landen im System-Status, UI bleibt ruhig.
- Open-Source-Provider (CoinGecko/Binance/Kraken) werden bevorzugt genutzt; Premium-Quellen markieren bei fehlenden Keys nur noch `degraded`, nicht `disabled`.

## 2025-02 Trial/UX-Update
- 7-Tage-Elite-Trial startet jetzt automatisch pro Browser (localStorage), läuft clientseitig 7 Tage als „Elite (Trial)“, danach Rückfall auf Basic/Free.
- Kein Login/Firebase-Setup nötig für den Trial; bestehendes Anonymous Auth bleibt optional.
- Warn-Banner entfernt; Hintergrund-Fehler (price/ohlc/ETF) bleiben im System-Status, keine roten Toasts mehr für diese Services (`uiLevel: "silent" | "status"`).
- Empfohlene Checks: `npm run lint:encoding` → `npm run lint` → `npm run typecheck` → `npm run build` → `npm run test:unit`.




## 2025-02 Multi-Asset-Update

- Neue M�rkte eingebunden: BTCUSD, DAX, SPX, XAUUSD, EURUSD (Konfig in `src/config/markets.ts`).
- Neue Provider-Adapter: `STOOQ` (Index/FX, CSV) und `FX_PROVIDER` (Open FX) sind in `MARKET_DATA_PROVIDERS` standardm��ig aktiv.
- Asset-Selector im Header nutzt jetzt MARKETS (gruppiert nach AssetClass) und �bergibt `asset` an Price/OHLC/HTF-Loader.
- Weitere M�rkte hinzuf�gen: MARKETS in `src/config/markets.ts` erweitern und bei Bedarf Symbol-Mapping/Adapter in `src/services/providers/openProviders.ts` erg�nzen.
## 2025-02 Multi-Asset v2 / Crypto-Liste
- Markets-Registry um alle bisherigen Crypto-Assets erweitert (BTC, ETH, SOL, XRP, ADA, LTC, DOGE, BNB, AVAX, DOT); Default bleibt BTCUSD.
- Header-Selector zeigt nun die vollständige Crypto-Liste plus Indices/Commodities/FX gruppiert nach AssetClass.
- Multi-Asset-Backend (price/ohlc/htf) bleibt unverändert, Trial-Flow und System-Status bleiben stabil.

## 2025-02 – ETF/News ApiEnvelope Update
- ETF-News-Route (`api/etf/news.js`) liefert jetzt ApiEnvelope mit `ok/status/statusCode/source/data/errors` und antwortet immer 200 statt 500.
- ETF-Korrelationen (`api/etf/correlations.ts`) nutzen ebenfalls ApiEnvelope und geben degradierte Antworten statt ungefangener 500-Fehler zurück.
- Frontend-ETF-News-Loader in `src/App.jsx` wertet ApiEnvelope aus, nutzt uiLevel `status` und degradiert Health ohne Toasts.
- Upstream-Fehler/Rate-Limits erscheinen nur noch als `degraded/disabled` im System-Status; keine roten Toasts/500er mehr für ETF/News.
