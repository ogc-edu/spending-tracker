/**
 * Plan 010 / 020 — CashFlowService.snapshot integration over the harness DB
 * (better-sqlite3 + the committed migration SQL).
 *
 * Exercises the FULL orchestrator: repositories → engine → typed snapshot,
 * against hand-computed fixtures. Plan 020 removed budget / buffer /
 * safe-to-spend / daily allowance, so the snapshot now answers two questions:
 * "what did I spend this month" and "what is due by the end of it".
 *
 * Canonical fixture (September 2026):
 *   spent    = 40000 Food + 16000 Transport + 60000 paid Loan slot = 116000
 *   upcoming = 50000 Rent (09-01) + 30000 Phone (09-15)            =  80000
 *   available = 350000 cash − 50000 credit-card owed               = 300000
 *
 * Fixture construction notes:
 *  - MANUAL expenses are inserted directly (no balance adjustment) so the
 *    account balances stay exactly under the test's control.
 *  - The PAID commitment slot contributes its linked Debt/Repayment expense
 *    to spent (D3) and is EXCLUDED from upcoming (PRD §8.3 double-counting):
 *    a slot is in exactly one of the two, never both, never neither.
 *  - Upcoming is "due before next month start" — OVERDUE unpaid slots are
 *    included, next month's slots are not.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { eq } from 'drizzle-orm';
import {
  accounts as accountsTable,
  categories as categoriesTable,
  commitmentPayments as commitmentPaymentsTable,
  commitments as commitmentsTable,
  expenses as expensesTable,
  users,
  type Account,
  type Category,
  type Commitment,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { DrizzleCreditBillRepository } from '@/repositories/drizzle/creditBillRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { CashFlowService } from '@/services/CashFlowService';
import { CommitmentService } from '@/services/CommitmentService';
import { CreditBillService } from '@/services/CreditBillService';
import { ExpenseService } from '@/services/ExpenseService';
import type { ExpenseInput } from '@/repositories/types';

/** The September 2026 month window, `now` = the 1st. */
const now = new Date(2026, 8, 1); // local: 2026-09-01

interface Fixture {
  test: TestDb;
  user: User;
  other: User;
  categories: Category[];
  cash: Account;
  cashflow: CashFlowService;
  expenses: ExpenseService;
  commitments: CommitmentService;
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
  const catRepo = new DrizzleCategoryRepository(test.db as unknown as never);
  const commitmentRepo = new DrizzleCommitmentRepository(test.db as unknown as never);
  const expenseRepo = new DrizzleExpenseRepository(test.db as unknown as never);

  const acting = as === 'owner' ? user : other;
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? acting : null) };

  // Owner: RM3,500 cash + a credit card owing RM500 → available RM3,000.
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
    cashflow: new CashFlowService(accountRepo, expenseRepo, commitmentRepo, auth),
    expenses: new ExpenseService(expenseRepo, catRepo, auth),
    commitments: new CommitmentService(commitmentRepo, auth),
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
 * The canonical fixture (see the module header): RM1,160 spent = 116000 sen
 * (RM400 Food + RM160 Transport + RM600 paid Loan) and unpaid commitments of
 * RM800 (RM500 rent + RM300 phone) plus the PAID Loan slot.
 */
