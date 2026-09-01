/**
 * Plan 011 — AnalyticsService fixture matrix (better-sqlite3 harness).
 * Per plan §Tests: totals + sorted breakdown; MoM absolute + floored pct
 * (incl. zero-baseline null); avg daily + elapsed days; top-5 largest (ties
 * stable, no description — A6) / top-5 categories; budget utilization (no
 * budget → null, over-budget flag); projection across day-of-month fixtures;
 * empty month → zeros, no NaN; snapshot JSON round-trips (the 014 payload);
 * month isolation; user scoping (A10); year rollover; leap February.
 *
 * The service's clock is INJECTED (this.now) so every elapsed-days fixture is
 * deterministic; only engine functions compute the numbers (spot-equality
 * assertions re-derive via the engine, not by hand-math here).
 */
import { describe, expect, it } from '@jest/globals';
import {
  categories as categoriesTable,
  users,
  type Account,
  type Category,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { ExpenseService } from '@/services/ExpenseService';
import { BudgetService } from '@/services/BudgetService';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { ExpenseInput } from '@/repositories/types';
import { avgDaily, monthOverMonth, projectMonthEnd } from '@/engine/analytics';

interface Fixture {
  test: TestDb;
  user: User;
  other: User;
  categories: Category[];
  cash: Account;
  otherCash: Account;
  service: AnalyticsService;
  expenses: ExpenseService;
  otherExpenses: ExpenseService;
  budgets: BudgetService;
}

/** Fresh migrated DB: two users, 12 categories, cash accounts + an injected clock. */
async function makeServiceFixture({
  signedIn = true,
  now,
}: {
  signedIn?: boolean;
  now?: Date;
} = {}): Promise<Fixture> {
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

  const expenseRepo = new DrizzleExpenseRepository(test.db as unknown as never);
  const budgetRepo = new DrizzleBudgetRepository(test.db as unknown as never);
  const catRepo = new DrizzleCategoryRepository(test.db as unknown as never);
  const accountRepo = new DrizzleAccountRepository(test.db as unknown as never);

  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? user : null) };
  const otherAuth: CurrentUserSource = { currentUser: async () => other };
  const cash = await accountRepo.create({ userId: user.id, name: 'Cash', type: 'cash', initialBalanceSen: 100000 });
  const otherCash = await accountRepo.create({ userId: other.id, name: 'Other cash', type: 'cash', initialBalanceSen: 100000 });

  return {
    test,
    user,
    other,
    categories,
    cash,
    otherCash,
    service: new AnalyticsService(expenseRepo, budgetRepo, catRepo, auth, now ? () => now : undefined),
    expenses: new ExpenseService(expenseRepo, catRepo, auth),
    otherExpenses: new ExpenseService(expenseRepo, catRepo, otherAuth),
    budgets: new BudgetService(budgetRepo, catRepo, auth),
  };
}

function expense(f: Fixture, amountSen: number, categoryId: number, date: string): ExpenseInput {
  return { amountSen, categoryId, accountId: f.cash.id, date };
}

/** Sept 2026 (current) + Aug 2026 (previous) seeds + a same-month OTHER-user row (A10). */
async function seedMainFixture(f: Fixture): Promise<void> {
  await f.expenses.create(expense(f, 12050, f.categories[0]!.id, '2026-09-05')); // Food
  await f.expenses.create(expense(f, 700, f.categories[0]!.id, '2026-09-10')); // Food
  await f.expenses.create(expense(f, 800, f.categories[2]!.id, '2026-09-08')); // Transport
  await f.expenses.create(expense(f, 50000, f.categories[0]!.id, '2026-08-10')); // Food (prev)
  await f.expenses.create(expense(f, 30000, f.categories[2]!.id, '2026-08-20')); // Transport (prev)
  await f.otherExpenses.create({ amountSen: 999999, categoryId: f.categories[0]!.id, accountId: f.otherCash.id, date: '2026-09-09' }); // other user
}

/** The main Sept-2026 snapshot under the deterministic Sep-15 clock + budget cells. */
async function mainSnapshot() {
  const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
  await seedMainFixture(f);
  const snap = await f.service.analyzePeriod({ month: 9, year: 2026 });
  return { f, snap };
}

describe('AnalyticsService user resolution + validation', () => {
  it('rejects when not signed in', async () => {
    const f = await makeServiceFixture({ signedIn: false });
    await expect(f.service.analyzePeriod({ month: 9, year: 2026 })).rejects.toThrow('not signed in');
  });

  it('validates the month selection at the service boundary', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
    await expect(f.service.analyzePeriod({ month: 13, year: 2026 })).rejects.toThrow('Invalid month');
    await expect(f.service.analyzePeriod({ month: 0, year: 2026 })).rejects.toThrow('Invalid month');
    await expect(f.service.analyzePeriod({ month: 9, year: 2026.5 })).rejects.toThrow('Year required');
  });
});

