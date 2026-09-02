/**
 * Plan 013 — DrizzleSettingsRepository AI-pref methods against the
 * better-sqlite3 harness: all-null defaults for a rowless user, upsert
 * semantics (single row per user, patched fields only), explicit null clears,
 * and coexistence with the plan-010 buffer. Keys never appear here.
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import { settings, users } from '@/db/schema';

async function setup(): Promise<{ test: TestDb; repo: DrizzleSettingsRepository; userId: number }> {
  const test = createMigratedTestDb();
  const [user] = await test.db
    .insert(users)
    .values({ email: 'ai-user@example.com', passwordHash: 'test' })
    .returning();
  return { test, repo: new DrizzleSettingsRepository(test.db as unknown as never), userId: user!.id };
}

describe('DrizzleSettingsRepository AI prefs (plan 013)', () => {
  it('aiPrefs returns all-null defaults for a rowless user', async () => {
    const { repo, userId } = await setup();
    expect(await repo.aiPrefs(userId)).toEqual({
      aiActiveProvider: null,
      aiModelGemini: null,
      aiModelDeepseek: null,
    });
  });

  it('setAiPrefs creates the row on first write and persists across reads', async () => {
    const { test, repo, userId } = await setup();

    await repo.setAiPrefs(userId, {
      aiActiveProvider: 'gemini',
      aiModelGemini: 'gemini-3.6-flash',
    });

    expect(await repo.aiPrefs(userId)).toEqual({
      aiActiveProvider: 'gemini',
      aiModelGemini: 'gemini-3.6-flash',
      aiModelDeepseek: null,
    });
    // Exactly one settings row for the user.
    const rows = await test.db.select().from(settings).where(eq(settings.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it('updates only the patched fields (others untouched)', async () => {
    const { repo, userId } = await setup();
    await repo.setAiPrefs(userId, { aiModelGemini: 'gemini-3.6-flash' });
    await repo.setAiPrefs(userId, { aiActiveProvider: 'deepseek' });

    const prefs = await repo.aiPrefs(userId);
    expect(prefs.aiActiveProvider).toBe('deepseek');
    expect(prefs.aiModelGemini).toBe('gemini-3.6-flash'); // untouched
    expect(prefs.aiModelDeepseek).toBeNull();
  });

  it('explicit null clears a model selection', async () => {
    const { repo, userId } = await setup();
    await repo.setAiPrefs(userId, { aiModelDeepseek: 'deepseek-v4-flash' });
    await repo.setAiPrefs(userId, { aiModelDeepseek: null });

    expect((await repo.aiPrefs(userId)).aiModelDeepseek).toBeNull();
  });

  it('coexists with the plan-010 buffer (same row, both defaults intact)', async () => {
    const { repo, userId } = await setup();
    await repo.setAiPrefs(userId, { aiActiveProvider: 'gemini' });

    expect(await repo.buffer(userId)).toBe(30000); // column default preserved

    await repo.setBuffer(userId, 50000);
    expect((await repo.aiPrefs(userId)).aiActiveProvider).toBe('gemini');
  });

  it('rejects an empty patch', async () => {
    const { repo, userId } = await setup();
    await expect(repo.setAiPrefs(userId, {})).rejects.toThrow('at least one field');
  });
});