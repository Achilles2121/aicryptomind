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

const holdingsTemplate = () => [
  { symbol: "AAPL", weight: 10.2 },
  { symbol: "MSFT", weight: 9.8 },
  { symbol: "NVDA", weight: 8.9 },
  { symbol: "AMZN", weight: 7.1 },
  { symbol: "GOOGL", weight: 6.5 },
  { symbol: "BTC", weight: 5.0 },
  { symbol: "ETH", weight: 3.2 },
];

export default async function handler(req: Req, res: Res) {
  try {
    const symbol =
      (typeof req.query?.symbol === "string"
        ? req.query.symbol
        : Array.isArray(req.query?.symbol)
        ? req.query.symbol[0]
        : undefined) ?? "ELITE";

    return send(res, 200, {
      ok: true,
      fund: symbol.toUpperCase(),
      holdings: holdingsTemplate(),
      timestamp: Date.now(),
    });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      fund: "ELITE",
      holdings: holdingsTemplate(),
      timestamp: Date.now(),
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
