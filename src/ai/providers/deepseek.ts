/**
 * Plan 012 — DeepSeekProvider stub (real network implementation in plan 013).
 *
 * OpenAI-compatible `chat/completions` + `GET /models` at api.deepseek.com
 * (ARCH §9). Satisfies the capability interface now; capabilities throw a
 * typed, clear error until 013 wires the API (key from SecureStore, sent via
 * `Authorization: Bearer` — AI-6).
 */
import type { AIAnalyzeRequest, AIProvider } from '../types';
import { AIUnavailableError } from '../errors';

export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek' as const;

  private notImplemented(): never {
    throw new AIUnavailableError(
      'unknown',
      'DeepSeek provider is not implemented yet (plan 013)',
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

export function createDeepseekProvider(): AIProvider {
  return new DeepSeekProvider();
}