describe('AnalyticsService totals + breakdown (AN-1)', () => {
  it('totals the selected month only and sorts the breakdown descending', async () => {
    const { snap, f } = await mainSnapshot();
    // 12050 + 700 + 800 = 13550; Aug + other-user rows excluded (A10)
    expect(snap.totalSen).toBe(13550);
    expect(snap.breakdown).toEqual([
      { categoryId: f.categories[0]!.id, categoryName: 'Food', amountSen: 12750 },
      { categoryId: f.categories[2]!.id, categoryName: 'Transport', amountSen: 800 },
    ]);
    // strictly descending by amount
    for (let i = 1; i < snap.breakdown.length; i += 1) {
      expect(snap.breakdown[i - 1]!.amountSen).toBeGreaterThanOrEqual(snap.breakdown[i]!.amountSen);
    }
    // other user's RM9,999.99 never leaks in
    expect(snap.breakdown.some((b) => b.amountSen === 999999)).toBe(false);
  });

  it('labels months and carries the leap-aware day count', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.monthLabel).toBe('September 2026');
    expect(snap.daysInMonth).toBe(30);
  });
});

describe('AnalyticsService month-over-month (AN-1, AN-4)', () => {
  it('computes absolute + floored pct vs the previous calendar month', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.previousMonth).toEqual({ month: { month: 8, year: 2026 }, totalSen: 80000 });
    expect(snap.changeSen).toBe(-66450); // 13550 − 80000
    expect(snap.changePct).toBe(-83.1); // floor(−66450×1000/80000)/10 = floor(−830.625)/10 = −83.1
  });

  it('null baseline (previous month total 0) → changePct null, changeSen = current total', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
    await f.expenses.create(expense(f, 13550, f.categories[0]!.id, '2026-09-05'));
    const snap = await f.service.analyzePeriod({ month: 9, year: 2026 }); // prev Aug = 0
    expect(snap.previousMonth.totalSen).toBe(0);
    expect(snap.changePct).toBeNull();
    expect(snap.changeSen).toBe(13550);
  });

  it('service assembles engine outputs — spot equality, no re-arithmetic', async () => {
    const { snap } = await mainSnapshot();
    const mom = monthOverMonth(13550, 80000);
    expect(snap.changeSen).toBe(mom.changeSen);
    expect(snap.changePct).toBe(mom.changePct);
    expect(snap.avgDailySen).toBe(avgDaily(13550, 14));
    expect(snap.projectionSen).toBe(projectMonthEnd(13550, 14, 30));
  });

  it('year rollover: January compares vs December of the prior year', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 5, 10) }); // Jun 2026
    await f.expenses.create(expense(f, 10000, f.categories[0]!.id, '2026-01-15'));
    await f.expenses.create(expense(f, 60000, f.categories[0]!.id, '2025-12-20'));
    const jan = await f.service.analyzePeriod({ month: 1, year: 2026 });
    expect(jan.previousMonth).toEqual({ month: { month: 12, year: 2025 }, totalSen: 60000 });
    expect(jan.totalSen).toBe(10000);
    expect(jan.changeSen).toBe(-50000);
    expect(jan.changePct).toBe(-83.4); // floor(−50000×1000/60000)/10 = floor(−833.333)/10 = −83.4
  });
});

describe('AnalyticsService avg daily + elapsed days (AN-2)', () => {
  it('floors spent ÷ elapsed (to date) to the sen', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.elapsedDays).toBe(14); // Sep 15 → day 15 − 1
    expect(snap.avgDailySen).toBe(967); // floor(13550/14) = 967.857 → 967
  });

  it('elapsedDays = 0 on the 1st of the month → avg 0, projection 0 (plan edge case)', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 1) });
    await f.expenses.create(expense(f, 500, f.categories[0]!.id, '2026-09-01'));
    const sept = await f.service.analyzePeriod({ month: 9, year: 2026 });
    expect(sept.elapsedDays).toBe(0);
    expect(sept.avgDailySen).toBe(0);
    expect(sept.projectionSen).toBe(0);
  });

  it('a completed past month uses the full month as elapsed (identity projection)', async () => {
    const { f } = await mainSnapshot();
    const aug = await f.service.analyzePeriod({ month: 8, year: 2026 });
    expect(aug.elapsedDays).toBe(31); // August has 31 days
    expect(aug.projectionSen).toBe(80000); // 80000×31/31 = 80000
    expect(aug.avgDailySen).toBe(2580); // floor(80000/31) = 2580.64 → 2580
  });
});

