/**
 * Plan 013 — AiConfigService (BYOK configuration, PRD AI-6/AI-9/SET-2).
 *
 * The ONLY owner of provider credentials in the app:
 *  - Keys live in SecureStore scoped per local user — `key:{provider}:{userId}`
 *    (A10 per-user isolation) — NEVER SQLite/Zustand/AsyncStorage, never
 *    logged, committed, or included in errors.
 *  - Non-secret prefs (selected model per provider, active-provider choice)
 *    persist in the `settings` table (plan 010), never in SecureStore.
 *
 * Active-provider rule (plan §Requirements): the active provider is
 * selectable among CONFIGURED providers only — no automatic fallback.
 * Removing the active provider's key clears `ai_active_provider` so the app
 * shows "No AI provider configured" instead of silently switching.
 *
 * The app wires AIService's config resolvers to this service via
 * `aiServiceOptions()` — the facade itself stays storage-free (012 contract).
 */
import type { AIProviderName } from '@/ai/types';
import type { AiPrefs, SettingsRepository } from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';
import type { AIServiceOptions } from '@/ai/AIService';

/** The BYOK providers the user can configure (fake is a test double, never user-facing). */
export const AI_PROVIDERS = ['gemini', 'deepseek'] as const;
export type ConfigurableAIProvider = (typeof AI_PROVIDERS)[number];

/** SecureStore surface the service needs (injectable mock in Jest). */
export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** SecureStore key for one user's provider credential. */
export function aiKeyStoreKey(provider: ConfigurableAIProvider, userId: number): string {
  return `key:${provider}:${userId}`;
}

/** The settings-row field holding a provider's selected model (non-secret). */
function modelPrefField(provider: ConfigurableAIProvider): keyof AiPrefs {
  return provider === 'gemini' ? 'aiModelGemini' : 'aiModelDeepseek';
}

/**
 * Device key store via expo-secure-store. Lazy-requires the module so
 * Node/Jest (which lacks the native module) can import this file — same
 * pattern as SecureStoreSessionStore (plan 003).
 */
class SecureStoreKeyStore implements SecureStoreLike {
  private getSecureStore(): SecureStoreLike {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store') as SecureStoreLike;
  }

  async getItemAsync(key: string): Promise<string | null> {
    return this.getSecureStore().getItemAsync(key);
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    await this.getSecureStore().setItemAsync(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    await this.getSecureStore().deleteItemAsync(key);
  }
}

export class AiConfigService {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly auth: CurrentUserSource,
    private readonly keys: SecureStoreLike = new SecureStoreKeyStore(),
  ) {}

  /** The signed-in user's id, or null when signed out (getters then read as unconfigured). */
  private async userId(): Promise<number | null> {
    const user = await this.auth.currentUser();
    return user ? user.id : null;
  }

  private requireProvider(provider: AIProviderName): ConfigurableAIProvider {
    if (provider !== 'gemini' && provider !== 'deepseek') {
      throw new Error(`not a BYOK provider: ${provider}`);
    }
    return provider;
  }

  /** The stored key for a provider, or null (signed out / never configured). */
  async getKey(provider: AIProviderName): Promise<string | null> {
    const id = await this.userId();
    if (id == null) return null;
    return this.keys.getItemAsync(aiKeyStoreKey(this.requireProvider(provider), id));
  }

  /** Persist a new key (add or replace — keys are single per user per provider). */
  async setKey(provider: AIProviderName, key: string): Promise<void> {
    const id = await this.userId();
    if (id == null) throw new Error('not signed in');
    if (!key) throw new Error('API key is required');
    const p = this.requireProvider(provider);
    await this.keys.setItemAsync(aiKeyStoreKey(p, id), key);
  }

  /**
   * Remove a provider's key. If it was the ACTIVE provider, clears
   * `ai_active_provider` too — never a silent switch to another provider.
   */
  async removeKey(provider: AIProviderName): Promise<void> {
    const id = await this.userId();
    if (id == null) return;
    const p = this.requireProvider(provider);
    await this.keys.deleteItemAsync(aiKeyStoreKey(p, id));
    const active = await this.settings.aiPrefs(id).then((prefs) => prefs.aiActiveProvider);
    if (active === p) {
      await this.settings.setAiPrefs(id, { aiActiveProvider: null });
    }
  }

  /** The user's selected model id for a provider, or null (never the key!). */
  async getModelId(provider: AIProviderName): Promise<string | null> {
    const id = await this.userId();
    if (id == null) return null;
    const prefs = await this.settings.aiPrefs(id);
    return prefs[modelPrefField(this.requireProvider(provider))] ?? null;
  }

  /** Persist the selected model for a provider (non-secret settings pref). */
  async setModelId(provider: AIProviderName, modelId: string | null): Promise<void> {
    const id = await this.userId();
    if (id == null) throw new Error('not signed in');
    const p = this.requireProvider(provider);
    await this.settings.setAiPrefs(id, { [modelPrefField(p)]: modelId } as Partial<AiPrefs>);
  }

  /** The persisted active provider, or null ("No AI provider configured"). */
  async getActiveProvider(): Promise<AIProviderName | null> {
    const id = await this.userId();
    if (id == null) return null;
    return (await this.settings.aiPrefs(id)).aiActiveProvider;
  }

  /** Persist the active-provider choice (null = clear; UI only offers CONFIGURED providers). */
  async setActiveProvider(provider: AIProviderName | null): Promise<void> {
    const id = await this.userId();
    if (id == null) throw new Error('not signed in');
    const active: ConfigurableAIProvider | null =
      provider === null ? null : this.requireProvider(provider);
    await this.settings.setAiPrefs(id, { aiActiveProvider: active });
  }

  /** Providers that currently have a stored key — the active-selector options. */
  async configuredProviders(): Promise<ConfigurableAIProvider[]> {
    const configured: ConfigurableAIProvider[] = [];
    for (const provider of AI_PROVIDERS) {
      if ((await this.getKey(provider)) !== null) configured.push(provider);
    }
    return configured;
  }
}

/**
 * Wire an AiConfigService into AIService as its config resolvers (plan 013 —
 * "the app wires these to AiConfigService"; AIService stays storage-free).
 * `fake` is never a config-layer provider — the facade skips getKey/getModelId
 * for it, and these wrappers return null defensively.
 */
export function aiServiceOptions(config: AiConfigService): AIServiceOptions {
  return {
    getActiveProvider: () => config.getActiveProvider(),
    getKey: (provider) => (provider === 'fake' ? null : config.getKey(provider)),
    getModelId: (provider) => (provider === 'fake' ? null : config.getModelId(provider)),
  };
}