/**
 * Plan 010 — CashFlowService.snapshot integration over the harness DB
 * (better-sqlite3 + the committed migration SQL).
 *
 * Exercises the FULL orchestrator: repositories → engine → typed snapshot,
 * against hand-computed fixtures. The canonical one is PRD §8.5's worked
 * example (September 2026):
 *
 *   300000 − 80000 − 184000 − 30000 = 6000  →  200 sen/day over 30 days
 *
 * Fixture construction notes:
 *  - MANUAL expenses are inserted directly (no balance adjustment) so the
 *    account balances stay exactly under the test's control — available stays
 *    300000 (350000 cash − 50000 credit-card owed) even with 116000 spent.
 *  - The PAID commitment slot contributes its linked Debt/Repayment expense
 *    to spent (D3) and is EXCLUDED from upcoming (PRD §8.3 double-counting).
 *  - The "re-query after mutation" test adds an expense THROUGH
 *    ExpenseService (which DOES adjust the balance) to prove the PRD §8.4
 *    cancellation property: spending moves available and remaining by the
 *    same amount, so safe is unchanged. That is the plan's "re-query after
 *    mutation" acceptance, not just a cache check.
 */
import { describe, expect, it } from '@jest/globals';
import { eq } from 'drizzle-orm';
import {
  accounts as accountsTable,
  categories as categoriesTable,
  commitmentPayments as commitmentPaymentsTable,
  commitments as commitmentsTable,
  expenses as expensesTable,
  settings as settingsTable,
  users,
  type Account,
  type Category,
  type Commitment,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { CashFlowService } from '@/services/CashFlowService';
import { SettingsService } from '@/services/SettingsService';
import { ExpenseService } from '@/services/ExpenseService';
import { BudgetService } from '@/services/BudgetService';
import type { ExpenseInput } from '@/repositories/types';

/** PRD §8.5 month window — September 2026, `now` = the 1st (30 days incl. today). */
const now = new Date(2026, 8, 1); // local: 2026-09-01 → exactly 30 days to the 30th

interface Fixture {
  test: TestDb;
  user: User;
  other: User;
  categories: Category[];
  cash: Account;
  cashflow: CashFlowService;
  expenses: ExpenseService;
  settings: SettingsService;
  settingsRepo: DrizzleSettingsRepository;
}

/** Fresh migrated DB: two users, 12 categories, a cash account (RM3,500) + a credit card (RM500 owed). */
async function makeFixture({ signedIn = true, as = 'owner' } = {}): Promise<Fixture> {
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

  const accountRepo = new DrizzleAccountRepository(test.db as unknown as never);
  const budgetRepo = new DrizzleBudgetRepository(test.db as unknown as never);
  const catRepo = new DrizzleCategoryRepository(test.db as unknown as never);
  const commitmentRepo = new DrizzleCommitmentRepository(test.db as unknown as never);
  const expenseRepo = new DrizzleExpenseRepository(test.db as unknown as never);
  const settingsRepo = new DrizzleSettingsRepository(test.db as unknown as never);

  const acting = as === 'owner' ? user : other;
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? acting : null) };

  // Owner: RM3,500 cash + a credit card owing RM500 → available RM3,000 (PRD §8.5).
  const cash = await accountRepo.create({
    userId: user.id,
    name: 'Cash',
    type: 'cash',
    initialBalanceSen: 350000,
  });
  await accountRepo.create({
    userId: user.id,
    name: 'Credit card',
    type: 'credit_card',
    initialBalanceSen: 50000,
  });
  // The 'other' user gets a single cash account so ExpenseService works for it too.
  await accountRepo.create({
    userId: other.id,
    name: 'Other cash',
    type: 'cash',
    initialBalanceSen: 100000,
  });

  return {
    test,
    user,
    other,
    categories,
    cash,
    cashflow: new CashFlowService(
      accountRepo,
      expenseRepo,
      budgetRepo,
      commitmentRepo,
      settingsRepo,
      auth,
    ),
    expenses: new ExpenseService(expenseRepo, catRepo, auth),
    settings: new SettingsService(settingsRepo, auth),
    settingsRepo,
  };
}

