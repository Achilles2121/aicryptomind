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

  const buildResponse = (tracker, { data = null, status = "ok", error = null, provider = null } = {}) => ({
    ok: status === "ok" && !error,
    status,
    error,
    data,
    provider,
    health: tracker?.toArray() || [],
    generatedAt: new Date().toISOString(),
  });

  try {
    const result = await withCache(`ohlc:${pair}:${binanceSymbol}:${interval}:${limit}`, cacheMs, async () => {
      const tracker = createHealthTracker();
      const fail = (status = "upstream_error", message = "Failed to fetch OHLC") =>
        buildResponse(tracker, { status, error: message, data: null });

      try {
        const kraken = await fetchKrakenOhlc(pair, interval, limit);
        if (kraken.length >= MIN_POINTS) {
          tracker.set("kraken", "ok");
          return buildResponse(tracker, { data: normalizeCandles(kraken), provider: "kraken" });
        }
        tracker.set("kraken", kraken.length ? "degraded" : "error", kraken.length ? "low sample" : "empty response");
      } catch (err) {
        tracker.set("kraken", "error", err?.message || "kraken failed");
      }

      try {
        const rows = await fetchBinanceKlines(binanceSymbol, { limit, interval: mapBinanceInterval(interval) });
        if (rows.length >= MIN_POINTS) {
          tracker.set("binance", "ok");
          return buildResponse(tracker, { data: normalizeCandles(rows), provider: "binance" });
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
          return buildResponse(tracker, { data: normalizeCandles(rows), provider: "coingecko" });
        }
        tracker.set("coingecko", rows.length ? "degraded" : "error", rows.length ? "low sample" : "empty response");
      } catch (err) {
        tracker.set("coingecko", "error", err?.message || "coingecko failed");
      }

      return fail("upstream_error");
    });

    return res.status(200).json(result);
  } catch (err) {
    const tracker = createHealthTracker();
    const status = err?.name === "AbortError" ? "timeout" : "upstream_error";
    return res
      .status(200)
      .json(buildResponse(tracker, { status, error: err?.message || "unknown error", data: null }));
  }
});

export default router;
