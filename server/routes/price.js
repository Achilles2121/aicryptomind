import { Router } from "express";
import { fetchCoingeckoSimplePrice } from "../../api/_lib/providers/coingecko.js";
import { fetchBinanceTicker } from "../../api/_lib/providers/binance.js";
import { fetchCryptoComparePrice } from "../../api/_lib/providers/cryptocompare.js";
import { createHealthTracker } from "../../api/_lib/health.js";
import { assetSources } from "../../api/_lib/sources.js";
import { clampNumber } from "../../api/_lib/utils.js";
import { withCache } from "../utils/cache.js";

const router = Router();

router.get("/", async (req, res, next) => {
  const asset = String(req.query.asset || "BTC").toUpperCase();
  const vs = String(req.query.vs || "USD").toUpperCase();
  const cacheMs = clampNumber(req.query.cacheMs || 500, { min: 0, max: 5000 });
  const cgId = assetSources[asset]?.cg || "bitcoin";
  const binanceSymbol = assetSources[asset]?.binance || `${asset}USDT`;

  try {
    const result = await withCache(`price:${asset}:${vs}`, cacheMs, async () => {
      const tracker = createHealthTracker();

      const serialize = (payload, status = 200) => ({
        payload: { ...payload, health: tracker.toArray(), generatedAt: new Date().toISOString() },
        status,
      });

      try {
        const cg = await fetchCoingeckoSimplePrice([cgId], vs.toLowerCase());
        const entry = cg?.[cgId]?.[vs.toLowerCase()];
        if (Number.isFinite(entry)) {
          tracker.set("coingecko", "ok");
          return serialize({
            data: {
              asset,
              vs,
              value: Number(entry),
              change24h: Number(cg?.[cgId]?.[`${vs.toLowerCase()}_24h_change`] ?? 0),
              source: "CoinGecko",
              updatedAt: new Date().toISOString(),
            },
          });
        }
        tracker.set("coingecko", "degraded", "missing price");
      } catch (err) {
        tracker.set("coingecko", "error", err?.message || "coingecko failed");
      }

      try {
        const ticker = await fetchBinanceTicker(binanceSymbol);
        if (Number.isFinite(ticker.price)) {
          tracker.set("binance", "ok");
          return serialize({
            data: {
              asset,
              vs,
              value: ticker.price,
              change24h: ticker.changePercent ?? null,
              source: "Binance",
              updatedAt: new Date().toISOString(),
            },
          });
        }
        tracker.set("binance", "degraded", "missing price");
      } catch (err) {
        tracker.set("binance", "error", err?.message || "binance failed");
      }

      try {
        const value = await fetchCryptoComparePrice(asset, vs);
        if (Number.isFinite(value)) {
          tracker.set("cryptocompare", "ok");
          return serialize({
            data: {
              asset,
              vs,
              value,
              change24h: null,
              source: "CryptoCompare",
              updatedAt: new Date().toISOString(),
            },
          });
        }
        tracker.set("cryptocompare", "error", "missing price");
      } catch (err) {
        tracker.set("cryptocompare", "error", err?.message || "cryptocompare failed");
      }

      return serialize(
        {
          error: "Failed to fetch price",
        },
        502
      );
    });

    return res.status(result.status).json(result.payload);
  } catch (err) {
    return next(err);
  }
});

export default router;
