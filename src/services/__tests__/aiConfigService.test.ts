/**
 * Plan 013 — AiConfigService: per-user SecureStore round-trips (keys NEVER in
 * the settings repo), settings-pref persistence for models + active provider,
 * active-provider clearing on key removal (no silent fallback), provider
 * validation, signed-out behavior, and the AIService wiring (aiServiceOptions).
 */
import { describe, expect, it } from '@jest/globals';
import { createAIService } from '@/ai/AIService';
import { FakeProvider } from '@/ai/providers/fake';
import { AiConfigService, aiKeyStoreKey, aiServiceOptions } from '@/services/AiConfigService';
import {
  InMemorySecureStore,
  InMemorySettingsRepository,
  debtSnapshot,
  makeAuth,
} from './aiTestDoubles';

function setup(userId = 1) {
  const store = new InMemorySecureStore();
  const repo = new InMemorySettingsRepository();
  const auth = makeAuth(userId);
  const config = new AiConfigService(repo, auth, store);
  return { store, repo, auth, config };
}

describe('AiConfigService — SecureStore keys (per-user, BYOK)', () => {
  it('round-trips a key under key:{provider}:{userId} and never touches the repo', async () => {
    const { store, repo, config } = setup();

    await config.setKey('gemini', 'AQ-1234');
    await config.setKey('deepseek', 'sk-ds-5678');

    expect(await config.getKey('gemini')).toBe('AQ-1234');
    expect(await config.getKey('deepseek')).toBe('sk-ds-5678');
    // Underscore separators only — expo-secure-store rejects ':' in key names.
    expect(store.map.get('key_gemini_1')).toBe('AQ-1234');
    expect(store.map.get('key_deepseek_1')).toBe('sk-ds-5678');
    // Settings repo saw ONLY ai-pref writes (active/model) — zero key material.
    for (const write of repo.writes) {
      expect(JSON.stringify(write.patch)).not.toMatch(/AQ-|sk-ds/);
    }
    expect(JSON.stringify([...store.map.keys()])).not.toContain('settings');
  });

  it('isolates keys between local users (A10)', async () => {
    const { store, config } = setup(1);
    const other = setup(2);

    await config.setKey('gemini', 'user-1-key');
    await other.config.setKey('gemini', 'user-2-key');

    expect(store.map.get(aiKeyStoreKey('gemini', 1))).toBe('user-1-key');
    expect(other.store.map.get(aiKeyStoreKey('gemini', 2))).toBe('user-2-key');
    expect(store.map.get(aiKeyStoreKey('gemini', 2))).toBeUndefined();
    expect(await config.getKey('gemini')).toBe('user-1-key');
    expect(await other.config.getKey('gemini')).toBe('user-2-key');
  });

  it('removeKey deletes the credential and replaces a previous key', async () => {
    const { config } = setup();
    await config.setKey('gemini', 'first');
    await config.setKey('gemini', 'second');
    expect(await config.getKey('gemini')).toBe('second');

    await config.removeKey('gemini');
    expect(await config.getKey('gemini')).toBeNull();
  });

  it('rejects an empty key and non-BYOK providers', async () => {
    const { config } = setup();
    await expect(config.setKey('gemini', '')).rejects.toThrow('API key is required');
    await expect(config.setKey('fake', 'x')).rejects.toThrow('not a BYOK provider');
    await expect(config.setKey('bogus' as never, 'x')).rejects.toThrow('not a BYOK provider');
    await expect(config.getKey('fake')).rejects.toThrow('not a BYOK provider');
  });
});