describe('AnalyticsService top-5 largest / top-5 categories (AN-2)', () => {
  it('largest expenses descend by amount, description-stripped (A6)', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.largest).toHaveLength(3);
    expect(snap.largest.map((l) => [l.amountSen, l.date, l.categoryName])).toEqual([
      [12050, '2026-09-05', 'Food'],
      [800, '2026-09-08', 'Transport'],
      [700, '2026-09-10', 'Food'],
    ]);
    // A6 — never ship free-text descriptions in the 014 AI payload
    expect(Object.keys(snap.largest[0]!)).not.toContain('description');
  });

  it('top-5 categories descend by total', async () => {
    const { snap, f } = await mainSnapshot();
    expect(snap.topCategories).toEqual([
      { categoryId: f.categories[0]!.id, categoryName: 'Food', amountSen: 12750 },
      { categoryId: f.categories[2]!.id, categoryName: 'Transport', amountSen: 800 },
    ]);
  });

  it('ties keep input order (stable sort) — newest first from listForMonth', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
    await f.expenses.create(expense(f, 700, f.categories[0]!.id, '2026-08-03'));
    await f.expenses.create(expense(f, 700, f.categories[2]!.id, '2026-08-05'));
    const aug = await f.service.analyzePeriod({ month: 8, year: 2026 });
    // listForMonth returns newest first (08-05 then 08-03); stable sort preserves it
    expect(aug.largest.map((l) => l.date)).toEqual(['2026-08-05', '2026-08-03']);
  });
});

describe('AnalyticsService budget utilization (AN-2, 007)', () => {
  it('no overall budget → utilization null ("no budget")', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.utilization).toBeNull();
  });

  it('with a budget: one-decimal floored pct; over-budget flips the flag', async () => {
    const { f } = await mainSnapshot();
    await f.budgets.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    expect((await f.service.analyzePeriod({ month: 9, year: 2026 })).utilization).toEqual({
      pct: 4.5, // 13550×1000/300000 = 45.1666 → 4.5
      overBudget: false,
    });
    await f.budgets.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 10000 });
    expect((await f.service.analyzePeriod({ month: 9, year: 2026 })).utilization).toEqual({
      pct: 135.5, // 13550×1000/10000 = 1355 → 135.5
      overBudget: true,
    });
  });
});

describe('AnalyticsService projection (AN-3)', () => {
  it('floors spent ÷ elapsed × daysInMonth (product-first integer math)', async () => {
    const { snap } = await mainSnapshot();
    expect(snap.projectionSen).toBe(29035); // floor(13550×30/14) = floor(29035.714) = 29035
  });

  it('leap February: 29 days and the correct projection', async () => {
    const f = await makeServiceFixture({ now: new Date(2028, 1, 15) }); // Feb 15 2028
    await f.expenses.create(expense(f, 2900, f.categories[0]!.id, '2028-02-10'));
    const feb = await f.service.analyzePeriod({ month: 2, year: 2028 });
    expect(feb.daysInMonth).toBe(29);
    expect(feb.elapsedDays).toBe(14);
    expect(feb.avgDailySen).toBe(207); // floor(2900/14)
    expect(feb.projectionSen).toBe(6007); // floor(2900×29/14) = floor(6007.142) = 6007
  });
});

describe('AnalyticsService empty month + serialization', () => {
  it('empty current month → zeros across the board, no NaN/Infinity', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
    const snap = await f.service.analyzePeriod({ month: 9, year: 2026 });
    expect(snap.totalSen).toBe(0);
    expect(snap.breakdown).toEqual([]);
    expect(snap.largest).toEqual([]);
    expect(snap.topCategories).toEqual([]);
    expect(snap.changePct).toBeNull();
    expect(snap.utilization).toBeNull();
    expect(snap.elapsedDays).toBe(14); // still an elapsed current month
    expect(snap.avgDailySen).toBe(0);
    expect(snap.projectionSen).toBe(0);
    // every numeric field finite and the zero-features are true +0 (never −0/NaN)
    const numeric = [
      snap.totalSen, snap.changeSen, snap.avgDailySen,
      snap.projectionSen, snap.elapsedDays, snap.daysInMonth,
    ];
    for (const v of numeric) expect(Number.isFinite(v)).toBe(true);
    expect(Object.is(snap.totalSen, 0)).toBe(true);
    expect(Object.is(snap.changeSen, 0)).toBe(true);
    expect(Object.is(snap.avgDailySen, 0)).toBe(true);
    expect(Object.is(snap.projectionSen, 0)).toBe(true);
  });

  it('future month → elapsedDays 0', async () => {
    const f = await makeServiceFixture({ now: new Date(2026, 8, 15) });
    const nov = await f.service.analyzePeriod({ month: 11, year: 2026 });
    expect(nov.elapsedDays).toBe(0);
    expect(nov.projectionSen).toBe(0);
  });

  it('snapshot JSON round-trips — the exact payload 014 will send', async () => {
    const { snap } = await mainSnapshot();
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});

describe('AnalyticsService month isolation + user scoping (A10)', () => {
  it('two months never bleed into each other', async () => {
    const { f } = await mainSnapshot();
    const sept = await f.service.analyzePeriod({ month: 9, year: 2026 });
    const aug = await f.service.analyzePeriod({ month: 8, year: 2026 });
    expect(sept.totalSen).toBe(13550);
    expect(aug.totalSen).toBe(80000);
    expect(aug.breakdown.map((b) => b.amountSen)).toEqual([50000, 30000]);
  });

  it("another user's same-month rows never appear in the owner's snapshot", async () => {
    const { snap } = await mainSnapshot();
    expect(snap.largest.some((l) => l.amountSen === 999999)).toBe(false);
  });
});
