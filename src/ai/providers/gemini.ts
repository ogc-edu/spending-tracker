/**
 * Plan 012 — GeminiProvider stub (real network implementation in plan 013).
 *
 * Satisfies the AIProvider capability interface so the factory/registry and
 * active-provider switching compile and run now; every capability throws a
 * typed, clear error until 013 wires the API (key read from SecureStore, sent
 * via `x-goog-api-key` — AI-6/AI-11).
 */
import type { AIAnalyzeRequest, AIProvider } from '../types';
import { AIUnavailableError } from '../errors';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;

  private notImplemented(): never {
    throw new AIUnavailableError(
      'unknown',
      'Gemini provider is not implemented yet (plan 013)',
    );
  }

  testConnection(_key: string): Promise<void> {
    return this.notImplemented();
  }

  listModels(_key: string): Promise<string[]> {
    return this.notImplemented();
  }

  analyze(_request: AIAnalyzeRequest): Promise<string> {
    return this.notImplemented();
  }
}

export function createGeminiProvider(): AIProvider {
  return new GeminiProvider();
}
