import { Router } from "express";
import { fetchKrakenOhlc } from "../../api/_lib/providers/kraken.js";
import { fetchBinanceKlines } from "../../api/_lib/providers/binance.js";
import { fetchCoingeckoOhlc } from "../../api/_lib/providers/coingecko.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { assetSources, symbolFromPair } from "../../api/_lib/sources.js";
import { clampNumber, mapBinanceInterval, normalizeCandles } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";

const MIN_POINTS = 5;
const router = Router();

router.get("/", async (req, res) => {
  const pair = String(req.query.pair || "XXBTZUSD").toUpperCase();
  const binanceSymbol = String(req.query.binance || "BTCUSDT").toUpperCase();
  const interval = clampNumber(req.query.interval || 60, { min: 1, max: 1440 });
  const limit = clampNumber(req.query.limit || 160, { min: 30, max: 720 });
  const cacheMs = clampNumber(req.query.cacheMs || 500, { min: 0, max: 5000 });
  const respond = (payload, status = 200, health = []) =>
    res.status(status).json({ ...payload, health, generatedAt: new Date().toISOString() });

  try {
    const result = await withCache(`ohlc:${pair}:${binanceSymbol}:${interval}:${limit}`, cacheMs, async () => {
      const tracker = createHealthTracker();

      try {
        const kraken = await fetchKrakenOhlc(pair, interval, limit);
        if (kraken.length >= MIN_POINTS) {
          tracker.set("kraken", "ok");
          return { payload: { data: normalizeCandles(kraken), provider: "kraken" }, status: 200, health: tracker.toArray() };
        }
        tracker.set("kraken", kraken.length ? "degraded" : "error", kraken.length ? "low sample" : "empty response");
      } catch (err) {
        tracker.set("kraken", "error", err?.message || "kraken failed");
      }

      try {
        const rows = await fetchBinanceKlines(binanceSymbol, { limit, interval: mapBinanceInterval(interval) });
        if (rows.length >= MIN_POINTS) {
          tracker.set("binance", "ok");
          return { payload: { data: normalizeCandles(rows), provider: "binance" }, status: 200, health: tracker.toArray() };
        }
        tracker.set("binance", rows.length ? "degraded" : "error", rows.length ? "low sample" : "empty response");
      } catch (err) {
        tracker.set("binance", "error", err?.message || "binance failed");
      }

      const symbol =
        symbolFromPair(pair) || Object.keys(assetSources).find((key) => assetSources[key].binance === binanceSymbol) || "BTC";
      const cgId = assetSources[symbol]?.cg || "bitcoin";
      try {
        const rows = await fetchCoingeckoOhlc(cgId, { days: interval >= 1440 ? 30 : 7 });
        if (rows.length >= MIN_POINTS) {
          tracker.set("coingecko", "ok");
          return { payload: { data: normalizeCandles(rows), provider: "coingecko" }, status: 200, health: tracker.toArray() };
        }
        tracker.set("coingecko", rows.length ? "degraded" : "error", rows.length ? "low sample" : "empty response");
      } catch (err) {
        tracker.set("coingecko", "error", err?.message || "coingecko failed");
      }

      return { payload: { error: "Failed to fetch OHLC" }, status: 502, health: tracker.toArray() };
    });

    return respond(result.payload, result.status, result.health);
  } catch (err) {
    return respond({ error: err?.message || "unknown error" }, 500);
  }
});

export default router;
