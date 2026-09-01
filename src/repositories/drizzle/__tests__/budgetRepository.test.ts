/**
 * Plan 007 — DrizzleBudgetRepository (better-sqlite3 harness). Covers, per plan
 * §Tests: upsert insert → replace on the same (month, category) → never
 * duplicates; the OVERALL-row NULL-in-unique-index caveat (replace keeps a
 * single overall row); clear removes exactly the targeted row; overall +
 * category budgets coexist; month scoping (other months don't leak); user
 * isolation (A10 — two users, same month → separate rows).
 */
import { describe, expect, it } from '@jest/globals';
import {
  budgets as budgetsTable,
  categories as categoriesTable,
  users,
  type Budget,
  type Category,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';

interface Fixture {
  test: TestDb;
  user: User;
  other: User;
  categories: Category[];
  repo: DrizzleBudgetRepository;
}

/** Fresh migrated DB: two users + the 12 seeded categories. */
async function makeFixture(): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db
    .insert(users)
    .values([
      { email: 'owner@example.com', passwordHash: 'hash' },
      { email: 'other@example.com', passwordHash: 'hash' },
    ])
    .run();
  const all = test.db.select().from(users).all() as User[];
  const user = all.find((u) => u.email === 'owner@example.com') as User;
  const other = all.find((u) => u.email === 'other@example.com') as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  const categories = test.db.select().from(categoriesTable).all() as Category[];
  return { test, user, other, categories, repo: new DrizzleBudgetRepository(test.db as unknown as never) };
}

async function countRows(fixture: Fixture): Promise<number> {
  const rows = fixture.test.db.select().from(budgetsTable).all() as Budget[];
  return rows.length;
}

describe('DrizzleBudgetRepository.upsert — replace semantics', () => {
  it('inserts a category budget and REPLACES it on the same (month, category) — same row, never a duplicate', async () => {
    const f = await makeFixture();
    const first = await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    const replaced = await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 120000 });

    expect(replaced.id).toBe(first.id); // onConflictDoUpdate keeps the row
    expect(replaced.amountSen).toBe(120000);
    expect(await countRows(f)).toBe(1);
  });

  it('keeps the SAME row id through repeated upserts (id stability for category budgets)', async () => {
    const f = await makeFixture();
    const a = await f.repo.upsert(f.user.id, { categoryId: f.categories[1]!.id, month: 4, year: 2026, amountSen: 100 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[1]!.id, month: 4, year: 2026, amountSen: 200 });
    const c = await f.repo.upsert(f.user.id, { categoryId: f.categories[1]!.id, month: 4, year: 2026, amountSen: 300 });
    expect(c.id).toBe(a.id);
    expect(await countRows(f)).toBe(1);
  });

  it('enforces the single-OVERALL-row invariant (NULLs are distinct in the unique index)', async () => {
    const f = await makeFixture();
    const first = await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    // Replace = delete + insert (SQLite NULL-distinct caveat), so the id may
    // change — the invariant is ONE overall row with the new amount.
    const replaced = await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 350000 });

    expect(replaced.id).toBeGreaterThanOrEqual(first.id);
    expect(replaced.amountSen).toBe(350000);
    expect(await countRows(f)).toBe(1);
    expect((await f.repo.overallFor(f.user.id, 9, 2026))?.amountSen).toBe(350000);
  });

  it('keeps DIFFERENT categories at the same month separate, and overall + category coexist', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[1]!.id, month: 9, year: 2026, amountSen: 50000 });

    expect(await countRows(f)).toBe(3);
    const month = await f.repo.forMonth(f.user.id, 9, 2026);
    expect(month).toHaveLength(3);
  });

  it('treats the same category in ANOTHER month as a separate row', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 10, year: 2026, amountSen: 200000 });
    expect(await countRows(f)).toBe(2);
  });
});

describe('DrizzleBudgetRepository.clear — removal, not a sentinel', () => {
  it('removes exactly the targeted category row', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[1]!.id, month: 9, year: 2026, amountSen: 50000 });

    await f.repo.clear(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026 });
    expect(await countRows(f)).toBe(1);
    const month = await f.repo.forMonth(f.user.id, 9, 2026);
    expect(month[0]?.categoryId).toBe(f.categories[1]!.id); // the other row survives
  });

  it('removes the overall row but not category rows (NULL ≠ set predicates)', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });

    await f.repo.clear(f.user.id, { categoryId: null, month: 9, year: 2026 });
    expect(await f.repo.overallFor(f.user.id, 9, 2026)).toBeNull();
    expect(await countRows(f)).toBe(1);
  });

  it('is a no-op when no row matches (past-month clear after a replace)', async () => {
    const f = await makeFixture();
    await f.repo.clear(f.user.id, { categoryId: null, month: 9, year: 2026 });
    expect(await countRows(f)).toBe(0);
  });
});

describe('DrizzleBudgetRepository month scoping', () => {
  it('forMonth returns ONLY the requested month; other months never leak', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: null, month: 8, year: 2026, amountSen: 100000 });
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 200000 });
    await f.repo.upsert(f.user.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 50000 });
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2025, amountSen: 300000 }); // same month, other year

    const sep = await f.repo.forMonth(f.user.id, 9, 2026);
    expect(sep).toHaveLength(2); // overall + Food; NOT August, NOT Sep-2025
    expect(sep.every((b) => b.month === 9 && b.year === 2026)).toBe(true);

    expect((await f.repo.overallFor(f.user.id, 8, 2026))?.amountSen).toBe(100000);
    expect((await f.repo.overallFor(f.user.id, 9, 2026))?.amountSen).toBe(200000);
    expect((await f.repo.overallFor(f.user.id, 9, 2025))?.amountSen).toBe(300000);
  });
});

describe('DrizzleBudgetRepository user scoping (A10)', () => {
  it('two users, same month: fully isolated rows', async () => {
    const f = await makeFixture();
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 100000 });
    await f.repo.upsert(f.other.id, { categoryId: null, month: 9, year: 2026, amountSen: 999999 });
    await f.repo.upsert(f.other.id, { categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 1 });

    expect((await f.repo.overallFor(f.user.id, 9, 2026))?.amountSen).toBe(100000);
    expect((await f.repo.overallFor(f.other.id, 9, 2026))?.amountSen).toBe(999999);
    expect(await f.repo.forMonth(f.user.id, 9, 2026)).toHaveLength(1);
    expect(await f.repo.forMonth(f.other.id, 9, 2026)).toHaveLength(2);

    // Replacing one user's overall must not touch the other's.
    await f.repo.upsert(f.user.id, { categoryId: null, month: 9, year: 2026, amountSen: 123456 });
    expect((await f.repo.overallFor(f.other.id, 9, 2026))?.amountSen).toBe(999999);
    expect(await countRows(f)).toBe(3);

    // Clearing one user's row leaves the other's intact.
    await f.repo.clear(f.other.id, { categoryId: null, month: 9, year: 2026 });
    expect((await f.repo.overallFor(f.user.id, 9, 2026))?.amountSen).toBe(123456);
    expect(await f.repo.forMonth(f.other.id, 9, 2026)).toHaveLength(1);
  });
});