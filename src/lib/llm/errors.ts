export type ProviderErrorKind = "rate_limit" | "auth" | "quota" | "unavailable" | "timeout" | "bad_request";

export interface ClassifiedError {
  kind: ProviderErrorKind;
  status?: number;
  /** Short, user-safe description (no stack traces, no raw provider bodies) */
  message: string;
  /** Seconds to wait, when the provider told us */
  retryAfter?: number;
}

/** Walks AI SDK error wrappers (RetryError.lastError, cause) to find the HTTP status. */
function findApiError(err: unknown, depth = 0): { status?: number; body?: string; headers?: Record<string, string>; msg: string } {
  const e = err as Record<string, unknown> | undefined;
  if (!e || depth > 5) return { msg: String(err) };
  const status = typeof e.statusCode === "number" ? e.statusCode : undefined;
  if (status) {
    return {
      status,
      body: typeof e.responseBody === "string" ? e.responseBody : undefined,
      headers: e.responseHeaders as Record<string, string> | undefined,
      msg: String(e.message ?? ""),
    };
  }
  for (const key of ["lastError", "cause", "error"]) {
    if (e[key]) {
      const inner = findApiError(e[key], depth + 1);
      if (inner.status) return inner;
    }
  }
  if (Array.isArray(e.errors) && e.errors.length) return findApiError(e.errors[e.errors.length - 1], depth + 1);
  return { msg: String(e.message ?? err) };
}

export function classifyError(err: unknown): ClassifiedError {
  const { status, body = "", headers, msg } = findApiError(err);
  const text = `${msg} ${body}`.toLowerCase();
  const retryAfterRaw = headers?.["retry-after"];
  const retryAfter = retryAfterRaw && !Number.isNaN(Number(retryAfterRaw)) ? Number(retryAfterRaw) : undefined;

  if ((err as Error)?.name === "AbortError" || /timed? ?out|timeout/.test(text)) {
    return { kind: "timeout", message: "The provider took too long to respond." };
  }
  if (status === 429 || /rate.?limit|too many requests|resource.?exhausted|high demand/.test(text)) {
    return { kind: "rate_limit", status, retryAfter, message: "The provider is rate-limiting requests." };
  }
  if (status === 401 || status === 403 || /invalid api key|api key not valid|unauthori[sz]ed|permission denied/.test(text)) {
    return { kind: "auth", status, message: "The provider rejected the API key." };
  }
  if (status === 402 || /insufficient balance|payment|billing|quota|credits/.test(text)) {
    return { kind: "quota", status, message: "The provider account is out of quota or credits." };
  }
  if (status === 400 || status === 404 || status === 413 || status === 422) {
    return { kind: "bad_request", status, message: "The provider could not process this request." };
  }
  return { kind: "unavailable", status, message: "The provider is unavailable right now." };
}

/** Final message when every provider in the chain failed (E9: say what to do). */
export function allFailedMessage(errors: ClassifiedError[]): string {
  if (errors.length === 0) {
    return "No AI provider is configured on the server. Add at least one API key (see README) and restart.";
  }
  if (errors.every((e) => e.kind === "rate_limit")) {
    const wait = Math.max(...errors.map((e) => e.retryAfter ?? 0));
    return `All AI providers are rate-limited right now. Please wait ${wait > 0 ? `about ${wait} seconds` : "a minute"} and send your message again.`;
  }
  if (errors.some((e) => e.kind === "rate_limit")) {
    return "The AI providers are busy or rate-limited. Please wait a minute and try again, or pick a different model from the dropdown.";
  }
  if (errors.every((e) => e.kind === "auth" || e.kind === "quota")) {
    return "The AI providers rejected the server's API keys or have no remaining quota. Please contact the app administrator.";
  }
  return "The AI providers are unavailable right now. Please try again in a moment or pick a different model.";
}
