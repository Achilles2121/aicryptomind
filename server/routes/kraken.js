import { Router } from "express";
import { fetchKrakenOhlc } from "../../api/_lib/providers/kraken.js";
import { clampNumber } from "../../api/_lib/utils.js";

const router = Router();

router.get("/ohlc", async (req, res, next) => {
  try {
    const pair = String(req.query.pair || "XXBTZUSD").toUpperCase();
    const interval = clampNumber(req.query.interval || 60, { min: 1, max: 1440 });
    const limit = clampNumber(req.query.limit || 160, { min: 10, max: 720 });
    const data = await fetchKrakenOhlc(pair, interval, limit);
    return res.json({ data, provider: "kraken", generatedAt: new Date().toISOString() });
  } catch (err) {
    err.status = err?.status || 502;
    err.message = err?.message || "Kraken OHLC failed";
    return next(err);
  }
});

export default router;
