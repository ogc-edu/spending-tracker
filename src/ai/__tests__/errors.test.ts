/**
 * Plan 012 — error taxonomy + mapping tests (PRD AI-4).
 * network error -> offline; timeout -> timeout; 401/403 -> invalidKey;
 * 429/5xx -> http; garbage/unparseable -> invalidResponse; catch-all -> unknown;
 * already-typed errors pass through toAIError unchanged.
 */
import { describe, expect, it } from '@jest/globals';
import {
  AIUnavailableError,
  fromHttpStatus,
  fromInvalidResponse,
  fromNetworkError,
  fromTimeoutError,
  fromUnknown,
  toAIError,
} from '../errors';
import type { AIErrorReason } from '../types';

describe('AIUnavailableError', () => {
  it('carries the reason and a UI-able message', () => {
    const err = new AIUnavailableError('offline');
    expect(err.reason).toBe('offline');
    expect(err.message).toContain('offline');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AIUnavailableError');
  });
});

describe('error mapping helpers', () => {
  it('maps a network error to offline', () => {
    expect(fromNetworkError(new Error('Network request failed')).reason).toBe('offline');
  });

  it('maps a timeout to timeout', () => {
    expect(fromTimeoutError(new Error('timed out')).reason).toBe('timeout');
    expect(fromTimeoutError().reason).toBe('timeout');
  });

  it.each([401, 403])('maps HTTP %i to invalidKey (no raw credential leaked)', (status) => {
    const err = fromHttpStatus(status);
    expect(err.reason).toBe('invalidKey');
    expect(err.status).toBe(status);
    expect(err.message).not.toContain('secret');
  });

  it.each([429, 500, 502, 503])('maps HTTP %i to http', (status) => {
    const err = fromHttpStatus(status);
    expect(err.reason).toBe('http');
    expect(err.status).toBe(status);
  });

  it('maps unparseable provider output to invalidResponse', () => {
    expect(fromInvalidResponse('not json').reason).toBe('invalidResponse');
    expect(fromInvalidResponse().reason).toBe('invalidResponse');
  });

  it('maps anything unexpected to unknown', () => {
    expect(fromUnknown(new Error('boom')).reason).toBe('unknown');
    expect(fromUnknown('boom').reason).toBe('unknown');
  });
});

describe('toAIError', () => {
  it('passes an already-typed AIUnavailableError through unchanged', () => {
    const typed = new AIUnavailableError('timeout');
    expect(toAIError(typed)).toBe(typed);
    expect(toAIError(typed).reason).toBe('timeout');
  });

  it('wraps a raw unexpected error as unknown', () => {
    const mapped = toAIError('something weird');
    expect(mapped).toBeInstanceOf(AIUnavailableError);
    expect((mapped as AIUnavailableError).reason as AIErrorReason).toBe('unknown');
  });
});