/** Insert an expense row directly — NO balance adjustment, so `available` stays under test control. */
function insertExpenseDirect(f: Fixture, amountSen: number, categoryId: number, date: string): void {
  f.test.db
    .insert(expensesTable)
    .values({
      userId: f.user.id,
      amountSen,
      categoryId,
      accountId: f.cash.id,
      description: '',
      date,
    })
    .run();
}

/** Insert a commitment row directly. Returns the row (for id lookups). */
function insertCommitment(
  f: Fixture,
  input: Omit<Commitment, 'id' | 'userId' | 'status' | 'archivedAt' | 'createdAt' | 'updatedAt'>,
): Commitment {
  const rows = f.test.db
    .insert(commitmentsTable)
    .values({ userId: f.user.id, status: 'active', ...input })
    .returning()
    .all() as unknown as Commitment[];
  return rows[0];
}

/**
 * The PRD §8.5 canonical fixture. Builds accounts (done in makeFixture),
 * RM1,160 → wait, RM1160 spent = 116000 sen (RM400 Food + RM160 Transport +
 * RM600 paid Loan), a RM3,000 overall budget, unpaid commitments of RM800
 * (RM500 rent + RM300 phone) plus the PAID Loan slot, and leaves the buffer
 * at its default RM300. snapshot(now) must yield exactly:
 *   available 300000 − upcoming 80000 − remaining 184000 − buffer 30000 = safe 6000
 *   daily = floor(6000 / 30) = 200
 */
async function seedCanonicalFixture(f: Fixture): Promise<void> {
  const { user, categories } = f;
  const foodId = categories[0]!.id; // Food
  const transportId = categories[2]!.id; // Transport

  // Manual September expenses: RM400 Food + RM160 Transport = RM560.
  insertExpenseDirect(f, 40000, foodId, '2026-09-02');
  insertExpenseDirect(f, 16000, transportId, '2026-09-03');

  // RM3,000 overall budget for September.
  await new BudgetService(
    new DrizzleBudgetRepository(f.test.db as unknown as never),
    new DrizzleCategoryRepository(f.test.db as unknown as never),
    { currentUser: async () => user },
  ).upsert({ categoryId: null, month: 9, year: 2026, amountSen: 300000 });

  // Unpaid: RM500 ongoing rent (slot 09-01) + RM300 one-time phone bill (09-15).
  insertCommitment(f, {
    name: 'Rent',
    type: 'rent',
    totalSen: null,
    remainingSen: 0,
    paymentSen: 50000,
    frequency: 'monthly',
    startDate: '2026-09-01',
    endDate: null,
    dueDate: '2026-09-01',
  });
  insertCommitment(f, {
    name: 'Phone bill',
    type: 'phone',
    totalSen: null,
    remainingSen: 0,
    paymentSen: 30000,
    frequency: 'one_time',
    startDate: '2026-09-15',
    endDate: null,
    dueDate: '2026-09-15',
  });

  // PAID: a fixed RM1,200 loan paid in RM600 monthly installments, Sep slot
  // paid → linked RM600 Debt/Repayment expense (D3, counted in spent), and
  // excluded from upcoming (PRD §8.3).
  const loan = insertCommitment(f, {
    name: 'Loan',
    type: 'installment',
    totalSen: 120000,
    remainingSen: 120000,
    paymentSen: 60000,
    frequency: 'monthly',
    startDate: '2026-09-01',
    endDate: null,
    dueDate: '2026-09-01',
  });
  const debtCategory = categories.find((c) => c.name === 'Debt / Repayment') as Category;
  const paymentRows = f.test.db
    .insert(commitmentPaymentsTable)
    .values({
      userId: user.id,
      commitmentId: loan.id,
      amountSen: 60000,
      dueDate: '2026-09-01',
      paidDate: '2026-09-02',
      status: 'paid',
    })
    .returning()
    .all() as unknown as { id: number }[];
  const paymentId = paymentRows[0]!.id;
  f.test.db
    .insert(expensesTable)
    .values({
      userId: user.id,
      amountSen: 60000,
      categoryId: debtCategory.id,
      description: 'Loan Sep',
      date: '2026-09-02',
      accountId: null,
      commitmentPaymentId: paymentId,
    })
    .run();
}

