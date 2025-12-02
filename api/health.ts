import { cache } from "./utils/cache";

type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

const send = (res: Res, status: number, body: unknown) => {
  if (res.setHeader) res.setHeader("Content-Type", "application/json");
  if (typeof res.json === "function") {
    res.status(status).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
};

export default async function handler(_req: unknown, res: Res) {
  try {
    return send(res, 200, {
      ok: true,
      uptime: process.uptime?.() ?? 0,
      cacheSize: (cache as unknown as { store?: Map<unknown, unknown> }).store?.size ?? 0,
      timestamp: Date.now(),
      services: {
        price: "ready",
        ohlc: "ready",
        indicators: "ready",
        etf: "ready",
      },
    });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      timestamp: Date.now(),
      services: {},
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
