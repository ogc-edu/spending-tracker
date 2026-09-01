/**
 * Plan 004 — Drizzle CategoryRepository against the better-sqlite3 harness.
 * Categories are GLOBAL (no user_id): list returns the 12 EXP-7 seeds in seed
 * order (by id); byId resolves / null for unknown. Read-only in the MVP.
 */
import { describe, expect, it } from '@jest/globals';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty, DEFAULT_CATEGORY_SEED } from '@/db/seed';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';

async function seededRepo(): Promise<{ test: TestDb; repo: DrizzleCategoryRepository }> {
  const test = createMigratedTestDb();
  await insertDefaultCategoriesIfEmpty(test.db);
  return { test, repo: new DrizzleCategoryRepository(test.db as unknown as never) };
}

describe('DrizzleCategoryRepository', () => {
  it('list returns the 12 seeds in seed order', async () => {
    const { repo } = await seededRepo();
    const list = await repo.list();
    expect(list).toHaveLength(12);
    expect(list.map((c) => c.name)).toEqual(DEFAULT_CATEGORY_SEED.map((s) => s.name));
    expect(list.map((c) => c.icon)).toEqual(DEFAULT_CATEGORY_SEED.map((s) => s.icon));
    // Preserves seed order (ascending id), not arbitrary.
    const ids = list.map((c) => c.id);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });

  it('byId resolves the matching category and null for an unknown id', async () => {
    const { repo } = await seededRepo();
    const first = (await repo.list())[0]!;
    expect((await repo.byId(first.id))?.name).toBe(first.name);
    expect(await repo.byId(99999)).toBeNull();
  });
});