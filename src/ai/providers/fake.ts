/**
 * Plan 012 — FakeProvider: deterministic test double for the AIProvider
 * capability interface (PRD AI-5). Canned success plus every failure mode,
 * so provider config (013) and the analysis UIs (013-015) are testable in
 * Jest without any network.
 */
import type {
  AIAnalyzeRequest,
  AIErrorReason,
  AIProvider,
  ModelInfo,
  TestOptions,
  TestResult,
} from '../types';
import { RequestCancelledError } from './http';
import { AIUnavailableError } from '../errors';

/** Canned outcome configuration. Success is the default. */
export type FakeFailure =
  | { kind: 'success' }
  | { kind: 'fail'; reason: AIErrorReason }
  | { kind: 'invalid-json' } // response is not JSON
  | { kind: 'invalid-shape' }; // JSON but wrong shape (facade should reject)

/** Map a 012 AIErrorReason onto the plan 013 TestResult vocabulary for testConnection. */
export function fakeTestResult(reason: AIErrorReason): TestResult {
  switch (reason) {
    case 'invalidKey':
      return { ok: false, reason: 'invalidKey' };
    case 'offline':
    case 'timeout':
      return { ok: false, reason: 'network' };
    default:
      return { ok: false, reason: 'unknown' };
  }
}

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

  async testConnection(_key: string, options?: TestOptions): Promise<TestResult> {
    options?.onStep?.({ phase: 'discovering' });
    options?.onStep?.({ phase: 'testing', modelId: 'fake-text-model' });
    const result: TestResult =
      this.failure.kind === 'fail' ? fakeTestResult(this.failure.reason) : { ok: true };
    if (!options?.signal) return result;
    if (options.signal.aborted) throw new RequestCancelledError();
    // Reject if the caller aborts after this double resolved — a Stop pressed
    // between dispatch and resolution still surfaces as cancellation.
    return new Promise<TestResult>((resolve, reject) => {
      options.signal!.addEventListener(
        'abort',
        () => reject(new RequestCancelledError()),
        { once: true },
      );
      resolve(result);
    });
  }

  async listModels(_key: string): Promise<ModelInfo[]> {
    if (this.failure.kind === 'fail') this.throwFail();
    return [{ id: 'fake-text-model' }];
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
