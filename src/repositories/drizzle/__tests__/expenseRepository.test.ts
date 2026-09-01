/**
 * Plan 006 — DrizzleExpenseRepository.query/sum over the shared predicate
 * builder. The fixture is HAND-COMPUTED (amounts, expected orders, expected
 * sums) and deliberately contains description wildcard traps and same-date
 * rows so the suite proves:
 *  - search case-insensitivity + LIKE wildcard escaping (literal %/_
 *    match only themselves, NOT every row)
 *  - category single-select (F1) filter
 *  - inclusive date-range boundaries (from/to include their endpoints)
 *  - composition (search AND category AND range) vs hand-picked rows
 *  - pagination: date DESC, id DESC ordering; distinct, complete coverage;
 *    offset ignores sum() (totals cover the whole filtered set, EXP-6)
 *  - query vs sum agreement on every filter — the single-source-of-
 *    predicates guarantee (the totals bar can never disagree with the list)
 *  - user scoping (A10): another user's rows never match
 */
import { describe, expect, it } from '@jest/globals';
import { accounts, categories as categoriesTable, expenses as expensesTable, users } from '@/db/schema';
import type { Account, Category, Expense, User } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleExpenseRepository, escapeLike } from '@/repositories/drizzle/expenseRepository';
import type { ExpenseFilter } from '@/repositories/types';

interface Fixture {
  test: TestDb;
  user: User;
  categories: Category[];
  cash: Account;
  repo: DrizzleExpenseRepository;
  /** Every inserted row, in insertion order (id order). */
  inserted: Expense[];
}

/** The hand-computed fixture — 8 expenses across 3 months, 5 categories. */
const ROWS = [
  { description: 'Lunch at Nasi Lemak', amountSen: 1200, categoryName: 'Food', date: '2026-09-01' },
  { description: 'GRAB ride home', amountSen: 800, categoryName: 'Transport', date: '2026-09-05' },
  { description: 'GRAB ride rush hour', amountSen: 950, categoryName: 'Transport', date: '2026-09-05' },
  { description: 'milk 100_grams', amountSen: 500, categoryName: 'Groceries', date: '2026-09-10' },
  { description: 'SALE 100% off shoes', amountSen: 700, categoryName: 'Shopping', date: '2026-09-15' },
  { description: 'bus fare', amountSen: 300, categoryName: 'Transport', date: '2026-08-20' },
  { description: 'Taxi from airport', amountSen: 2500, categoryName: 'Transport', date: '2026-10-02' },
  { description: 'Movie night', amountSen: 400, categoryName: 'Entertainment', date: '2026-09-30' },
] as const;

/** Fresh migrated DB: one user, seeded categories, one cash account, the 8 rows above. */
async function makeFixture(): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run();
  const user = test.db.select().from(users).get() as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  const categories = test.db.select().from(categoriesTable).all() as Category[];
  const cash = test.db
    .insert(accounts)
    .values({ userId: user.id, name: 'Cash', type: 'cash', balanceSen: 100000 })
    .returning()
    .get() as unknown as Account;

  const inserted: Expense[] = [];
  for (const row of ROWS) {
    const category = categories.find((c) => c.name === row.categoryName)!;
    const expense = test.db
      .insert(expensesTable)
      .values({
        userId: user.id,
        amountSen: row.amountSen,
        categoryId: category!.id,
        description: row.description,
        date: row.date,
        accountId: cash.id,
      })
      .returning()
      .get() as unknown as Expense;
    inserted.push(expense);
  }

  const repo = new DrizzleExpenseRepository(test.db as unknown as never);
  return { test, user, categories, cash, repo, inserted };
}

/** Insert one extra row for a second user (A10 scoping). Returns it. */
function insertForOtherUser(fixture: Fixture): Expense {
  fixture.test.db
    .insert(users)
    .values({ email: 'other@example.com', passwordHash: 'hash' })
    .run();
  const other = fixture.test.db.select().from(users).all().find((u) => u.email === 'other@example.com') as User;
  return fixture.test.db
    .insert(expensesTable)
    .values({
      userId: other.id,
      amountSen: 999,
      categoryId: fixture.categories[0]!.id,
      description: 'other user row',
      date: '2026-09-01',
    })
    .returning()
    .get() as unknown as Expense;
}