async function seedCanonicalFixture(f: Fixture): Promise<void> {
  const { user, categories } = f;
  const foodId = categories[0]!.id; // Food
  const transportId = categories[2]!.id; // Transport

  // Manual September expenses: RM400 Food + RM160 Transport = RM560.
  insertExpenseDirect(f, 40000, foodId, '2026-09-02');
  insertExpenseDirect(f, 16000, transportId, '2026-09-03');

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

afterEach(() => {
  jest.useRealTimers();
});

describe('CashFlowService.snapshot — canonical fixture', () => {
  it('spent, due by end of month and available match the hand-computed numbers', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);

    const snap = await f.cashflow.snapshot(now);

    // available = 350000 (cash) − 50000 (credit-card owed) = 300000
    expect(snap.availableSen).toBe(300000);
    // spent = 40000 + 16000 + 60000 (paid Loan expense) = 116000
    expect(snap.spentSen).toBe(116000);
    // upcoming = 50000 (rent) + 30000 (phone) = 80000; the paid Loan slot is excluded.
    expect(snap.upcomingSen).toBe(80000);
    // month scope derived from `now`
    expect(snap.month).toEqual({ month: 9, year: 2026 });
    expect(snap.accountCount).toBe(2);
  });

  it('carries no budget / buffer / safe-to-spend / allowance terms (plan 020)', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const snap = await f.cashflow.snapshot(now);
    for (const removed of [
      'budget',
      'hasBudget',
      'remainingSen',
      'bufferSen',
      'safeSen',
      'deficit',
      'dailyAllowanceSen',
      'breakdown',
      'budgetMetrics',
    ]) {
      expect(snap).not.toHaveProperty(removed);
    }
  });

  it('upcoming items are due-date ascending with DB names, and the summary is sorted', async () => {
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

describe('CashFlowService.snapshot — due by end of month', () => {
  it('includes OVERDUE unpaid slots and excludes next month\u2019s', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    // Late in the month: Rent (09-01) and Phone (09-15) are both overdue, still unpaid.
    const snap = await f.cashflow.snapshot(new Date(2026, 8, 25));
    expect(snap.upcomingSen).toBe(80000);
    expect(snap.upcomingItems.map((item) => item.dueDate)).toEqual(['2026-09-01', '2026-09-15']);
    // October's Rent and Loan slots are next month — never in this month's total.
    expect(snap.upcomingItems.some((item) => item.dueDate >= '2026-10-01')).toBe(false);
  });

  it('marking a slot paid moves it from due to spent exactly once (PRD §8.3 partition)', async () => {
    jest.useFakeTimers({
      now: new Date(2026, 8, 10),
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    const f = await makeFixture();
    await seedCanonicalFixture(f);
    const before = await f.cashflow.snapshot(new Date(2026, 8, 10));
    const rent = before.upcomingItems.find((item) => item.name === 'Rent')!;

    // Paid from cash: linked Debt/Repayment expense dated today (09-10).
    await f.commitments.markPaid(rent.commitmentId, rent.dueDate, f.cash.id);

    const after = await f.cashflow.snapshot(new Date(2026, 8, 10));
    expect(after.upcomingSen).toBe(before.upcomingSen - 50000);
    expect(after.spentSen).toBe(before.spentSen + 50000);
    // spent + due is invariant: the slot is counted in exactly one of them.
    expect(after.spentSen + after.upcomingSen).toBe(before.spentSen + before.upcomingSen);
    expect(after.upcomingItems.map((item) => item.name)).toEqual(['Phone bill']);
    // The cash account paid it: available drops by the same amount.
    expect(after.availableSen).toBe(before.availableSen - 50000);
  });
});

describe('CashFlowService.snapshot — absent data and scoping', () => {
  it('empty database: no accounts → every figure 0 (not a crash)', async () => {
    const f = await makeFixture();
    // Give the OWNER no accounts (the fixture creates cash + credit card for
    // the owner; 'other' keeps its own) — user scoping (A10) keeps them apart.
    f.test.db.delete(accountsTable).where(eq(accountsTable.userId, f.user.id)).run();
    const snap = await f.cashflow.snapshot(now);
    expect(snap.accountCount).toBe(0);
    expect(snap.availableSen).toBe(0);
    expect(snap.spentSen).toBe(0);
    expect(snap.upcomingSen).toBe(0);
    expect(snap.upcomingItems).toEqual([]);
    expect(snap.nextMonthItems).toEqual([]);
    expect(snap.categorySummary).toEqual([]);
  });

  it('another user sees none of the owner\u2019s spending or commitments (A10)', async () => {
    const owner = await makeFixture();
    await seedCanonicalFixture(owner);
    const otherView = new CashFlowService(
      new DrizzleAccountRepository(owner.test.db as unknown as never),
      new DrizzleExpenseRepository(owner.test.db as unknown as never),
      new DrizzleCommitmentRepository(owner.test.db as unknown as never),
      { currentUser: async () => owner.other },
    );
    const snap = await otherView.snapshot(now);
    expect(snap.spentSen).toBe(0);
    expect(snap.upcomingSen).toBe(0);
    expect(snap.availableSen).toBe(100000);
    expect(snap.accountCount).toBe(1);
  });

  it('rejects when not signed in', async () => {
    const f = await makeFixture({ signedIn: false });
    await expect(f.cashflow.snapshot(now)).rejects.toThrow('not signed in');
  });
});

describe('CashFlowService.snapshot — re-query after mutation', () => {
  it('adding an expense via the service moves spent up and available down by the same amount', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);

    // RM100 more spent from cash.
    await f.expenses.create(expenseInput(f, 10000, f.categories[0]!.id));

    const snap = await f.cashflow.snapshot(now);
    expect(snap.spentSen).toBe(126000);
    expect(snap.availableSen).toBe(290000); // cash 350000 → 340000, minus 50000 cc
    expect(snap.upcomingSen).toBe(80000); // spending never touches what is due
  });
});

describe('CashFlowService.snapshot — credit bills (Plan 020 Phase B)', () => {
  it('incorporates unpaid credit bills due on or before month end into upcomingSen and upcomingItems', async () => {
    const f = await makeFixture();
    await seedCanonicalFixture(f);

    const creditBillRepo = new DrizzleCreditBillRepository(f.test.db as unknown as never);
    const accountRepo = new DrizzleAccountRepository(f.test.db as unknown as never);
    const expenseRepo = new DrizzleExpenseRepository(f.test.db as unknown as never);
    const commitmentRepo = new DrizzleCommitmentRepository(f.test.db as unknown as never);
    const auth: CurrentUserSource = { currentUser: async () => f.user };
    const billService = new CreditBillService(accountRepo, expenseRepo, creditBillRepo, auth);
    const cashflowWithBills = new CashFlowService(accountRepo, expenseRepo, commitmentRepo, auth, billService);

    // Create an SPL account: statement 20, due 30
    const spl = await accountRepo.create({
      userId: f.user.id,
      name: 'ShopeePayLater',
      type: 'paylater',
      initialBalanceSen: 0,
      statementDay: 20,
      dueDay: 30,
    });

    // Add an expense on SPL on 2026-09-05 for RM150 (15000 sen).
    // Statement day is 20, so cycle closes 2026-09-20, due 2026-09-30 (September bill).
    await f.expenses.create({
      amountSen: 15000,
      categoryId: f.categories[0]!.id,
      accountId: spl.id,
      date: '2026-09-05',
    });

    const snap = await cashflowWithBills.snapshot(new Date(2026, 8, 25)); // 25 Sep

    // Canonical commitments upcoming was 80000 sen.
    // Now with SPL bill of 15000 sen due 2026-09-30: upcomingSen = 80000 + 15000 = 95000 sen.
    expect(snap.upcomingSen).toBe(95000);

    const billItem = snap.upcomingItems.find((item) => item.kind === 'credit_bill');
    expect(billItem).toBeDefined();
    expect(billItem?.name).toBe('ShopeePayLater Bill');
    expect(billItem?.dueDate).toBe('2026-09-30');
    expect(billItem?.amountSen).toBe(15000);
  });
});

