import { Router } from "express";
import { fetchBinanceKlines } from "../../api/_lib/providers/binance.js";
import { clampNumber, mapBinanceInterval } from "../../api/_lib/utils.js";

const router = Router();

router.get("/klines", async (req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
    const minutes = clampNumber(req.query.interval || 60, { min: 1, max: 1440 });
    const interval = req.query.binanceInterval || mapBinanceInterval(minutes);
    const limit = clampNumber(req.query.limit || 160, { min: 10, max: 720 });
    const data = await fetchBinanceKlines(symbol, { limit, interval });
    return res.json({ data, provider: "binance", generatedAt: new Date().toISOString() });
  } catch (err) {
    err.status = err?.status || 502;
    err.message = err?.message || "Binance klines failed";
    return next(err);
  }
});

export default router;