const ids = (rows: Expense[]): number[] => rows.map((e) => e.id);

describe('DrizzleExpenseRepository.query — search (EXP-5)', () => {
  it('matches case-insensitively on description (both directions)', async () => {
    const f = await makeFixture();
    const lower = await f.repo.query(f.user.id, { search: 'grab' });
    const upper = await f.repo.query(f.user.id, { search: 'GRAB RIDE' });
    const mixed = await f.repo.query(f.user.id, { search: 'GrAb' });
    // ids 2,3 were both inserted on 2026-09-05 → id DESC
    const expected = [f.inserted[2]!.id, f.inserted[1]!.id];
    expect(ids(lower)).toEqual(expected);
    expect(ids(upper)).toEqual(expected);
    expect(ids(mixed)).toEqual(expected);
  });

  it('searches do not match across rows unless the text really matches', async () => {
    const f = await makeFixture();
    expect(ids(await f.repo.query(f.user.id, { search: 'nasi' }))).toEqual([f.inserted[0]!.id]);
    expect(await f.repo.query(f.user.id, { search: 'grub' })).toHaveLength(0);
    expect(await f.repo.query(f.user.id, { search: 'zzz' })).toHaveLength(0);
  });
});

describe('escapeLike + query — LIKE wildcards are escaped (plan §Edge cases)', () => {
  it('escapeLike escapes %, _ and the escape char itself', () => {
    expect(escapeLike('100% off')).toBe('100\\% off');
    expect(escapeLike('100_grams')).toBe('100\\_grams');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('plain')).toBe('plain');
  });

  it("a bare '%' matches ONLY rows containing a literal % (unescaped it would match every row)", async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, { search: '%' });
    expect(ids(rows)).toEqual([f.inserted[4]!.id]); // 'SALE 100% off shoes' only
  });

  it("a bare '_' matches ONLY rows containing a literal _ (unescaped: every row)", async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, { search: '_' });
    expect(ids(rows)).toEqual([f.inserted[3]!.id]); // 'milk 100_grams' only
  });

  it('literal % and _ in a real word search are harmless', async () => {
    const f = await makeFixture();
    expect(ids(await f.repo.query(f.user.id, { search: '100%' }))).toEqual([f.inserted[4]!.id]);
    expect(ids(await f.repo.query(f.user.id, { search: '100_grams' }))).toEqual([f.inserted[3]!.id]);
    // '100' matches both wildcard rows (substring, no wildcards at the edges)
    expect(ids(await f.repo.query(f.user.id, { search: '100' }))).toEqual([
      f.inserted[4]!.id,
      f.inserted[3]!.id,
    ]);
  });
});

describe('DrizzleExpenseRepository.query — category filter (F1 single-select)', () => {
  it('returns only the selected category, newest first', async () => {
    const f = await makeFixture();
    const transportId = f.categories.find((c) => c.name === 'Transport')!.id;
    const rows = await f.repo.query(f.user.id, { categoryId: transportId });
    // 10-02, 09-05(id3), 09-05(id2), 08-20
    expect(ids(rows)).toEqual([
      f.inserted[6]!.id,
      f.inserted[2]!.id,
      f.inserted[1]!.id,
      f.inserted[5]!.id,
    ]);
  });

  it('clearing the category (undefined) returns everyone', async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, {});
    expect(rows).toHaveLength(ROWS.length);
  });
});

