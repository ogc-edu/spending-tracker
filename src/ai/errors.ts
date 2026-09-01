/**
 * Plan 012 — typed AI error taxonomy (PRD AI-4).
 *
 * Every AI failure surfaces as AIUnavailableError with a `reason` the UI can
 * map to a clear inline message + Retry, without sniffing message text.
 * The mapping helpers centralize how raw failures (network / timeout / HTTP
 * status / parse) become a typed error; real providers (013) use them.
 */
import type { AIErrorReason } from './types';

/** UI-able AI failure. `status` is set only for `reason === 'http'`/`invalidKey`. */
export class AIUnavailableError extends Error {
  readonly reason: AIErrorReason;
  readonly status?: number;

  constructor(reason: AIErrorReason, message?: string, status?: number) {
    super(message ?? `AI unavailable (${reason})`);
    this.name = 'AIUnavailableError';
    this.reason = reason;
    this.status = status;
  }
}

/** Transport/connectivity failure → offline. */
export function fromNetworkError(cause: unknown): AIUnavailableError {
  const msg = cause instanceof Error ? cause.message : 'Network unavailable';
  return new AIUnavailableError('offline', msg);
}

/** Request timed out → timeout. */
export function fromTimeoutError(cause?: unknown): AIUnavailableError {
  const msg = cause instanceof Error ? cause.message : 'Request timed out';
  return new AIUnavailableError('timeout', msg);
}

/**
 * Map an HTTP status to a typed reason (AI-7):
 * 401/403 → invalidKey; anything else (429/5xx) → http.
 */
export function fromHttpStatus(status: number): AIUnavailableError {
  if (status === 401 || status === 403) {
    return new AIUnavailableError(
      'invalidKey',
      `Provider rejected the API key (HTTP ${status})`,
      status,
    );
  }
  return new AIUnavailableError(
    'http',
    `Provider request failed (HTTP ${status})`,
    status,
  );
}

/** Provider output could not be parsed or validated → invalidResponse. */
export function fromInvalidResponse(message?: string): AIUnavailableError {
  return new AIUnavailableError(
    'invalidResponse',
    message ?? 'AI response was invalid',
  );
}

/** Catch-all for anything unexpected → unknown. */
export function fromUnknown(cause: unknown): AIUnavailableError {
  const msg = cause instanceof Error ? cause.message : String(cause);
  return new AIUnavailableError('unknown', msg);
}

/**
 * Map an arbitrary thrown value to a typed error, passing an already-typed
 * AIUnavailableError through unchanged (e.g. a FakeProvider failure mode).
 */
export function toAIError(cause: unknown): AIUnavailableError {
  if (cause instanceof AIUnavailableError) return cause;
  return fromUnknown(cause);
}
