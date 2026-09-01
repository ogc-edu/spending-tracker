/**
 * Plan 007 — BudgetService (validation, replace semantics, month scoping,
 * user isolation, spent fixtures + metrics). Uses the better-sqlite3 harness
 * with stubbed CurrentUserSource. Per plan §Tests:
 *  - upsert replaces the existing row for the same (month, category); overall
 *    never duplicates (SQLite NULL caveat)
 *  - clear removes; editing/clearing past months allowed
 *  - overall + category budgets coexist independently (BUD-3)
 *  - spent totals come from seeded expense fixtures (engine monthlyTotals /
 *    expenseTotalsByCategory) and budgetMetrics matches hand-computed values
 *  - user scoping (A10) — two users' budgets isolated
 *  - month boundaries — other months' rows don't leak into the month view
 */
import { describe, expect, it } from '@jest/globals';
import {
  budgets as budgetsTable,
  categories as categoriesTable,
  users,
  type Account,
  type Budget,
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
import type { ExpenseInput } from '@/repositories/types';
import { budgetMetrics } from '@/engine/budgets';
import { expenseTotalsByCategory, monthlyTotals } from '@/engine/totals';
import { BudgetService, budgetInputSchema, budgetKeySchema } from '@/services/BudgetService';

interface Fixture {
  test: TestDb;
  user: User;
  other: User;
  categories: Category[];
  cash: Account;
  service: BudgetService;
  expenses: ExpenseService;
}

/** Fresh migrated DB: two users, 12 categories, cash account (RM1,000). */
async function makeServiceFixture({ signedIn = true, as = 'owner' }: { signedIn?: boolean; as?: 'owner' | 'other' } = {}): Promise<Fixture> {
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

  const budgetRepo = new DrizzleBudgetRepository(test.db as unknown as never);
  const catRepo = new DrizzleCategoryRepository(test.db as unknown as never);
  const expenseRepo = new DrizzleExpenseRepository(test.db as unknown as never);
  const accountRepo = new DrizzleAccountRepository(test.db as unknown as never);

  const acting = as === 'owner' ? user : other;
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? acting : null) };
  const cash = await accountRepo.create({ userId: user.id, name: 'Cash', type: 'cash', initialBalanceSen: 100000 });
  // The 'other' user gets its own account so ExpenseService.create works for it too.
  await accountRepo.create({ userId: other.id, name: 'Other cash', type: 'cash', initialBalanceSen: 100000 });

  return {
    test,
    user,
    other,
    categories,
    cash,
    service: new BudgetService(budgetRepo, catRepo, auth),
    expenses: new ExpenseService(expenseRepo, catRepo, auth),
  };
}

/** Seed one expense through ExpenseService (kept out of BudgetService's way). */
function expenseInput(f: Fixture, amountSen: number, categoryId: number, date: string): ExpenseInput {
  return { amountSen, categoryId, accountId: f.cash.id, date };
}

async function countBudgetRows(f: Fixture): Promise<number> {
  return (f.test.db.select().from(budgetsTable).all() as Budget[]).length;
}

describe('BudgetService user resolution', () => {
  it('rejects every operation when not signed in', async () => {
    const f = await makeServiceFixture({ signedIn: false });
    await expect(f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 100000 })).rejects.toThrow('not signed in');
    await expect(f.service.clear({ categoryId: null, month: 9, year: 2026 })).rejects.toThrow('not signed in');
    await expect(f.service.overallFor(9, 2026)).rejects.toThrow('not signed in');
    await expect(f.service.forMonthWithCategories(9, 2026)).rejects.toThrow('not signed in');
  });
});

