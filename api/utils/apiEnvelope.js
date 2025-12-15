const ApiStatus = {
  OK: "ok",
  INVALID_REQUEST: "invalid_request",
  DEGRADED: "degraded",
  DISABLED: "disabled",
  ERROR: "error",
};

const deriveHttpStatus = (envelope) => {
  if (typeof envelope?.statusCode === "number") return envelope.statusCode;
  if (envelope?.ok) return 200;
  if (envelope?.status === ApiStatus.INVALID_REQUEST) return 400;
  if (envelope?.status === ApiStatus.DISABLED) return 503;
  return 502;
};

const ok = (data, opts = {}) => {
  const { statusCode = 200, hint, source, cached, health } = opts;
  return { ok: true, status: ApiStatus.OK, statusCode, hint, source, data, cached, health };
};

const fail = (status, opts = {}) => {
  const { statusCode, hint, source, errors, error, cached, health, data } = opts;
  const fallbackCode =
    statusCode ??
    (status === ApiStatus.INVALID_REQUEST ? 400 : status === ApiStatus.DISABLED ? 503 : status === ApiStatus.OK ? 200 : 502);
  return { ok: false, status, statusCode: fallbackCode, hint, source, errors, error, cached, health, data };
};

const okEnvelope = ok;
const failEnvelope = fail;

function sendEnvelope(first, envelope) {
  if (envelope) {
    const res = first;
    if (res?.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
    const status = deriveHttpStatus(envelope);
    if (typeof res?.json === "function") {
      res.status(status).json(envelope);
      return;
    }
    if (res?.end) {
      res.end(JSON.stringify(envelope));
    }
    return;
  }
  const body = first;
  const status = deriveHttpStatus(body);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export { ApiStatus, ok, fail, okEnvelope, failEnvelope, sendEnvelope };
