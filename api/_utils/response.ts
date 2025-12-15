export type ApiStatus = "ok" | "degraded" | "disabled" | "invalid_request" | "error";

export type ApiEnvelope<T = unknown> = {
  ok: boolean;
  status: ApiStatus;
  statusCode?: number;
  source?: string;
  data?: T;
  hint?: string;
  errors?: string[];
  message?: string;
  cached?: boolean;
  health?: unknown;
  error?: unknown;
};

type ResLike = {
  status: (code: number) => ResLike;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  end?: (body?: string) => void;
};

export const sendEnvelope = <T>(res: ResLike, body: ApiEnvelope<T>) => {
  if (res.setHeader) res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (typeof res.json === "function") {
    res.status(200).json(body);
  } else if (res.end) {
    res.end(JSON.stringify(body));
  }
};

export const buildErrorEnvelope = (params: {
  status?: ApiStatus;
  statusCode?: number;
  source?: string;
  hint?: string;
  message?: string;
  errors?: string[];
}) => {
  const { status = "degraded", statusCode = 502, source, hint, message, errors } = params;
  return {
    ok: false,
    status,
    statusCode,
    source,
    hint,
    message,
    errors,
  } as ApiEnvelope;
};