describe('DrizzleExpenseRepository.query — date-range boundaries (inclusive from/to)', () => {
  it('from = to returns exactly that day', async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, { from: '2026-09-05', to: '2026-09-05' });
    expect(ids(rows)).toEqual([f.inserted[2]!.id, f.inserted[1]!.id]); // id DESC
  });

  it('includes both endpoints (1st and last day of Sep 2026)', async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, { from: '2026-09-01', to: '2026-09-30' });
    expect(ids(rows)).toEqual([
      f.inserted[7]!.id, // 09-30
      f.inserted[4]!.id, // 09-15
      f.inserted[3]!.id, // 09-10
      f.inserted[2]!.id, // 09-05
      f.inserted[1]!.id, // 09-05
      f.inserted[0]!.id, // 09-01
    ]);
  });

  it('excludes rows just outside the range (Aug 20 excluded from Sep; Oct 2 from Sep)', async () => {
    const f = await makeFixture();
    const sep = await f.repo.query(f.user.id, { from: '2026-09-01', to: '2026-09-30' });
    expect(ids(sep)).not.toContain(f.inserted[5]!.id); // bus fare 08-20
    expect(ids(sep)).not.toContain(f.inserted[6]!.id); // Taxi 10-02
  });

  it('supports open-ended ranges (only from / only to)', async () => {
    const f = await makeFixture();
    const fromOnly = await f.repo.query(f.user.id, { from: '2026-09-15' });
    expect(ids(fromOnly)).toEqual([f.inserted[6]!.id, f.inserted[7]!.id, f.inserted[4]!.id]); // 10-02, 09-30, 09-15
    const toOnly = await f.repo.query(f.user.id, { to: '2026-09-05' });
    // both 09-05s + 09-01 + the AUGUST bus fare (08-20 ≤ 09-05)
    expect(ids(toOnly)).toEqual([f.inserted[2]!.id, f.inserted[1]!.id, f.inserted[0]!.id, f.inserted[5]!.id]);
  });

  it('ignores malformed date strings rather than crashing the screen', async () => {
    const f = await makeFixture();
    const rows = await f.repo.query(f.user.id, { from: 'not-a-date', to: '2026-99-99' });
    expect(rows).toHaveLength(ROWS.length); // predicates dropped → all rows
  });
});

