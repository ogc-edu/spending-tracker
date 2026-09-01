/**
 * Plan 012 — AIService facade (PRD AI-1, ARCH §9).
 *
 * The single entry point for every AI action. It exposes provider-configuration
 * capabilities (testConnection / listModels / active-provider get/set) and
 * `analyze(context, snapshot)`, which dispatches to the ACTIVE provider.
 *
 * Hygiene enforced here (plan §Requirements):
 *  - snapshots are validated against their per-context schema (Zod boundary);
 *  - the prompt comes from a FIXED per-context registry — no user free text
 *    ever reaches a prompt in the MVP contexts;
 *  - provider output is parsed + Zod-validated before anything is returned,
 *    so malformed output becomes an `invalidResponse` error, never a crash;
 *  - provider failures are mapped to typed AIUnavailableError reasons.
 */
import { AIResultSchema, getSnapshotSchema } from './schema';
import {
  AIUnavailableError,
  fromInvalidResponse,
  toAIError,
} from './errors';
import { FakeProvider } from './providers/fake';
import { createGeminiProvider } from './providers/gemini';
import { createDeepseekProvider } from './providers/deepseek';
import type {
  AIContext,
  AIContextSnapshotMap,
  AIProvider,
  AIProviderName,
  AIResult,
} from './types';

/** Fixed system instructions per context — never interpolates user input. */
export const SYSTEM_PROMPTS: Record<AIContext, string> = {
  debt:
    'You analyze pre-computed financial data about the user\'s commitments ' +
    '(debt). Never recalculate or invent numbers; reference only the supplied ' +
    'snapshot values. Answer in plain, helpful language. Output JSON in exactly ' +
    'this shape: {"summary": string, "points": string[]}.',
  spending:
    'You analyze pre-computed financial data about the user\'s spending for a ' +
    'given month. Never recalculate or invent numbers; reference only the ' +
    'supplied snapshot values. Answer in plain, helpful language. Output JSON ' +
    'in exactly this shape: {"summary": string, "points": string[]}.',
  allowance:
    'You analyze pre-computed financial data about the user\'s allowance for ' +
    'the current month. Never recalculate or invent numbers; reference only ' +
    'the supplied snapshot values. Answer in plain, helpful language. Output ' +
    'JSON in exactly this shape: {"summary": string, "points": string[]}.',
};

const KNOWN_PROVIDERS: readonly AIProviderName[] = [
  'fake',
  'gemini',
  'deepseek',
];

function isKnownProvider(name: string): name is AIProviderName {
  return (KNOWN_PROVIDERS as readonly string[]).includes(name);
}

/** Optional provider overrides — the dependency-injection point for tests. */
export type AIProviderRegistry = Partial<Record<AIProviderName, AIProvider>>;

export interface AIService {
  /** The provider analyze() dispatches to (AI-9). */
  readonly activeProvider: AIProviderName;
  setActiveProvider(provider: AIProviderName): void;
  /** Minimal auth/connectivity check against a named provider (AI-7). */
  testConnection(provider: AIProviderName, key: string): Promise<void>;
  /** Discovered text-generation models for a named provider (AI-8). */
  listModels(provider: AIProviderName, key: string): Promise<string[]>;
  /** Dispatch an analysis to the active provider, returning a validated AIResult. */
  analyze<C extends AIContext>(
    context: C,
    snapshot: AIContextSnapshotMap[C],
  ): Promise<AIResult>;
}

/**
 * Build an AIService configured with `providerName` as its active provider.
 * Defaults to `fake` (the only real provider in plan 012; 013 adds Gemini/
 * DeepSeek). Unknown names throw a typed error (future-proofing).
 */
export function createAIService(
  providerName: AIProviderName = 'fake',
  overrides: AIProviderRegistry = {},
): AIService {
  if (!isKnownProvider(providerName)) {
    throw new AIUnavailableError('unknown', `Unknown AI provider: ${providerName}`);
  }

  const providers: Record<AIProviderName, AIProvider> = {
    fake: overrides.fake ?? new FakeProvider(),
    gemini: overrides.gemini ?? createGeminiProvider(),
    deepseek: overrides.deepseek ?? createDeepseekProvider(),
  };

  let active: AIProviderName = providerName;

  return {
    get activeProvider() {
      return active;
    },

    setActiveProvider(provider: AIProviderName) {
      if (!isKnownProvider(provider)) {
        throw new AIUnavailableError('unknown', `Unknown AI provider: ${provider}`);
      }
      active = provider;
    },

    async testConnection(provider: AIProviderName, key: string): Promise<void> {
      await providers[provider].testConnection(key);
    },

    async listModels(provider: AIProviderName, key: string): Promise<string[]> {
      return providers[provider].listModels(key);
    },

    async analyze<C extends AIContext>(
      context: C,
      snapshot: AIContextSnapshotMap[C],
    ): Promise<AIResult> {
      const parsedSnapshot = getSnapshotSchema(context).safeParse(snapshot);
      if (!parsedSnapshot.success) {
        throw new TypeError(`Invalid ${context} snapshot passed to analyze()`);
      }

      let raw: string;
      try {
        raw = await providers[active].analyze({
          context,
          systemPrompt: SYSTEM_PROMPTS[context],
          snapshot: JSON.stringify(snapshot),
        });
      } catch (err) {
        throw toAIError(err);
      }
      return parseAndValidateResult(raw);
    },
  };
}

/** Parse + Zod-validate the provider's raw response (invalidResponse on failure). */
function parseAndValidateResult(raw: string): AIResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw fromInvalidResponse('AI response was not valid JSON');
  }
  const result = AIResultSchema.safeParse(parsed);
  if (!result.success) {
    throw fromInvalidResponse('AI response did not match the expected shape');
  }
  return result.data as AIResult;
}