describe('AiConfigService — active provider + model prefs', () => {
  it('persists the active-provider choice and clears it via null', async () => {
    const { config } = setup();
    expect(await config.getActiveProvider()).toBeNull();

    await config.setActiveProvider('gemini');
    expect(await config.getActiveProvider()).toBe('gemini');

    await config.setActiveProvider(null);
    expect(await config.getActiveProvider()).toBeNull();
  });

  it('persists each provider model separately and clears with null', async () => {
    const { config } = setup();
    await config.setModelId('gemini', 'gemini-3.6-flash');
    await config.setModelId('deepseek', 'deepseek-v4-flash');

    expect(await config.getModelId('gemini')).toBe('gemini-3.6-flash');
    expect(await config.getModelId('deepseek')).toBe('deepseek-v4-flash');

    await config.setModelId('deepseek', null);
    expect(await config.getModelId('deepseek')).toBeNull();
    expect(await config.getModelId('gemini')).toBe('gemini-3.6-flash');
  });

  it('removing the ACTIVE provider key clears the active choice (never a silent switch)', async () => {
    const { config } = setup();
    await config.setKey('gemini', 'k1');
    await config.setKey('deepseek', 'k2');
    await config.setActiveProvider('gemini');

    await config.removeKey('gemini');
    expect(await config.getKey('gemini')).toBeNull();
    expect(await config.getActiveProvider()).toBeNull();
    expect(await config.getKey('deepseek')).toBe('k2'); // stays configured
  });

  it('removing a NON-active key leaves the active choice intact', async () => {
    const { config } = setup();
    await config.setKey('gemini', 'k1');
    await config.setKey('deepseek', 'k2');
    await config.setActiveProvider('gemini');

    await config.removeKey('deepseek');
    expect(await config.getActiveProvider()).toBe('gemini');
  });

  it('configuredProviders lists only providers with stored keys', async () => {
    const { config } = setup();
    expect(await config.configuredProviders()).toEqual([]);

    await config.setKey('deepseek', 'k2');
    expect(await config.configuredProviders()).toEqual(['deepseek']);

    await config.setKey('gemini', 'k1');
    // AI_PROVIDERS order (gemini, deepseek), filtered to keyed providers only.
    expect(await config.configuredProviders()).toEqual(['gemini', 'deepseek']);
  });
});

describe('AiConfigService — signed out', () => {
  it('getters read as unconfigured and setters reject', async () => {
    const store = new InMemorySecureStore();
    const repo = new InMemorySettingsRepository();
    const auth = makeAuth(null);
    const config = new AiConfigService(repo, auth, store);

    expect(await config.getKey('gemini')).toBeNull();
    expect(await config.getModelId('gemini')).toBeNull();
    expect(await config.getActiveProvider()).toBeNull();
    expect(await config.configuredProviders()).toEqual([]);

    await expect(config.setKey('gemini', 'k')).rejects.toThrow('not signed in');
    await expect(config.setModelId('gemini', 'm')).rejects.toThrow('not signed in');
    await expect(config.setActiveProvider('gemini')).rejects.toThrow('not signed in');
    // removeKey is safe (no-op).
    await expect(config.removeKey('gemini')).resolves.toBeUndefined();
  });
});

describe('aiServiceOptions — wiring AiConfigService into AIService (plan 013)', () => {
  it('analyze dispatches to the persisted active provider with its key + model', async () => {
    const { config } = setup();
    await config.setKey('gemini', 'sk-g');
    await config.setModelId('gemini', 'gemini-3.6-flash');
    await config.setActiveProvider('gemini');

    const fake = new FakeProvider();
    const svc = createAIService('fake', { gemini: fake }, aiServiceOptions(config));

    const result = await svc.analyze('debt', debtSnapshot);
    expect(result.summary).toBe('Fake analysis summary.');
    expect(fake.lastRequest?.key).toBe('sk-g');
    expect(fake.lastRequest?.modelId).toBe('gemini-3.6-flash');
  });

  it('analyze fails typed when nothing is configured (no fallback)', async () => {
    const { config } = setup();
    const fake = new FakeProvider();
    const svc = createAIService('fake', { gemini: fake }, aiServiceOptions(config));

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'unknown',
      message: 'No AI provider configured',
    });
    expect(fake.lastRequest).toBeUndefined();
  });
});