function expenseInput(f: Fixture, amountSen: number, categoryId: number): ExpenseInput {
  return { amountSen, categoryId, accountId: f.cash.id, date: '2026-09-04' };
}

describe('CashFlowService.snapshot — PRD §8.5 canonical fixture', () => {
  it('every number matches the hand-computed §8.5 example', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);

    const snap = await f.cashflow.snapshot(now);

    // available = 350000 (cash) − 50000 (credit-card owed) = 300000
    expect(snap.availableSen).toBe(300000);
    // spent = 40000 + 16000 + 60000 (paid Loan expense) = 116000
    expect(snap.spentSen).toBe(116000);
    expect(snap.hasBudget).toBe(true);
    expect(snap.budget?.amountSen).toBe(300000);
    // remaining = max(0, 300000 − 116000) = 184000  (D2)
    expect(snap.remainingSen).toBe(184000);
    // upcoming = 50000 (rent) + 30000 (phone) = 80000; the paid Loan slot is excluded.
    expect(snap.upcomingSen).toBe(80000);
    // buffer default = RM300
    expect(snap.bufferSen).toBe(30000);
    // SAFE = 300000 − 80000 − 184000 − 30000 = 6000  (PRD §8.5)
    expect(snap.safeSen).toBe(6000);
    expect(snap.deficit).toBe(false);
    // daily = floor(6000 / 30) = 200
    expect(snap.dailyAllowanceSen).toBe(200);
    // month scope derived from `now`
    expect(snap.month).toEqual({ month: 9, year: 2026 });
    expect(snap.accountCount).toBe(2);
  });

  it('the formula card data (breakdown) sums back to safe', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const snap = await f.cashflow.snapshot(now);

    expect(snap.breakdown).toEqual([
      { label: 'Available', amountSen: 300000 },
      { label: 'Upcoming commitments', amountSen: -80000 },
      { label: 'Remaining budget', amountSen: -184000 },
      { label: 'Safety buffer', amountSen: -30000 },
    ]);
    const sum = snap.breakdown.reduce((acc, item) => acc + item.amountSen, 0);
    expect(sum).toBe(snap.safeSen);
  });

  it('budget bar metrics match hand-computed 007 numbers', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const snap = await f.cashflow.snapshot(now);

    // pct = floor(116000 × 1000 / 300000) / 10 = floor(386.66) / 10 = 38.6
    expect(snap.budgetMetrics).toEqual({
      spent: 116000,
      remaining: 184000,
      pctUsed: 38.6,
      overBudget: false,
    });
  });

  it('upcoming items are due-date ascending with DB names, and the summary is top-5 sorted', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const snap = await f.cashflow.snapshot(now);

    expect(snap.upcomingItems).toEqual([
      { commitmentId: expect.any(Number), name: 'Rent', dueDate: '2026-09-01', amountSen: 50000, frequency: 'monthly' },
      { commitmentId: expect.any(Number), name: 'Phone bill', dueDate: '2026-09-15', amountSen: 30000, frequency: 'one_time' },
    ]);
    // Category totals desc: Debt/Repayment 60000, Food 40000, Transport 16000.
    expect(snap.categorySummary).toEqual([
      { categoryId: f.categories.find((c) => c.name === 'Debt / Repayment')!.id, totalSen: 60000 },
      { categoryId: f.categories[0]!.id, totalSen: 40000 },
      { categoryId: f.categories[2]!.id, totalSen: 16000 },
    ]);
  });

  it('derives the NEXT calendar month\u2019s unpaid slots for the ask box (plan 019)', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const snap = await f.cashflow.snapshot(now);

    // October 2026: ongoing Rent (10-01, 50000) + the fixed Loan's second,
    // still-unpaid installment (10-01, 60000). The one-time Phone bill does
    // not recur, and every paid September slot is excluded.
    expect(snap.nextMonthSen).toBe(110000);
    expect(snap.nextMonthItems).toHaveLength(2);
    // Both are due 2026-10-01; the tie order follows the repository's row
    // order, so assert membership rather than a positional order.
    expect(snap.nextMonthItems).toEqual(
      expect.arrayContaining([
        { commitmentId: expect.any(Number), name: 'Rent', dueDate: '2026-10-01', amountSen: 50000, frequency: 'monthly' },
        { commitmentId: expect.any(Number), name: 'Loan', dueDate: '2026-10-01', amountSen: 60000, frequency: 'monthly' },
      ]),
    );
  });
});

