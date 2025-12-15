# API-Konsolidierung (Vercel Hobby)

## Ziel
- Funktionsanzahl auf Hobby-Limit (≤12, Ziel 10) senken, ohne Preis-/OHLC-/ETF-Kerndaten zu verlieren.
- Alle Asset-Klassen (Crypto, FX, Indizes, Gold) weiter über die Hauptendpunkte bedienen.
- Health-Checks nur für tatsächlich deployte Routen/Provider.

## Aktiver API-Satz (10 Funktionen)
- `api/price.ts` – Preise für Crypto/FX/Indizes/Metalle, provider-abhängig (CoinGecko/Binance/Kraken/STOOQ/FX_PROVIDER).
- `api/ohlc.ts` – OHLC für alle Asset-Klassen mit Provider-Priorität + Fallback.
- `api/derivatives.ts` – CoinAPI-Metriken (Funding/OI) mit Health-Tracker + Cache.
- `api/health.ts` – Provider-Pings (CG/CC/FMP/Binance/Kraken), gecacht.
- `api/indicators.ts` – RSI/MACD/ATR/Stoch/EMA etc. aus OHLC, gecacht.
- `api/liquidity.ts` – Orderblocks/FVG/Imbalance/Whales aus OHLC, gecacht.
- `api/etf/flows.js` – ETF-Flows (FMP primär, Soso/CoinStats Fallback), Health.
- `api/etf/holdings.js` – ETF-Holdings/AUM (FMP primär, Soso/CoinStats Fallback), Health.
- `api/etf/correlations.ts` – ETF vs BTC/ETH/SP500/Gold Korrelationen (FMP + CG, Stooq-Fallback), Health.
- `api/etf/news.js` – ETF-News (CoinStats, FMP Fallback), ApiEnvelope + Health.

## Aus /api entfernt (zählen nicht mehr als Funktionen)
- Verschoben nach `api_disabled/`: `binance.ts`, `correlations.ts` (Mock), `kraken/ohlc.js`, `market/intel.ts`.
- Behalten für lokale Experimente, aber keine Vercel-Funktionen.

## Health-Ausrichtung
- Prüft nur noch Provider, die von aktiven Routen genutzt werden.
- Fehlende Premium-Keys → `warn/degraded` statt harter Fehler.
- GOLD/Indizes laufen über `price`/`ohlc` mit STOOQ/FX_PROVIDER-Mappings; Health reflektiert diese Pfade.

## Tests (durchgelaufen)
- `npm run lint:encoding`
- `npm run lint` (nur bestehende Warnungen in `src/App.jsx`)
- `npm run typecheck`
- `npm run build`
- `npm run test:unit`

## Offene Warnungen / Hinweise
- ESLint-Warnungen in `src/App.jsx` (unused vars, Hook-Dependencies) bestehen weiterhin, da UI/Logik unverändert bleiben sollte.
- Health kann weiterhin „Warn“ zeigen, wenn optionale/premium Provider fehlen oder sekundäre Quellen ausfallen.
