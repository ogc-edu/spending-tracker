/**
 * Plan 013 — shared provider HTTP layer tests: status → TestResult mapping,
 * tolerant JSON extraction (DeepSeek prompt-embedded mode), and requestJson
 * classification (parsed bodies, HTTP errors, network, timeout).
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  NetworkError,
  RequestCancelledError,
  TimeoutError,
  extractJson,
  parseModelJson,
  requestJson,
  stripFence,
  testResultFromStatus,
} from '../http';
import { mockFetch } from './mockFetch';

describe('testResultFromStatus (plan §Requirements mapping)', () => {
  it('maps 401/403 → invalidKey, 429 → quota, 404 → modelUnavailable, others → unknown', () => {
    expect(testResultFromStatus(401)).toEqual({ ok: false, reason: 'invalidKey' });
    expect(testResultFromStatus(403)).toEqual({ ok: false, reason: 'invalidKey' });
    expect(testResultFromStatus(429)).toEqual({ ok: false, reason: 'quota' });
    expect(testResultFromStatus(404)).toEqual({ ok: false, reason: 'modelUnavailable' });
    expect(testResultFromStatus(500)).toEqual({ ok: false, reason: 'unknown' });
    expect(testResultFromStatus(418)).toEqual({ ok: false, reason: 'unknown' });
  });
});

describe('extractJson — tolerant first-block extraction', () => {
  it('returns the first balanced {...} block', () => {
    expect(extractJson('prefix {"a":1,"b":[2]} suffix')).toBe('{"a":1,"b":[2]}');
  });

  it('ignores braces inside quoted strings (nested objects survive)', () => {
    const text = '{"summary":"looks like {this}","points":[]} trailing';
    expect(extractJson(text)).toBe('{"summary":"looks like {this}","points":[]}');
  });

  it('respects escaped quotes inside strings', () => {
    const text = '{"a":"escaped \\" brace {"} more';
    expect(extractJson(text)).toBe('{"a":"escaped \\" brace {"}');
  });

  it('returns null for unbalanced or missing braces', () => {
    expect(extractJson('no braces here')).toBeNull();
    expect(extractJson('{"a": 1')).toBeNull();
    // Balanced-block semantics: scanning starts at the FIRST `{` (a stray
    // leading brace is included), and an outer-incomplete block is null.
    expect(extractJson('{ {"nested": true} ')).toBeNull();
    expect(extractJson('{ {"nested": true} }')).toBe('{ {"nested": true} }');
  });
});

describe('stripFence', () => {
  it('removes a ```json code fence around the whole payload', () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves non-fenced text untouched', () => {
    expect(stripFence('Here: {"a":1}')).toBe('Here: {"a":1}');
  });
});

describe('parseModelJson', () => {
  it('parses a fenced JSON block', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('returns null when nothing parseable exists', () => {
    expect(parseModelJson('no json here')).toBeNull();
    expect(parseModelJson('{"a": ')).toBeNull();
  });
});

describe('requestJson', () => {
  it('parses a JSON response body', async () => {
    const { fetchImpl, calls } = mockFetch({ json: { ok: true } });
    const body = await requestJson(fetchImpl, 'https://example.test/x', {}, 5_000);
    expect(body).toEqual({ ok: true });
    expect(calls[0]?.url).toBe('https://example.test/x');
  });

  it('resolves null for an empty body', async () => {
    const { fetchImpl } = mockFetch({ status: 204, text: '' });
    await expect(requestJson(fetchImpl, 'https://example.test/x', {}, 5_000)).resolves.toBeNull();
  });

  it('throws HttpError with the status for non-2xx (even a JSON error body)', async () => {
    const { fetchImpl } = mockFetch({ status: 429, json: { error: { message: 'rate limited' } } });
    await expect(requestJson(fetchImpl, 'https://example.test/x', {}, 5_000)).rejects.toMatchObject({
      name: 'HttpError',
      status: 429,
    });
  });

  it('throws NetworkError for a transport failure', async () => {
    const { fetchImpl } = mockFetch(new TypeError('Network request failed'));
    await expect(requestJson(fetchImpl, 'https://example.test/x', {}, 5_000)).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it('throws TimeoutError when the abort timer fires first', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl: Parameters<typeof requestJson>[0] = (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      const pending = requestJson(fetchImpl, 'https://example.test/x', {}, 1_000).catch((e) => e);
      jest.advanceTimersByTime(1_001);
      const err = await pending;
      expect(err).toBeInstanceOf(TimeoutError);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects with RequestCancelledError when the external signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetchImpl, calls } = mockFetch({ json: { ok: true } });
    await expect(
      requestJson(fetchImpl, 'https://example.test/x', {}, 5_000, controller.signal),
    ).rejects.toBeInstanceOf(RequestCancelledError);
    expect(calls).toHaveLength(0); // never reaches the network
  });

  it('rejects with RequestCancelledError (not TimeoutError) when the signal aborts mid-flight', async () => {
    const controller = new AbortController();
    const fetchImpl: Parameters<typeof requestJson>[0] = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    const pending = requestJson(
      fetchImpl,
      'https://example.test/x',
      {},
      60_000,
      controller.signal,
    ).catch((e) => e);
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    const err = await pending;
    expect(err).toBeInstanceOf(RequestCancelledError);
  });
});