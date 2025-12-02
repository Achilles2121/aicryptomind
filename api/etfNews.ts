type Req = {
  query?: Record<string, string | string[]>;
};

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

const sampleNews = () => {
  const now = Date.now();
  return [
    {
      id: "etf-news-1",
      title: "Spot Bitcoin ETFs show inflows while volatility cools",
      source: "Elite Trader Desk",
      url: "https://example.com/etf-bitcoin",
      publishedAt: now - 15 * 60_000,
      summary: "Spot BTC funds lead flows as traders rotate from tech mega-caps.",
    },
    {
      id: "etf-news-2",
      title: "High-yield credit stabilizes as Fed pause extends",
      source: "Elite Trader Desk",
      url: "https://example.com/fixed-income",
      publishedAt: now - 60 * 60_000,
      summary: "Credit spreads tighten with moderating inflation and resilient labor data.",
    },
    {
      id: "etf-news-3",
      title: "Energy and uranium ETFs catch bid on supply tightness",
      source: "Elite Trader Desk",
      url: "https://example.com/energy",
      publishedAt: now - 90 * 60_000,
      summary: "Commodity curves remain backwardated; funds see tactical inflows.",
    },
  ];
};

export default async function handler(_req: Req, res: Res) {
  try {
    return send(res, 200, { ok: true, news: sampleNews(), timestamp: Date.now() });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      news: sampleNews(),
      timestamp: Date.now(),
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