describe('DrizzleExpenseRepository — composition (search AND category AND range)', () => {
  it('finds rows matching every predicate at once', async () => {
    const f = await makeFixture();
    const transportId = f.categories.find((c) => c.name === 'Transport')!.id;
    const rows = await f.repo.query(f.user.id, {
      search: 'grab',
      categoryId: transportId,
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(ids(rows)).toEqual([f.inserted[2]!.id, f.inserted[1]!.id]); // the two Sep 5 GRAB rides
  });

  it('an over-restrictive combination returns nothing', async () => {
    const f = await makeFixture();
    const foodId = f.categories.find((c) => c.name === 'Food')!.id;
    const none = await f.repo.query(f.user.id, { search: 'grab', categoryId: foodId });
    expect(none).toHaveLength(0);
    const none2 = await f.repo.query(f.user.id, { search: 'taxi', from: '2026-09-01', to: '2026-09-30' });
    expect(none2).toHaveLength(0); // taxi is October
  });
});

describe('DrizzleExpenseRepository — pagination (order + coverage)', () => {
  it('orders date DESC, id DESC (ties: later insert first)', async () => {
    const f = await makeFixture();
    const all = await f.repo.query(f.user.id);
    // Expected: 10-02(id7), 09-30(id8), 09-15(id5), 09-10(id4), 09-05(id3), 09-05(id2), 09-01(id1), 08-20(id6)
    expect(ids(all)).toEqual([
      f.inserted[6]!.id,
      f.inserted[7]!.id,
      f.inserted[4]!.id,
      f.inserted[3]!.id,
      f.inserted[2]!.id,
      f.inserted[1]!.id,
      f.inserted[0]!.id,
      f.inserted[5]!.id,
    ]);
  });

  it('batches are distinct, ordered, and cover every row', async () => {
    const f = await makeFixture();
    const page1 = await f.repo.query(f.user.id, { limit: 3, offset: 0 });
    const page2 = await f.repo.query(f.user.id, { limit: 3, offset: 3 });
    const page3 = await f.repo.query(f.user.id, { limit: 3, offset: 6 });
    const page4 = await f.repo.query(f.user.id, { limit: 3, offset: 9 });

    expect(page1).toHaveLength(3);
    expect(page2).toHaveLength(3);
    expect(page3).toHaveLength(2);
    expect(page4).toHaveLength(0);

    const combined = [...ids(page1), ...ids(page2), ...ids(page3)];
    expect(new Set(combined).size).toBe(ROWS.length); // no duplicates
    expect(combined).toEqual(ids(await f.repo.query(f.user.id))); // full, ordered set
  });

  it('offset without limit is ignored (limit/offset are a pair — SQLite rejects OFFSET alone)', async () => {
    const f = await makeFixture();
    const lim = await f.repo.query(f.user.id, { limit: 2 });
    expect(lim).toHaveLength(2);
    expect(ids(lim)).toEqual([f.inserted[6]!.id, f.inserted[7]!.id]);
    const off = await f.repo.query(f.user.id, { offset: 6 });
    expect(off).toHaveLength(ROWS.length); // offset alone → no pagination
    const pair = await f.repo.query(f.user.id, { limit: 2, offset: 6 });
    expect(ids(pair)).toEqual([f.inserted[0]!.id, f.inserted[5]!.id]);
  });

  it('pagination applies to the FILTERED set (offset relative to matches)', async () => {
    const f = await makeFixture();
    const transportId = f.categories.find((c) => c.name === 'Transport')!.id;
    const page = await f.repo.query(f.user.id, { categoryId: transportId, limit: 2, offset: 2 });
    expect(ids(page)).toEqual([f.inserted[1]!.id, f.inserted[5]!.id]); // 3rd and 4th transport rows
  });
});

describe('DrizzleExpenseRepository.sum — agreement with query + hand-computed totals', () => {
  it('sums the whole filtered set with the SAME predicates as query (EXP-6)', async () => {
    const f = await makeFixture();
    const transportId = f.categories.find((c) => c.name === 'Transport')!.id;
    const cases: { label: string; filter: ExpenseFilter; count: number; totalSen: number }[] = [
      { label: 'no filter', filter: {}, count: 8, totalSen: 7350 },
      { label: 'search grab', filter: { search: 'grab' }, count: 2, totalSen: 1750 },
      { label: 'search 100% (escaped)', filter: { search: '100%' }, count: 1, totalSen: 700 },
      { label: 'category transport', filter: { categoryId: transportId }, count: 4, totalSen: 4550 },
      { label: 'range Sep', filter: { from: '2026-09-01', to: '2026-09-30' }, count: 6, totalSen: 4550 },
      { label: 'single day 09-05', filter: { from: '2026-09-05', to: '2026-09-05' }, count: 2, totalSen: 1750 },
      { label: 'composed', filter: { search: 'grab', categoryId: transportId, from: '2026-09-01', to: '2026-09-30' }, count: 2, totalSen: 1750 },
      { label: 'no matches', filter: { search: 'zzz' }, count: 0, totalSen: 0 },
    ];

    for (const c of cases) {
      const totals = await f.repo.sum(f.user.id, c.filter);
      expect(totals.count).toBe(c.count);
      expect(totals.totalSen).toBe(c.totalSen);

      // Agreement: sum.count === the number of rows query returns over the
      // whole set, and the rows' amountSen add up to sum.totalSen (hand-checked
      // against the same numbers above).
      const all = await f.repo.query(f.user.id, c.filter);
      expect(all).toHaveLength(c.count);
      expect(all.reduce((acc, e) => acc + e.amountSen, 0)).toBe(c.totalSen);
    }
  });

  it('sum IGNORES pagination fields — the totals bar covers the whole filtered set', async () => {
    const f = await makeFixture();
    const totals = await f.repo.sum(f.user.id, { search: 'grab', limit: 1, offset: 1 });
    expect(totals).toEqual({ count: 2, totalSen: 1750 });
  });
});

describe('DrizzleExpenseRepository — user scoping (A10)', () => {
  it("another user's rows never match query or sum", async () => {
    const f = await makeFixture();
    insertForOtherUser(f);
    const totals = await f.repo.sum(f.user.id, {});
    expect(totals).toEqual({ count: ROWS.length, totalSen: 7350 });
    const rows = await f.repo.query(f.user.id, { search: 'other' });
    expect(rows).toHaveLength(0);
    const otherTotals = await f.repo.sum(f.user.id, { search: 'other' });
    expect(otherTotals).toEqual({ count: 0, totalSen: 0 });
  });
});