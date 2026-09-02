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
  ModelInfo,
  TestOptions,
  TestResult,
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

/**
 * Plan 013 — config-layer resolvers (AIService stays storage-free; the app
 * wires these to AiConfigService). Each returns null when unset:
 *  - getActiveProvider: the PERSISTED active provider (settings table). When
 *    absent (or the resolver returns null) analyze falls back to the
 *    in-memory selection from `createAIService(name)` / setActiveProvider —
 *    preserving the 012 behavior for tests that wire no config layer.
 *  - getKey / getModelId: resolved per provider at analyze time. `fake` skips
 *    both; real providers reject an absent key (invalidKey) or model
 *    (modelUnavailable) with typed errors.
 */
export interface AIServiceOptions {
  getActiveProvider?(): AIProviderName | null | Promise<AIProviderName | null>;
  getKey?(provider: AIProviderName): string | null | Promise<string | null>;
  getModelId?(provider: AIProviderName): string | null | Promise<string | null>;
}

export interface AIService {
  /** The in-memory default analyze() dispatches to when no config resolver is wired. */
  readonly activeProvider: AIProviderName;
  setActiveProvider(provider: AIProviderName): void;
  /** The ACTIVE provider including the persisted config choice (null = none configured). */
  getActiveProvider(): Promise<AIProviderName | null>;
  /** Minimal auth/connectivity check against a named provider (AI-7). */
  testConnection(
    provider: AIProviderName,
    key: string,
    options?: TestOptions,
  ): Promise<TestResult>;
  /** Discovered text-generation models for a named provider (AI-8). */
  listModels(provider: AIProviderName, key: string): Promise<ModelInfo[]>;
  /** Dispatch an analysis to the active provider, returning a validated AIResult. */
  analyze<C extends AIContext>(
    context: C,
    snapshot: AIContextSnapshotMap[C],
  ): Promise<AIResult>;
}

/**
 * Build an AIService configured with `providerName` as its in-memory active
 * provider. Defaults to `fake` (plan 012; 013 wires real providers via the
 * config resolvers). Unknown names throw a typed error (future-proofing).
 */
export function createAIService(
  providerName: AIProviderName = 'fake',
  overrides: AIProviderRegistry = {},
  options: AIServiceOptions = {},
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

  /** Resolve the dispatch target: persisted config first, in-memory as fallback. */
  async function resolveActive(): Promise<AIProviderName> {
    if (options.getActiveProvider) {
      const configured = await options.getActiveProvider();
      if (configured !== null) return configured;
      // A config layer is wired but nothing is configured → no provider.
      throw new AIUnavailableError('unknown', 'No AI provider configured');
    }
    return active;
  }

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

    async getActiveProvider(): Promise<AIProviderName | null> {
      if (options.getActiveProvider) return options.getActiveProvider();
      return active;
    },

    async testConnection(
      provider: AIProviderName,
      key: string,
      options?: TestOptions,
    ): Promise<TestResult> {
      return providers[provider].testConnection(key, options);
    },

    async listModels(provider: AIProviderName, key: string): Promise<ModelInfo[]> {
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

      const target = await resolveActive();
      const provider = providers[target];

      // Credentials and model selection come from the config layer (BYOK,
      // plan 013): SecureStore key + settings-table model. The fake provider
      // needs neither, so only real providers resolve them.
      let key = '';
      let modelId: string | undefined;
      if (target !== 'fake') {
        const resolvedKey = (await options.getKey?.(target)) ?? '';
        if (!resolvedKey) {
          throw new AIUnavailableError(
            'invalidKey',
            'No API key configured for this provider — add one in Settings',
          );
        }
        key = resolvedKey;
        const resolvedModel = (await options.getModelId?.(target)) ?? '';
        if (!resolvedModel) {
          throw new AIUnavailableError(
            'modelUnavailable',
            'No model selected for this provider — pick one in Settings',
          );
        }
        modelId = resolvedModel;
      }

      let raw: string;
      try {
        raw = await provider.analyze({
          context,
          systemPrompt: SYSTEM_PROMPTS[context],
          snapshot: JSON.stringify(snapshot),
          key,
          modelId,
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
