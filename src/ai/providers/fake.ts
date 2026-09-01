/**
 * Plan 012 — FakeProvider: deterministic test double for the AIProvider
 * capability interface (PRD AI-5). Canned success plus every failure mode,
 * so provider config (013) and the analysis UIs (013-015) are testable in
 * Jest without any network.
 */
import type { AIAnalyzeRequest, AIErrorReason, AIProvider } from '../types';
import { AIUnavailableError } from '../errors';

/** Canned outcome configuration. Success is the default. */
export type FakeFailure =
  | { kind: 'success' }
  | { kind: 'fail'; reason: AIErrorReason }
  | { kind: 'invalid-json' } // response is not JSON
  | { kind: 'invalid-shape' }; // JSON but wrong shape (facade should reject)

export interface FakeResult {
  summary: string;
  points: string[];
}

export class FakeProvider implements AIProvider {
  readonly name = 'fake' as const;

  private failure: FakeFailure = { kind: 'success' };
  private success: FakeResult = {
    summary: 'Fake analysis summary.',
    points: ['Fake point one.'],
  };

  /** The last analyze request this provider received (for assertions). */
  lastRequest?: AIAnalyzeRequest;

  /** Configure the canned outcome. Default: success. */
  setMode(mode: FakeFailure): void {
    this.failure = mode;
  }

  /** Override the canned success payload. */
  setResult(result: FakeResult): void {
    this.success = result;
  }

  private throwFail(): never {
    if (this.failure.kind !== 'fail') return undefined as never;
    throw new AIUnavailableError(this.failure.reason, 'FakeProvider failure');
  }

  async testConnection(_key: string): Promise<void> {
    if (this.failure.kind === 'fail') this.throwFail();
  }

  async listModels(_key: string): Promise<string[]> {
    if (this.failure.kind === 'fail') this.throwFail();
    return ['fake-text-model'];
  }

  async analyze(request: AIAnalyzeRequest): Promise<string> {
    this.lastRequest = request;
    if (this.failure.kind === 'fail') this.throwFail();
    if (this.failure.kind === 'invalid-json') return 'this is not json';
    if (this.failure.kind === 'invalid-shape') {
      // JSON, but missing `points` — the facade must reject it.
      return JSON.stringify({ summary: 'only a summary' });
    }
    return JSON.stringify(this.success);
  }
}
