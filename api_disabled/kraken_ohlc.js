import { fetchKrakenOhlc } from "../../api/_lib/providers/kraken.js";
import { jsonResponse, errorResponse } from "../../api/_lib/http.js";
import { clampNumber } from "../../api/_lib/utils.js";

export const config = { runtime: "edge" };

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const pair = (searchParams.get("pair") || "XXBTZUSD").toUpperCase();
    const interval = clampNumber(searchParams.get("interval") || 60, { min: 1, max: 1440 });
    const limit = clampNumber(searchParams.get("limit") || 160, { min: 10, max: 720 });
    const data = await fetchKrakenOhlc(pair, interval, limit);
    return jsonResponse({ data, generatedAt: new Date().toISOString(), provider: "kraken" });
  } catch (err) {
    console.error("/api/kraken/ohlc", err);
    const status = err?.status || 502;
    return errorResponse(err?.message || "Kraken OHLC failed", status);
  }
}
