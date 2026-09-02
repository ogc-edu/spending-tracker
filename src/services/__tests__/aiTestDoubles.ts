/**
 * Plan 013 — shared test doubles for AiConfigService / AI UI tests:
 * an in-memory SecureStore and an in-memory SettingsRepository that also
 * records every settings write (so tests can assert keys never reach the repo).
 */
import type { AiPrefs, SettingsRepository } from '@/repositories/types';
import type { SecureStoreLike } from '@/services/AiConfigService';
import type { CurrentUserSource } from '@/services/AccountService';
import type { DebtSnapshot } from '@/ai/types';

export class InMemorySecureStore implements SecureStoreLike {
  readonly map = new Map<string, string>();
  async getItemAsync(key: string) {
    return this.map.get(key) ?? null;
  }
  async setItemAsync(key: string, value: string) {
    this.map.set(key, value);
  }
  async deleteItemAsync(key: string) {
    this.map.delete(key);
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  readonly rows = new Map<number, AiPrefs & { safetyBufferSen: number }>();
  /** Every settings write — for the "keys never touch the repo" assertion. */
  readonly writes: { userId: number; patch: unknown }[] = [];

  async buffer(userId: number) {
    return this.rows.get(userId)?.safetyBufferSen ?? 30000;
  }
  async setBuffer(userId: number, safetyBufferSen: number) {
    this.recordWrite(userId, { safetyBufferSen });
    const existing = this.rows.get(userId) ?? {
      aiActiveProvider: null,
      aiModelGemini: null,
      aiModelDeepseek: null,
    };
    const row = { ...existing, safetyBufferSen };
    this.rows.set(userId, row);
    return row as never;
  }
  async aiPrefs(userId: number): Promise<AiPrefs> {
    const row = this.rows.get(userId);
    return {
      aiActiveProvider: row?.aiActiveProvider ?? null,
      aiModelGemini: row?.aiModelGemini ?? null,
      aiModelDeepseek: row?.aiModelDeepseek ?? null,
    };
  }
  async setAiPrefs(userId: number, patch: Partial<AiPrefs>) {
    this.recordWrite(userId, patch);
    const existing = this.rows.get(userId) ?? {
      safetyBufferSen: 30000,
      aiActiveProvider: null,
      aiModelGemini: null,
      aiModelDeepseek: null,
    };
    const row = { ...existing, ...patch };
    this.rows.set(userId, row);
    return row as never;
  }
  private recordWrite(userId: number, patch: unknown) {
    this.writes.push({ userId, patch });
  }
}

export function makeUser(id: number) {
  return { id, email: `u${id}@example.com`, passwordHash: 'x', createdAt: 0 };
}

export function makeAuth(userId: number | null): CurrentUserSource {
  return { currentUser: async () => (userId == null ? null : makeUser(userId) as never) };
}

export const debtSnapshot: DebtSnapshot = {
  commitments: [{ name: 'Rent', type: 'monthly', remainingSen: 1_200_000 }],
  upcomingBeforeNextMonthSen: 1_200_000,
  overdueSen: 0,
  totalRemainingSen: 1_200_000,
};