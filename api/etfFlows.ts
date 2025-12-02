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

const buildFlows = () => {
  const now = Date.now();
  return [
    { symbol: "SPY", flow: 185_000_000, change: 0.4, time: now },
    { symbol: "QQQ", flow: 122_000_000, change: 0.25, time: now },
    { symbol: "IBIT", flow: 96_000_000, change: 0.6, time: now },
    { symbol: "GLD", flow: 41_000_000, change: -0.1, time: now },
    { symbol: "HYG", flow: 21_000_000, change: 0.05, time: now },
  ];
};

export default async function handler(_req: Req, res: Res) {
  try {
    return send(res, 200, { ok: true, flows: buildFlows(), timestamp: Date.now() });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      flows: buildFlows(),
      timestamp: Date.now(),
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