describe('CashFlowService.snapshot — deficit state', () => {
  it('safe can be negative and flags a first-class deficit (never styled as success)', async () => {
    const f = await makeFixture();
    // Collapse to available RM500: cash 50000, credit card zeroed (0 owed).
    f.test.db
      .update(accountsTable)
      .set({ balanceSen: 50000 })
      .where(eq(accountsTable.id, f.cash.id))
      .run();
    f.test.db
      .update(accountsTable)
      .set({ balanceSen: 0 })
      .where(eq(accountsTable.name, 'Credit card'))
      .run();
    insertExpenseDirect(f, 20000, f.categories[0]!.id, '2026-09-02');
    await new BudgetService(
      new DrizzleBudgetRepository(f.test.db as unknown as never),
      new DrizzleCategoryRepository(f.test.db as unknown as never),
      { currentUser: async () => f.user },
    ).upsert({ categoryId: null, month: 9, year: 2026, amountSen: 100000 });
    insertCommitment(f, {
      name: 'Rent',
      type: 'rent',
      totalSen: null,
      remainingSen: 0,
      paymentSen: 50000,
      frequency: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      dueDate: '2026-09-01',
    });

    const snap = await f.cashflow.snapshot(now);

    // available 50000 − remaining max(0,100000−20000)=80000 − upcoming 50000 − buffer 30000
    //   = −110000 → deficit
    expect(snap.availableSen).toBe(50000);
    expect(snap.remainingSen).toBe(80000);
    expect(snap.upcomingSen).toBe(50000);
    expect(snap.safeSen).toBe(-110000);
    expect(snap.deficit).toBe(true);
    // Negative allowance floored toward −∞ (ARCH §6): floor(−110000/30) = −3667.
    expect(snap.dailyAllowanceSen).toBe(-3667);
    // Breakdown still sums to the (negative) safe — the formula is deficit-aware.
    expect(snap.breakdown.reduce((acc, item) => acc + item.amountSen, 0)).toBe(-110000);
  });
});

