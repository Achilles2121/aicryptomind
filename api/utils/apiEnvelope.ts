export type ApiStatus = "ok" | "invalid_request" | "degraded" | "disabled" | "error";

export interface ApiEnvelope<T = unknown> {
  ok: boolean;
  status: ApiStatus;
  statusCode?: number;
  hint?: string;
  source?: string;
  data?: T;
  errors?: unknown;
  error?: unknown;
  cached?: boolean;
  health?: string;
}

export type EnvelopeStatus = ApiStatus;

type ResLike = {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

const deriveHttpStatus = (envelope: ApiEnvelope<unknown>) => {
  if (typeof envelope.statusCode === "number") return envelope.statusCode;
  if (envelope.ok) return 200;
  if (envelope.status === "invalid_request") return 400;
  if (envelope.status === "disabled") return 503;
  return 502;
};

export function ok<T>(
  data: T,
  opts: {
    statusCode?: number;
    hint?: string;
    source?: string;
    cached?: boolean;
    health?: string;
  } = {}
): ApiEnvelope<T> {
  const { statusCode = 200, hint, source, cached, health } = opts;
  return { ok: true, status: "ok", statusCode, hint, source, data, cached, health };
}

export function fail(
  status: ApiStatus,
  opts: {
    statusCode?: number;
    hint?: string;
    source?: string;
    errors?: unknown;
    error?: unknown;
    cached?: boolean;
    health?: string;
    message?: string;
    data?: unknown;
  } = {}
): ApiEnvelope<never> {
  const { statusCode, hint, source, errors, error, cached, health, message, data } = opts;
  const fallbackCode =
    statusCode ?? (status === "invalid_request" ? 400 : status === "disabled" ? 503 : status === "ok" ? 200 : 502);
  return { ok: false, status, statusCode: fallbackCode, hint, source, errors, error, cached, health, message, data };
}

export const okEnvelope = ok;
export const failEnvelope = fail;

export function sendEnvelope<T>(envelope: ApiEnvelope<T>): Response;
export function sendEnvelope<T>(res: ResLike, envelope: ApiEnvelope<T>): void;
export function sendEnvelope<T>(first: ResLike | ApiEnvelope<T>, envelope?: ApiEnvelope<T>): Response | void {
  if (envelope) {
    const res = first as ResLike;
    if (res.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
    const status = deriveHttpStatus(envelope);
    if (typeof res.json === "function") {
      res.status(status).json(envelope);
      return;
    }
    if (res.end) {
      res.end(JSON.stringify(envelope));
    }
    return;
  }
  const body = first as ApiEnvelope<T>;
  const status = deriveHttpStatus(body);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
