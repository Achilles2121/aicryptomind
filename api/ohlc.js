import { fetchKrakenOhlc } from "./_lib/providers/kraken.js";
import { fetchBinanceKlines } from "./_lib/providers/binance.js";
import { fetchCoingeckoOhlc } from "./_lib/providers/coingecko.js";
import { jsonResponse, errorResponse } from "./_lib/http.js";
import { createHealthTracker } from "./_lib/health.js";
import { assetSources, symbolFromPair } from "./_lib/sources.js";
import { clampNumber, mapBinanceInterval, normalizeCandles } from "./_lib/utils.js";

export const config = { runtime: "edge" };

const MIN_POINTS = 5;

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const pair = (searchParams.get("pair") || "XXBTZUSD").toUpperCase();
  const binanceSymbol = (searchParams.get("binance") || "BTCUSDT").toUpperCase();
  const interval = clampNumber(searchParams.get("interval") || 60, { min: 1, max: 1440 });
  const limit = clampNumber(searchParams.get("limit") || 160, { min: 30, max: 720 });
  const tracker = createHealthTracker();

  const serializeOk = (provider, data) => {
    tracker.set(provider, "ok");
    return jsonResponse({ data, provider, health: tracker.toArray(), generatedAt: new Date().toISOString() });
  };

  try {
    const kraken = await fetchKrakenOhlc(pair, interval, limit);
    if (kraken.length >= MIN_POINTS) {
      return serializeOk("kraken", normalizeCandles(kraken));
    }
    tracker.set("kraken", kraken.length ? "degraded" : "error", kraken.length ? "low sample" : "empty response");
  } catch (err) {
    tracker.set("kraken", "error", err?.message || "kraken failed");
  }

  try {
    const rows = await fetchBinanceKlines(binanceSymbol, { limit, interval: mapBinanceInterval(interval) });
    if (rows.length >= MIN_POINTS) {
      return serializeOk("binance", normalizeCandles(rows));
    }
    tracker.set("binance", rows.length ? "degraded" : "error", rows.length ? "low sample" : "empty response");
  } catch (err) {
    tracker.set("binance", "error", err?.message || "binance failed");
  }

  const symbol = symbolFromPair(pair) || Object.keys(assetSources).find((key) => assetSources[key].binance === binanceSymbol) || "BTC";
  const cgId = assetSources[symbol]?.cg || "bitcoin";
  try {
    const rows = await fetchCoingeckoOhlc(cgId, { days: interval >= 1440 ? 30 : 7 });
    if (rows.length >= MIN_POINTS) {
      return serializeOk("coingecko", normalizeCandles(rows));
    }
    tracker.set("coingecko", rows.length ? "degraded" : "error", rows.length ? "low sample" : "empty response");
  } catch (err) {
    tracker.set("coingecko", "error", err?.message || "coingecko failed");
  }

  return errorResponse("Failed to fetch OHLC", 502, { health: tracker.toArray() });
}
