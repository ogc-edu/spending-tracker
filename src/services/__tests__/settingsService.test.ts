/**
 * Plan 016 — SettingsService safety-buffer round-trip against the drizzle
 * repo over the better-sqlite3 harness (PRD SET-1, plan §Tests):
 *  - default is 30000 sen (RM300) for a rowless user;
 *  - setBuffer(0) is ACCEPTED (0 = legitimate "no buffer", plan §Edge cases);
 *  - negative and non-integer values are REJECTED (service boundary);
 *  - a save persists across reads (round-trip).
 */
import { describe, expect, it } from '@jest/globals';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import { users } from '@/db/schema';
import { SettingsService } from '@/services/SettingsService';
import type { CurrentUserSource } from '@/services/AccountService';

async function setup(): Promise<{ test: TestDb; service: SettingsService; userId: number }> {
  const test = createMigratedTestDb();
  const [user] = await test.db.insert(users).values({ email: 'buffer@example.com', passwordHash: 'test' }).returning();
  const auth: CurrentUserSource = { currentUser: async () => user ?? null };
  const service = new SettingsService(new DrizzleSettingsRepository(test.db as unknown as never), auth);
  return { test, service, userId: user!.id };
}

describe('SettingsService safety buffer (plan 016 / SET-1)', () => {
  it('defaults to 30000 sen (RM300) for a user with no settings row', async () => {
    const { service } = await setup();
    expect(await service.getBuffer()).toBe(30000);
  });

  it('round-trips a save (setBuffer → getBuffer)', async () => {
    const { service } = await setup();
    const saved = await service.setBuffer(50000);
    expect(saved.safetyBufferSen).toBe(50000);
    expect(await service.getBuffer()).toBe(50000);
  });

  it('accepts 0 (no buffer is a legitimate choice)', async () => {
    const { service } = await setup();
    await service.setBuffer(0);
    expect(await service.getBuffer()).toBe(0);
  });

  it('rejects negative sen', async () => {
    const { service } = await setup();
    await expect(service.setBuffer(-1)).rejects.toThrow('invalid safety buffer');
    expect(await service.getBuffer()).toBe(30000); // unchanged
  });

  it('rejects non-integer sen', async () => {
    const { service } = await setup();
    await expect(service.setBuffer(12.5)).rejects.toThrow('invalid safety buffer');
  });
});