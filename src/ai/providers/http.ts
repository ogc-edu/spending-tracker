/**
 * Plan 013 — shared provider HTTP layer (raw REST, no SDKs — plan §Technical
 * Design). Providers use `requestJson` instead of calling fetch directly so
 * every failure is classified ONCE into the plan's typed shapes:
 *
 *  - testConnection surfaces a `TestResult` (invalidKey / quota /
 *    modelUnavailable / network / unknown — plan §Requirements, AI-7);
 *  - listModels / analyze throw `AIUnavailableError`s built from the 012
 *    errors.ts helpers (AI-4 taxonomy).
 *
 * `requestJson` never returns raw credentials and never includes them in
 * errors — headers are the caller's job. Timeouts are enforced with
 * AbortController so a hung request cannot block the Settings UI forever.
 */
import type { TestResult } from '../types';

/** Injectable fetch impl (defaults to the platform fetch; tests inject a mock). */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** Provider responded with a non-2xx status. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message?: string) {
    super(message ?? `Provider request failed (HTTP ${status})`);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** The request was aborted by our timeout. */
export class TimeoutError extends Error {
  constructor() {
    super('Provider request timed out');
    this.name = 'TimeoutError';
  }
}

/** Transport-level failure (DNS, refused, aborted connection, offline…). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super(cause instanceof Error ? cause.message : 'Network request failed');
    this.name = 'NetworkError';
  }
}

/**
 * Perform one provider REST call. Resolves with the parsed JSON body (or null
 * for an empty body), throws HttpError / TimeoutError / NetworkError on any
 * failure. `init.body` must already be a JSON string.
 */
export async function requestJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      // AbortError (native or RN) means OUR timer fired — a timeout.
      if (controller.signal.aborted) throw new TimeoutError();
      throw new NetworkError(err);
    }
    const text = await res.text();
    let body: unknown = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text; // non-JSON error bodies are still surfaced via status
      }
    }
    if (!res.ok) {
      throw new HttpError(res.status, `Provider request failed (HTTP ${res.status})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Plan §Requirements test mapping: 401/403 → invalidKey; 429 → quota; 404 → modelUnavailable; network → network. */
export function testResultFromStatus(status: number): TestResult {
  if (status === 401 || status === 403) return { ok: false, reason: 'invalidKey' };
  if (status === 429) return { ok: false, reason: 'quota' };
  if (status === 404) return { ok: false, reason: 'modelUnavailable' };
  return { ok: false, reason: 'unknown' };
}

/**
 * Classify any requestJson failure into a TestResult reason. A timeout counts
 * as a network problem for the test button (the TestResult vocabulary has no
 * timeout slot; the user sees the same "can't reach the provider" guidance).
 */
export function testResultFromError(err: unknown): TestResult {
  if (err instanceof HttpError) return testResultFromStatus(err.status);
  if (err instanceof TimeoutError || err instanceof NetworkError) {
    return { ok: false, reason: 'network' };
  }
  return { ok: false, reason: 'unknown' };
}

/**
 * Tolerant JSON extraction (plan §Edge cases — DeepSeek prompt-embedded mode):
 * find the first balanced `{...}` block in arbitrary model text. Braces inside
 * quoted strings are respected so a summary containing `{` cannot break the
 * scan. Returns null when no complete block exists.
 */
export function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Strip a markdown code fence (```json … ```) if the model wrapped the JSON. */
export function stripFence(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

/**
 * Tolerant JSON parse for model output: strip fences, extract the first
 * balanced block, JSON.parse it. Returns null when nothing usable exists — the
 * caller maps that to `invalidResponse` so the facade's Zod boundary is still
 * the single validation path (012 contract).
 */
export function parseModelJson(text: string): unknown {
  const block = extractJson(stripFence(text));
  if (block == null) return null;
  try {
    return JSON.parse(block);
  } catch {
    return null;
  }
}