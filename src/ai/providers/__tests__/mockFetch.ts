/**
 * Plan 013 — scripted fetch for provider tests.
 *
 * `requestJson` only touches `res.ok`, `res.status` and `res.text()`, so a
 * plain object stands in for the platform Response — no jsdom needed. Each
 * call consumes the next script step; an Error step simulates a transport
 * failure (network), everything else is an HTTP response whose body is the
 * step's JSON (or raw text).
 */
import type { FetchLike } from '../http';

export interface MockCall {
  url: string;
  init?: RequestInit;
}

export type MockStep =
  | { status?: number; json?: unknown; text?: string }
  | Error;

export interface MockedFetch {
  fetchImpl: FetchLike;
  calls: MockCall[];
}

/** Last script step repeats for any extra calls (convenient for 1-step tests). */
export function mockFetch(...script: MockStep[]): MockedFetch {
  const calls: MockCall[] = [];
  let index = 0;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const step = script[Math.min(index, script.length - 1)] ?? { json: null };
    index += 1;
    if (step instanceof Error) throw step;
    const status = step.status ?? 200;
    const text =
      step.text !== undefined
        ? step.text
        : JSON.stringify(step.json ?? null);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response;
  };
  return { fetchImpl, calls };
}

/** Parse a recorded POST body back to an object (bodies travel as JSON strings). */
export function bodyOf(call: MockCall): unknown {
  return JSON.parse(call.init?.body as string);
}