describe('BudgetService input validation (service boundary)', () => {
  it('rejects zero and negative amounts', async () => {
    const f = await makeServiceFixture();
    await expect(f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 0 })).rejects.toThrow('Amount must be greater than 0');
    await expect(f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: -5 })).rejects.toThrow('Amount must be greater than 0');
    await expect(budgetInputSchema.safeParse({ categoryId: null, month: 9, year: 2026, amountSen: 0 }).success).toBe(false);
  });

  it('rejects non-integer sen (3-decimal amounts arrive as fractions)', async () => {
    const f = await makeServiceFixture();
    await expect(f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 12.345 })).rejects.toThrow('Amount must be whole sen');
  });

  it('rejects invalid months and years', async () => {
    const f = await makeServiceFixture();
    await expect(f.service.upsert({ categoryId: null, month: 0, year: 2026, amountSen: 100 })).rejects.toThrow('Invalid month');
    await expect(f.service.upsert({ categoryId: null, month: 13, year: 2026, amountSen: 100 })).rejects.toThrow('Invalid month');
    await expect(f.service.upsert({ categoryId: null, month: 9, year: 2026.5, amountSen: 100 })).rejects.toThrow('Year required');
    await expect(f.service.overallFor(0, 2026)).rejects.toThrow('invalid month');
    await expect(f.service.overallFor(9, 2026.5)).rejects.toThrow('invalid year');
  });

  it('rejects a category id of 0 / negative, accepts null (overall)', async () => {
    const f = await makeServiceFixture();
    await expect(f.service.upsert({ categoryId: 0, month: 9, year: 2026, amountSen: 100 })).rejects.toThrow('Category required');
    await expect(f.service.upsert({ categoryId: -1, month: 9, year: 2026, amountSen: 100 })).rejects.toThrow('Category required');
    expect(budgetKeySchema.safeParse({ categoryId: null, month: 9, year: 2026 }).success).toBe(true);
  });

  it('rejects an unknown category before anything is written (stale picker → friendly error)', async () => {
    const f = await makeServiceFixture();
    await expect(f.service.upsert({ categoryId: 99999, month: 9, year: 2026, amountSen: 100 })).rejects.toThrow('unknown category');
    expect(await countBudgetRows(f)).toBe(0);
  });
});

describe('BudgetService.upsert/clear — replace semantics', () => {
  it('upsert replaces the same (month, category) row — never duplicates', async () => {
    const f = await makeServiceFixture();
    const first = await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    const replaced = await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 120000 });
    expect(replaced.id).toBe(first.id);
    expect(await countBudgetRows(f)).toBe(1);
  });

  it('replacing the overall budget keeps a SINGLE overall row', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 350000 });
    expect(await countBudgetRows(f)).toBe(1);
    expect((await f.service.overallFor(9, 2026))?.amountSen).toBe(350000);
  });

  it('clear removes the row; clearing again is a no-op', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });
    await f.service.clear({ categoryId: f.categories[0]!.id, month: 9, year: 2026 });
    expect(await f.service.forMonthWithCategories(9, 2026)).toEqual({ overall: null, byCategory: new Map() });
    await f.service.clear({ categoryId: f.categories[0]!.id, month: 9, year: 2026 }); // no-op
    expect(await countBudgetRows(f)).toBe(0);
  });

  it('allows editing and clearing PAST months (no retroactive restrictions)', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: null, month: 1, year: 2026, amountSen: 250000 });
    const replace = await f.service.upsert({ categoryId: null, month: 1, year: 2026, amountSen: 200000 });
    expect((await f.service.overallFor(1, 2026))?.amountSen).toBe(200000);
    await f.service.clear({ categoryId: null, month: 1, year: 2026 });
    expect(await f.service.overallFor(1, 2026)).toBeNull();
    // The replace write itself succeeded before the clear — past-month edits are welcome.
    expect(replace.month).toBe(1);
  });
});

describe('BudgetService.forMonthWithCategories — month view', () => {
  it('overall + category budgets coexist and stay independent (BUD-3)', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });

    const view = await f.service.forMonthWithCategories(9, 2026);
    expect(view.overall?.amountSen).toBe(300000);
    expect(view.byCategory.get(f.categories[0]!.id)?.amountSen).toBe(100000);
    expect(view.byCategory.size).toBe(1);

    // An overall-only month has an empty category map; a category-only month has null overall.
    const catOnly = await f.service.forMonthWithCategories(10, 2026);
    expect(catOnly.overall).toBeNull();
    expect(catOnly.byCategory.size).toBe(0);
    await f.service.upsert({ categoryId: f.categories[1]!.id, month: 10, year: 2026, amountSen: 50000 });
    const catOnly2 = await f.service.forMonthWithCategories(10, 2026);
    expect(catOnly2.overall).toBeNull();
    expect(catOnly2.byCategory.size).toBe(1);
  });

  it('month scoping: other months never leak into the month view', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: null, month: 8, year: 2026, amountSen: 100000 });
    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 200000 });
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 50000 });
    await f.service.upsert({ categoryId: null, month: 9, year: 2025, amountSen: 300000 });

    const sep = await f.service.forMonthWithCategories(9, 2026);
    expect(sep.overall?.amountSen).toBe(200000);
    expect(sep.byCategory.size).toBe(1);
    expect(sep.byCategory.get(f.categories[0]!.id)?.amountSen).toBe(50000);
  });
});

