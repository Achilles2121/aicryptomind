import { Router } from "express";
import { fetchKrakenOhlc } from "../../api/_lib/providers/kraken.js";
import { fetchBinanceKlines } from "../../api/_lib/providers/binance.js";
import { fetchCoingeckoOhlc } from "../../api/_lib/providers/coingecko.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { clampNumber, mapBinanceInterval, normalizeCandles } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";
import { buildIndicators } from "../utils/indicators.js";

const MIN_POINTS = 30;

const fetchCandles = async ({ pair, binanceSymbol, interval, limit, cacheMs }) => {
  const cacheKey = `indicators:${pair}:${binanceSymbol}:${interval}:${limit}`;

  return withCache(cacheKey, cacheMs, async () => {
    const tracker = createHealthTracker();

    try {
      const kraken = await fetchKrakenOhlc(pair, interval, limit);
      if (kraken.length >= MIN_POINTS) {
        tracker.set("kraken", "ok");
        return { candles: normalizeCandles(kraken), health: tracker.toArray() };
      }
      tracker.set("kraken", kraken.length ? "degraded" : "error", "kraken sample too small");
    } catch (err) {
      tracker.set("kraken", "error", err?.message || "kraken failed");
    }

    try {
      const binance = await fetchBinanceKlines(binanceSymbol, { limit, interval: mapBinanceInterval(interval) });
      if (binance.length >= MIN_POINTS) {
        tracker.set("binance", "ok");
        return { candles: normalizeCandles(binance), health: tracker.toArray() };
      }
      tracker.set("binance", binance.length ? "degraded" : "error", "binance sample too small");
    } catch (err) {
      tracker.set("binance", "error", err?.message || "binance failed");
    }

    try {
      const cg = await fetchCoingeckoOhlc("bitcoin", { days: interval >= 1440 ? 30 : 7 });
      if (cg.length >= MIN_POINTS) {
        tracker.set("coingecko", "ok");
        return { candles: normalizeCandles(cg), health: tracker.toArray() };
      }
      tracker.set("coingecko", cg.length ? "degraded" : "error", "coingecko sample too small");
    } catch (err) {
      tracker.set("coingecko", "error", err?.message || "coingecko failed");
    }

    return { candles: [], health: tracker.toArray() };
  });
};

const router = Router();

router.get("/", async (req, res, next) => {
  const pair = String(req.query.pair || "XXBTZUSD").toUpperCase();
  const binanceSymbol = String(req.query.symbol || req.query.binance || "BTCUSDT").toUpperCase();
  const interval = clampNumber(req.query.interval || 60, { min: 1, max: 1440 });
  const limit = clampNumber(req.query.limit || 240, { min: 60, max: 720 });
  const cacheMs = clampNumber(req.query.cacheMs || 500, { min: 0, max: 5000 });
  const type = String(req.query.type || "rsi").toLowerCase();
  const params = {};
  ["period", "fast", "slow", "signal", "fastPeriod", "slowPeriod", "smoothK", "smoothD"].forEach((key) => {
    const value = Number(req.query[key]);
    if (Number.isFinite(value)) params[key] = value;
  });

  try {
    const { candles, health } = await fetchCandles({ pair, binanceSymbol, interval, limit, cacheMs });
    if (!candles?.length) {
      return res.status(502).json({ error: "indicator_source_unavailable", health, generatedAt: new Date().toISOString() });
    }
    const indicator = buildIndicators(candles, { type, params });
    const payload = {
      data: indicator,
      meta: {
        pair,
        binanceSymbol,
        interval,
        limit,
        type,
        params,
      },
      health,
      generatedAt: new Date().toISOString(),
    };
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
});

export default router;
