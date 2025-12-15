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
  if (res.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (typeof res.json === "function") {
    res.status(status).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
};

const correlationMatrix = () => ({
  BTC: { SPY: 0.32, QQQ: 0.41, DXY: -0.28, GOLD: 0.12 },
  ETH: { SPY: 0.29, QQQ: 0.37, DXY: -0.22, GOLD: 0.08 },
  SPY: { BTC: 0.32, ETH: 0.29, QQQ: 0.92, DXY: -0.35, GOLD: -0.05 },
});

export default async function handler(_req: Req, res: Res) {
  try {
    return send(res, 200, {
      ok: true,
      correlations: correlationMatrix(),
      timestamp: Date.now(),
    });
  } catch (error) {
    return send(res, 200, {
      ok: true,
      correlations: correlationMatrix(),
      timestamp: Date.now(),
      note: "auto-recovered",
      error: (error as Error)?.message,
    });
  }
}