describe('BudgetService spent fixtures + metrics (plan §Tests)', () => {
  it('monthly spent and per-category spent come from seeded expenses; metrics match hand-computed values', async () => {
    const f = await makeServiceFixture();
    // Seed September expenses through the expense service: RM120.50 Food,
    // RM7.00 Food, RM8.00 Transport (cat 3 = Transport index 2).
    await f.expenses.create(expenseInput(f, 12050, f.categories[0]!.id, '2026-09-05'));
    await f.expenses.create(expenseInput(f, 700, f.categories[0]!.id, '2026-09-20'));
    await f.expenses.create(expenseInput(f, 800, f.categories[2]!.id, '2026-09-25'));
    await f.expenses.create(expenseInput(f, 99999, f.categories[0]!.id, '2026-08-31')); // other month — excluded

    const rows = await f.expenses.listForMonth(2026, 9);
    const scope = { month: 9, year: 2026 };
    const spentTotal = monthlyTotals(rows, scope);
    const spentByCategory = expenseTotalsByCategory(rows, scope);
    expect(spentTotal).toBe(13550); // 12050 + 700 + 800; August excluded
    expect(spentByCategory.get(f.categories[0]!.id)).toBe(12750);
    expect(spentByCategory.get(f.categories[2]!.id)).toBe(800);
    expect(spentByCategory.has(f.categories[1]!.id)).toBe(false);

    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 300000 });
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 100000 });

    const overall = await f.service.overallFor(9, 2026);
    // RM3,000 budget, RM135.50 spent: remaining 2864.50; 13550×1000/300000 = 45.16… → 4.5%
    expect(budgetMetrics(overall!.amountSen, spentTotal)).toEqual({
      spent: 13550,
      remaining: 286450,
      pctUsed: 4.5,
      overBudget: false,
    });

    const view = await f.service.forMonthWithCategories(9, 2026);
    const foodBudget = view.byCategory.get(f.categories[0]!.id)!;
    // RM1,000 Food budget, RM127.50 spent → not over; 12750×1000/100000 = 127.5 → 12.7%
    expect(budgetMetrics(foodBudget.amountSen, spentByCategory.get(f.categories[0]!.id) ?? 0)).toEqual({
      spent: 12750,
      remaining: 87250,
      pctUsed: 12.7,
      overBudget: false,
    });

    // No budget for Transport → null metrics (UI shows "—"), never a crash.
    const transportSpent = spentByCategory.get(f.categories[2]!.id) ?? 0;
    expect(budgetMetrics(null, transportSpent)).toEqual({
      spent: 800,
      remaining: null,
      pctUsed: null,
      overBudget: false,
    });
  });

  it('a category over its budget flips overBudget while the overall stays under (independence)', async () => {
    const f = await makeServiceFixture();
    await f.expenses.create(expenseInput(f, 15000, f.categories[0]!.id, '2026-09-10'));
    const rows = await f.expenses.listForMonth(2026, 9);
    const spentByCategory = expenseTotalsByCategory(rows, { month: 9, year: 2026 });

    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 1000000 }); // big overall
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 10000 }); // tight food

    const view = await f.service.forMonthWithCategories(9, 2026);
    const food = budgetMetrics(view.byCategory.get(f.categories[0]!.id)!.amountSen, spentByCategory.get(f.categories[0]!.id) ?? 0);
    expect(food.overBudget).toBe(true);
    expect(food.remaining).toBe(0); // BUD-4 floor (applies per budget row)
    expect(food.pctUsed).toBe(150.0);

    const overall = budgetMetrics(view.overall!.amountSen, monthlyTotals(rows, { month: 9, year: 2026 }));
    expect(overall.overBudget).toBe(false); // category over ≠ overall over
  });
});

describe('BudgetService user scoping (A10)', () => {
  it('two users, same month: budgets fully isolated', async () => {
    const f = await makeServiceFixture();
    await f.service.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 100000 });
    await f.service.upsert({ categoryId: f.categories[0]!.id, month: 9, year: 2026, amountSen: 50000 });

    const otherService = (await makeServiceFixture({ as: 'other' })).service;
    await otherService.upsert({ categoryId: null, month: 9, year: 2026, amountSen: 999999 });

    // Owner still sees exactly its own two rows; other sees only its overall.
    const ownerView = await f.service.forMonthWithCategories(9, 2026);
    expect(ownerView.overall?.amountSen).toBe(100000);
    expect(ownerView.byCategory.size).toBe(1);
    expect(ownerView.byCategory.get(f.categories[0]!.id)?.amountSen).toBe(50000);

    const otherView = await otherService.forMonthWithCategories(9, 2026);
    expect(otherView.overall?.amountSen).toBe(999999);
    expect(otherView.byCategory.size).toBe(0);

    // Clearing as other doesn't touch the owner's rows.
    await otherService.clear({ categoryId: null, month: 9, year: 2026 });
    expect((await f.service.overallFor(9, 2026))?.amountSen).toBe(100000);
  });
});