describe('CashFlowService.snapshot — absent data states', () => {
  it('empty database: no accounts → available 0 and a deficit, driven by the buffer (not a crash)', async () => {
    const f = await makeFixture();
    // Give the OWNER no accounts (the fixture creates cash + credit card for
    // the owner; 'other' keeps its own) — user scoping (A10) keeps them apart.
    f.test.db.delete(accountsTable).where(eq(accountsTable.userId, f.user.id)).run();
    const snap = await f.cashflow.snapshot(now);
    expect(snap.accountCount).toBe(0);
    expect(snap.availableSen).toBe(0);
    expect(snap.spentSen).toBe(0);
    expect(snap.hasBudget).toBe(false);
    expect(snap.remainingSen).toBe(0);
    expect(snap.upcomingSen).toBe(0);
    expect(snap.upcomingItems).toEqual([]);
    // safe = 0 − 0 − 0 − 30000 (default buffer) = −30000 → deficit
    expect(snap.safeSen).toBe(-30000);
    expect(snap.deficit).toBe(true);
  });

  it('no overall budget: budget term is 0 (remaining "—"/0), metrics pct null', async () => {
    const f = await makeFixture();
    // Available stays 300000 (350000 cash − 50000 cc owed); spent 56000; rent 50000.
    insertExpenseDirect(f, 40000, f.categories[0]!.id, '2026-09-02');
    insertExpenseDirect(f, 16000, f.categories[2]!.id, '2026-09-03');
    insertCommitment(f, {
      name: 'Rent',
      type: 'rent',
      totalSen: null,
      remainingSen: 0,
      paymentSen: 50000,
      frequency: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      dueDate: '2026-09-01',
    });

    const snap = await f.cashflow.snapshot(now);
    expect(snap.hasBudget).toBe(false);
    expect(snap.budget).toBeNull();
    expect(snap.remainingSen).toBe(0); // budget term 0 (D2)
    expect(snap.budgetMetrics.pctUsed).toBeNull();
    expect(snap.budgetMetrics.overBudget).toBe(false);
    // safe = 300000 − 50000 − 0 − 30000 = 220000
    expect(snap.safeSen).toBe(220000);
    expect(snap.deficit).toBe(false);
  });
});

describe('CashFlowService.snapshot — buffer edit reflected + re-query after mutation', () => {
  it('editing the buffer through SettingsService is reflected on the next snapshot', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    expect(await f.settings.getBuffer()).toBe(30000); // default, no row
    expect((await f.cashflow.snapshot(now)).safeSen).toBe(6000);

    await f.settings.setBuffer(50000);
    // safe = 300000 − 80000 − 184000 − 50000 = −14000 → deficit now
    const snap = await f.cashflow.snapshot(now);
    expect(await f.settings.getBuffer()).toBe(50000);
    expect(snap.bufferSen).toBe(50000);
    expect(snap.safeSen).toBe(-14000);
    expect(snap.deficit).toBe(true);
  });

  it('adding an expense via the service moves available and remaining equally — safe is unchanged (PRD §8.4 property 1)', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    expect((await f.cashflow.snapshot(now)).safeSen).toBe(6000);

    // RM100 more spent from cash: available −10000, remaining −10000 → safe identical.
    await f.expenses.create(expenseInput(f, 10000, f.categories[0]!.id));

    const snap = await f.cashflow.snapshot(now);
    expect(snap.spentSen).toBe(126000);
    expect(snap.availableSen).toBe(290000); // cash 350000 → 340000, minus 50000 cc
    expect(snap.remainingSen).toBe(174000);
    expect(snap.safeSen).toBe(6000); // cancellation: spent term cancels out
    expect(snap.deficit).toBe(false);
  });
});

describe('SettingsService / SettingsRepository (plan 010 §Tests)', () => {
  it('buffer defaults to RM30000; upsert replaces in place; users are isolated', async () => {
    const f = await makeFixture();
    expect(await f.settings.getBuffer()).toBe(30000);

    await f.settings.setBuffer(45000);
    expect(await f.settings.getBuffer()).toBe(45000);
    await f.settings.setBuffer(20000); // replace
    expect(await f.settings.getBuffer()).toBe(20000);

    // Single settings row survived the replaces (PK upsert).
    const rows = f.test.db.select().from(settingsTable).all();
    expect(rows).toHaveLength(1);
    expect((rows[0] as { userId: number }).userId).toBe(f.user.id);

    // The other user's buffer stays at the default.
    const otherAuth: CurrentUserSource = { currentUser: async () => f.other };
    const otherSettings = new SettingsService(f.settingsRepo, otherAuth);
    expect(await otherSettings.getBuffer()).toBe(30000);
  });

  it('setBuffer rejects non-integer and negative values', async () => {
    const f = await makeFixture();
    await expect(f.settings.setBuffer(12.5)).rejects.toThrow('invalid safety buffer');
    await expect(f.settings.setBuffer(-1)).rejects.toThrow('invalid safety buffer');
    expect(await f.settings.getBuffer()).toBe(30000); // nothing written
  });
});
