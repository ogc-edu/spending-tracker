/**
 * Plan 016 follow-up — CategoryService management: create (validation,
 * case-insensitive uniqueness, default icon type) and delete (expenses
 * keep their category_id — no cascade, Other protected,
 * missing idempotent). Real drizzle repos over the migrated test DB, seeded
 * with the 12 default categories (Other = the fallback).
 */
import { describe, expect, it } from '@jest/globals';
import {
  accounts as accountsTable,
  categories as categoriesTable,
  expenses as expensesTable,
  users,
  type Category,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { CategoryService, CANNOT_DELETE_OTHER_MESSAGE } from '@/services/CategoryService';

interface Fixture {
  test: TestDb;
  user: User;
  categories: Category[];
  other: Category;
  service: CategoryService;
}

async function makeFixture(): Promise<Fixture> {
  const test = createMigratedTestDb();
  const [user] = await test.db.insert(users).values({ email: 'a@test.com', passwordHash: 'x' }).returning();
  if (!user) throw new Error('no user');
  await test.db.insert(accountsTable).values({ userId: user.id, name: 'Cash', type: 'cash', balanceSen: 100000 });
  await insertDefaultCategoriesIfEmpty(test.db as never);
  const categories = (await test.db.select().from(categoriesTable)) as unknown as Category[];
  const other = categories.find((c) => c.name.toLowerCase() === 'other');
  if (!other) throw new Error('seeded Other missing');
  const service = new CategoryService(new DrizzleCategoryRepository(test.db as never));
  return { test, user, categories, other, service };
}

describe('CategoryService.create', () => {
  it('creates a trimmed custom category with expense type', async () => {
    const f = await makeFixture();
    const created = await f.service.create('  Pets  ', 'paw-outline');
    const row = await f.service.byId(created.id);
    expect(row?.name).toBe('Pets');
    expect(row?.icon).toBe('paw-outline');
    expect(row?.type).toBe('expense');
    const all = await f.service.list();
    expect(all.length).toBe(f.categories.length + 1);
  });

  it('rejects empty/whitespace names and names over 24 chars', async () => {
    const f = await makeFixture();
    await expect(f.service.create('   ', 'grid-outline')).rejects.toThrow('Category name required');
    await expect(f.service.create('x'.repeat(25), 'grid-outline')).rejects.toThrow(
      '24 characters or fewer',
    );
  });

  it('rejects duplicates case-insensitively (against seeded + custom names)', async () => {
    const f = await makeFixture();
    await f.service.create('Pets', 'paw-outline');
    await expect(f.service.create('pets', 'grid-outline')).rejects.toThrow('already exists');
    await expect(f.service.create('FOOD', 'grid-outline')).rejects.toThrow('already exists');
  });
});

describe('CategoryService.delete', () => {
  it('deletes the row but leaves referencing expenses untouched (NO cascade)', async () => {
    const f = await makeFixture();
    const food = f.categories.find((c) => c.name.toLowerCase() === 'food');
    if (!food) throw new Error('no Food');
    await f.test.db.insert(expensesTable).values({
      userId: f.user.id,
      amountSen: 2500,
      categoryId: food.id,
      description: 'lunch',
      date: '2026-09-01',
      accountId: null,
    });
    await f.service.delete(food.id);
    const remaining = (await f.test.db.select().from(categoriesTable)) as unknown as Category[];
    expect(remaining.some((c) => c.id === food.id)).toBe(false);
    // The expense keeps its category_id — no reassignment, no cascade.
    const expense = (await f.test.db.select().from(expensesTable))[0] as unknown as { categoryId: number };
    expect(expense.categoryId).toBe(food.id);
    // FK enforcement is back ON after the delete (per-connection pragma).
    expect(f.test.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('protects Other and is idempotent for missing ids', async () => {
    const f = await makeFixture();
    await expect(f.service.delete(f.other.id)).rejects.toThrow(CANNOT_DELETE_OTHER_MESSAGE);
    await expect(f.service.delete(99999)).resolves.toBeUndefined();
  });
});