/**
 * Plan 008 — CommitmentService (mark-paid tx, un-pay reversal, C1 archive vs
 * hard delete, auto-complete, scoping). Uses the better-sqlite3 harness +
 * Drizzle repositories with a stubbed CurrentUserSource. Covers, per plan
 * §Tests:
 *  - create: fixed (remaining = total) / ongoing / one-time normalization,
 *    validation (fixed XOR ongoing, payment > 0, sane dates)
 *  - mark-paid: all four writes land (payment + expense + balance + remaining);
 *    asset − / credit + balance math; null account → no adjustment (A15);
 *    idempotency (double-mark blocked); unknown account/slot/category guards
 *  - un-pay: full reversal incl. balance; completed → active reopen;
 *    un-pay-then-re-pay gets a fresh expense (no duplication)
 *  - cancel terminal; C1 archive vs hard delete + unarchive
 *  - upcoming: paid/cancelled/archived excluded, overdue included
 *  - user isolation (A10)
 */
import { describe, expect, it } from '@jest/globals';
import {
  categories as categoriesTable,
  commitmentPayments,
  expenses as expensesTable,
  users,
  type Account,
  type Category,
  type Commitment,
  type Expense,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { CommitmentService, DEBT_REPAYMENT_CATEGORY_NAME } from '@/services/CommitmentService';
import type { CommitmentInput } from '@/repositories/types';
import { addMonthsClamped, todayLocal } from '@/utils/dates';

interface Fixture {
  test: TestDb;
  user: User;
  debtCategory: Category;
  cash: Account;
  credit: Account;
  accounts: DrizzleAccountRepository;
  repo: DrizzleCommitmentRepository;
  service: CommitmentService;
}

/** Fixed RM1,200 total / RM400 monthly, anchored 2026-09-01 (3 slots). */
function fixedInput(over: Partial<CommitmentInput> = {}): CommitmentInput {
  return {
    name: 'Phone installment',
    type: 'installment',
    totalSen: 120000,
    paymentSen: 40000,
    frequency: 'monthly',
    startDate: '2026-09-01',
    endDate: null,
    dueDate: '2026-09-01',
    ...over,
  };
}

/** Fresh migrated DB: one user, seeded categories, cash RM1,000 + credit owed RM500. */
async function makeFixture({ signedIn = true, user }: { signedIn?: boolean; user?: User } = {}): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run();
  const u = test.db.select().from(users).get() as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  const categories = test.db.select().from(categoriesTable).all() as Category[];
  const debtCategory = categories.find((c) => c.name === DEBT_REPAYMENT_CATEGORY_NAME) as Category;
  const accounts = new DrizzleAccountRepository(test.db as unknown as never);
  const cash = await accounts.create({ userId: u.id, name: 'Cash', type: 'cash', initialBalanceSen: 100000 });
  const credit = await accounts.create({ userId: u.id, name: 'Card', type: 'credit_card', initialBalanceSen: 50000 });
  const repo = new DrizzleCommitmentRepository(test.db as unknown as never);
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? (user ?? u) : null) };
  return { test, user: u, debtCategory, cash, credit, accounts, repo, service: new CommitmentService(repo, auth) };
}

async function balanceOf(fixture: Fixture, account: Account): Promise<number> {
  const row = await fixture.accounts.byId(fixture.user.id, account.id);
  if (!row) throw new Error('account vanished');
  return row.balanceSen;
}

async function createFixed(fixture: Fixture, over: Partial<CommitmentInput> = {}): Promise<Commitment> {
  return fixture.service.create(fixedInput(over));
}

describe('CommitmentService user resolution', () => {
  it('rejects every operation when not signed in', async () => {
    const fixture = await makeFixture({ signedIn: false });
    await expect(fixture.service.create(fixedInput())).rejects.toThrow('not signed in');
    await expect(fixture.service.markPaid(1, '2026-09-01')).rejects.toThrow('not signed in');
    await expect(fixture.service.unPay(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.cancel(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.delete(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.unarchive(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.byId(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.list()).rejects.toThrow('not signed in');
    await expect(fixture.service.upcoming('2026-12-01')).rejects.toThrow('not signed in');
  });
});

describe('CommitmentService.create — shapes & validation', () => {
  it('fixed monthly: remaining = total, due date mirrors the anchor, end date kept', async () => {
    const fixture = await makeFixture();
    const c = await createFixed(fixture, { endDate: '2026-11-01' });
    expect(c).toMatchObject({
      name: 'Phone installment',
      type: 'installment',
      totalSen: 120000,
      remainingSen: 120000,
      paymentSen: 40000,
      frequency: 'monthly',
      startDate: '2026-09-01',
      dueDate: '2026-09-01',
      endDate: '2026-11-01',
      status: 'active',
      archivedAt: null,
    });
  });

  it('ongoing monthly: total null, remaining 0, end date stays null', async () => {
    const fixture = await makeFixture();
    const c = await fixture.service.create(
      fixedInput({ totalSen: null, name: 'Rent', type: 'rent' }),
    );
    expect(c.totalSen).toBeNull();
    expect(c.remainingSen).toBe(0);
    expect(c.endDate).toBeNull();
  });

  it('one-time: total null, remaining 0, start date mirrors the due date', async () => {
    const fixture = await makeFixture();
    const c = await fixture.service.create(
      fixedInput({ totalSen: null, frequency: 'one_time', name: 'Loan repayment', type: 'owed', dueDate: '2026-09-30', startDate: '2026-01-01' }),
    );
    expect(c.totalSen).toBeNull();
    expect(c.remainingSen).toBe(0);
    expect(c.startDate).toBe('2026-09-30');
    expect(c.dueDate).toBe('2026-09-30');
  });

  it('rejects fixed+one-time, ongoing+end-date, inverted dates, bad money/names', async () => {
    const fixture = await makeFixture();
    // Fixed XOR ongoing: a one-time commitment cannot carry a total.
    await expect(fixture.service.create(fixedInput({ frequency: 'one_time' }))).rejects.toThrow(
      'One-time commitments have no total',
    );
    // Ongoing has no end date.
    await expect(
      fixture.service.create(fixedInput({ totalSen: null, endDate: '2027-01-01' })),
    ).rejects.toThrow('Ongoing commitments have no end date');
    // Sane dates.
    await expect(fixture.service.create(fixedInput({ endDate: '2026-08-01' }))).rejects.toThrow(
      'End date must not be before the start date',
    );
    await expect(fixture.service.create(fixedInput({ startDate: '2026-02-30' }))).rejects.toThrow(
      'Enter a real start date',
    );
    // Payment > 0.
    await expect(fixture.service.create(fixedInput({ paymentSen: 0 }))).rejects.toThrow(
      'Payment must be greater than 0',
    );
    await expect(fixture.service.create(fixedInput({ paymentSen: -5 }))).rejects.toThrow(
      'Payment must be greater than 0',
    );
    await expect(fixture.service.create(fixedInput({ totalSen: 0 }))).rejects.toThrow(
      'Total must be greater than 0',
    );
    // Name required (trimmed).
    await expect(fixture.service.create(fixedInput({ name: '   ' }))).rejects.toThrow('Name required');
    // Unknown type.
    await expect(
      fixture.service.create(fixedInput({ type: 'mystery' as never })),
    ).rejects.toThrow();
    // No rows were written by any rejection.
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(0);
  });
});

describe('CommitmentService.markPaid — D3 transaction', () => {
  it('marks a fixed slot paid: payment + linked expense + cash debit + remaining decrement', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);

    const payment = await fixture.service.markPaid(commitment.id, '2026-10-01', fixture.cash.id);

    expect(payment).toMatchObject({
      commitmentId: commitment.id,
      amountSen: 40000,
      dueDate: '2026-10-01',
      paidDate: todayLocal(),
      status: 'paid',
    });
    // Exactly one linked expense with the unique link, in Debt / Repayment.
    const rows = fixture.test.db.select().from(expensesTable).all() as Expense[];
    const expense = rows.find((row) => row.commitmentPaymentId === payment.id);
    expect(rows).toHaveLength(1);
    expect(expense?.amountSen).toBe(40000);
    expect(expense?.categoryId).toBe(fixture.debtCategory.id);
    expect(expense?.description).toBe('Phone installment');
    expect(expense?.date).toBe(todayLocal());
    expect(expense?.accountId).toBe(fixture.cash.id);
    // Balance & remaining moved together.
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 40000);
    expect((await fixture.service.byId(commitment.id))?.remainingSen).toBe(80000);
  });

  it('increases a credit card owed amount (sign convention)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.credit.id);
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000 + 40000);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000); // untouched
  });

  it('null account (A15): no balance adjustment; the linked expense has no account', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const payment = await fixture.service.markPaid(commitment.id, '2026-09-01');
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000);
    const expense = fixture.test.db.select().from(expensesTable).get();
    expect(expense?.accountId).toBeNull();
    expect(expense?.commitmentPaymentId).toBe(payment.id);
  });

  it('is idempotent: a second mark of the same slot is blocked with no new rows', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await expect(fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id)).rejects.toThrow(
      'payment already recorded',
    );
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(1);
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(1);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 40000); // not debited twice
  });

  it('rejects an unknown slot date (not on the derived grid)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await expect(fixture.service.markPaid(commitment.id, '2026-09-15', fixture.cash.id)).rejects.toThrow(
      'no payment due on 2026-09-15',
    );
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(0);
  });

  it('rejects an unknown account (stale picker, A15 mapping)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await expect(fixture.service.markPaid(commitment.id, '2026-09-01', 99999)).rejects.toThrow(
      'unknown account',
    );
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(0);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });

  it('blocks marking a cancelled commitment', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.cancel(commitment.id);
    await expect(fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id)).rejects.toThrow(
      'commitment is cancelled',
    );
  });

  it('blocks marking an archived commitment', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.delete(commitment.id); // → archived (C1)
    await expect(fixture.service.markPaid(commitment.id, '2026-10-01', fixture.cash.id)).rejects.toThrow(
      'commitment is archived',
    );
  });

  it('auto-completes when remaining reaches 0 (COM-6)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture); // 3 × 40000
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.markPaid(commitment.id, '2026-10-01', fixture.cash.id);
    expect((await fixture.service.byId(commitment.id))?.status).toBe('active');
    await fixture.service.markPaid(commitment.id, '2026-11-01', fixture.cash.id);
    const after = await fixture.service.byId(commitment.id);
    expect(after?.remainingSen).toBe(0);
    expect(after?.status).toBe('completed');
  });
});

describe('CommitmentService.unPay — full reversal (E7 counterpart)', () => {
  it('reverses everything: expense gone, payment gone, remaining and balance restored', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const payment = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    expect(await balanceOf(fixture, fixture.cash)).toBe(60000);

    await fixture.service.unPay(payment.id);

    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(0);
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(0);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
    expect((await fixture.service.byId(commitment.id))?.remainingSen).toBe(120000);
    expect((await fixture.service.byId(commitment.id))?.status).toBe('active');
  });

  it('reverses a credit-card owed increase exactly', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const payment = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.credit.id);
    expect(await balanceOf(fixture, fixture.credit)).toBe(90000);
    await fixture.service.unPay(payment.id);
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000);
  });

  it('mid-schedule un-pay keeps the other paid slots intact', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const first = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.markPaid(commitment.id, '2026-10-01', fixture.cash.id);
    await fixture.service.unPay(first.id);
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(1);
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(1);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 40000); // only the second slot's debit
    expect((await fixture.service.byId(commitment.id))?.remainingSen).toBe(80000); // 120000 − 40000 (second slot stays paid)
  });

  it('reopens a completed commitment when the last payment is un-paid', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.markPaid(commitment.id, '2026-10-01', fixture.cash.id);
    const last = await fixture.service.markPaid(commitment.id, '2026-11-01', fixture.cash.id);
    expect((await fixture.service.byId(commitment.id))?.status).toBe('completed');

    await fixture.service.unPay(last.id);
    const after = await fixture.service.byId(commitment.id);
    expect(after?.remainingSen).toBe(40000);
    expect(after?.status).toBe('active');
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(2);
  });

  it('un-pay then re-pay: the old link is gone, the new expense is fresh — no duplication', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const payment = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.unPay(payment.id);
    const again = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    const rows = fixture.test.db.select().from(expensesTable).all() as Expense[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commitmentPaymentId).toBe(again.id);
    expect(rows[0]?.commitmentPaymentId).not.toBe(payment.id); // old link gone with the payment
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 40000);
  });

  it('rejects an unknown payment id', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.unPay(9999)).rejects.toThrow('payment not found');
  });
});

describe('CommitmentService.cancel — terminal', () => {
  it('cancels while keeping paid history (payment + linked expense stay)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);

    await fixture.service.cancel(commitment.id);

    expect((await fixture.service.byId(commitment.id))?.status).toBe('cancelled');
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(1);
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(1);
    // The paid record is still visible on the detail view.
    expect(await fixture.service.paymentsForCommitment(commitment.id)).toHaveLength(1);
  });

  it('is terminal: a cancelled commitment stays cancelled (no re-activation path)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.cancel(commitment.id);
    await fixture.service.cancel(commitment.id); // idempotent
    expect((await fixture.service.byId(commitment.id))?.status).toBe('cancelled');
  });

  it('rejects a missing commitment (user-scoped)', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.cancel(9999)).rejects.toThrow('commitment not found');
  });
});

describe('CommitmentService.schedule — bounded derivation', () => {
  it('ongoing commitments default to a today+12-month window (no unbounded series)', async () => {
    const fixture = await makeFixture();
    const rent = await fixture.service.create(
      fixedInput({ totalSen: null, name: 'Rent', type: 'rent', startDate: '2026-01-15' }),
    );
    const slots = await fixture.service.schedule(rent.id);
    // Finite (never the full infinite series) and anchored on the 15th.
    expect(slots.length).toBeGreaterThanOrEqual(12);
    expect(slots.every((s) => s.dueDate.endsWith('-15'))).toBe(true);
    // The default window is today + 12 months (exclusive end).
    const windowEnd = addMonthsClamped(todayLocal(), 12);
    expect(slots.every((s) => s.dueDate < windowEnd)).toBe(true);
  });

  it('an explicit `to` narrows the window (fixed schedules included)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture); // Sep/Oct/Nov 2026
    const slots = await fixture.service.schedule(commitment.id, '2026-10-01');
    expect(slots.map((s) => s.dueDate)).toEqual(['2026-09-01']); // < Oct 1
  });
});

describe('CommitmentService.delete — C1 archive vs hard delete', () => {
  it('hard-deletes a zero-payment commitment', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const result = await fixture.service.delete(commitment.id);
    expect(result).toEqual({ action: 'deleted' });
    expect(await fixture.service.byId(commitment.id)).toBeNull();
    expect(await fixture.service.list()).toHaveLength(0);
  });

  it('archives a commitment WITH paid payments — every row stays', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);

    const result = await fixture.service.delete(commitment.id);

    expect(result).toEqual({ action: 'archived' });
    const archived = await fixture.service.byId(commitment.id);
    expect(archived?.archivedAt).not.toBeNull();
    expect(await fixture.service.list()).toHaveLength(0); // hidden from the tab
    expect(await fixture.service.listArchived()).toHaveLength(1);
    // History is preserved: paid record + linked expense + balance all intact.
    expect(await fixture.service.paymentsForCommitment(commitment.id)).toHaveLength(1);
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(1);
    expect(await balanceOf(fixture, fixture.cash)).toBe(60000);
  });

  it('unarchive restores the commitment to the main list; archived is excluded from future marks', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.delete(commitment.id); // → archived
    await fixture.service.unarchive(commitment.id);
    expect((await fixture.service.byId(commitment.id))?.archivedAt).toBeNull();
    const listed = await fixture.service.list();
    expect(listed.map((c) => c.id)).toContain(commitment.id);
    // Paid history survived the archive round-trip.
    expect(await fixture.service.paymentsForCommitment(commitment.id)).toHaveLength(1);
  });

  it('rejects deleting a missing commitment (user-scoped)', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.delete(9999)).rejects.toThrow('commitment not found');
  });
});

describe('CommitmentService.upcoming — due before window end (COM-5)', () => {
  it('sums unpaid slots before next-month start: paid excluded, overdue included', async () => {
    const fixture = await makeFixture();
    // 3-slot fixed (Sep/Oct/Nov) + an ongoing rent (Aug onward).
    const installment = await createFixed(fixture);
    const rent = await fixture.service.create(
      fixedInput({ totalSen: null, name: 'Rent', type: 'rent', startDate: '2026-08-10', paymentSen: 150000 }),
    );
    // Pay Sep installment + Sep rent: both must vanish from the window.
    await fixture.service.markPaid(installment.id, '2026-09-01', fixture.cash.id);
    await fixture.service.markPaid(rent.id, '2026-09-10', fixture.cash.id);

    const result = await fixture.service.upcoming('2026-12-01'); // before December

    // Fixed: Oct + Nov (unpaid). Rent: Aug 10 (OVERDUE, unpaid — included),
    // Oct 10 + Nov 10. Sep slots are paid; nothing due ON/AFTER Dec 1.
    const dates = result.items.map((i) => i.dueDate).sort();
    expect(dates).toEqual(['2026-08-10', '2026-10-01', '2026-10-10', '2026-11-01', '2026-11-10']);
    expect(result.totalSen).toBe(40000 + 40000 + 150000 + 150000 + 150000);
  });

  it('excludes cancelled and archived commitments from the window', async () => {
    const fixture = await makeFixture();
    const active = await createFixed(fixture);
    const cancelled = await createFixed(fixture, { name: 'Cancelled loan', totalSen: 50000, paymentSen: 50000 });
    const archived = await createFixed(fixture, { name: 'Archived bill', totalSen: 80000, paymentSen: 40000 });
    await fixture.service.cancel(cancelled.id);
    await fixture.service.markPaid(archived.id, '2026-09-01', fixture.cash.id);
    await fixture.service.delete(archived.id); // → archived

    const result = await fixture.service.upcoming('2026-12-01');
    expect(result.items).toHaveLength(3); // Sep/Oct/Nov of the active fixed
    expect(result.items.every((i) => i.commitment.id === active.id)).toBe(true);
    expect(result.totalSen).toBe(120000);
  });
});

describe('CommitmentService user isolation (A10)', () => {
  it("another user can neither see nor mutate the owner's commitments", async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    const payment = await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id);

    // Second user in the SAME database (autoincrement ids must not collide).
    fixture.test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'hash' }).run();
    const other = fixture.test.db.select().from(users).all().find((u) => u.email === 'other@example.com') as User;
    const repo2 = new DrizzleCommitmentRepository(fixture.test.db as unknown as never);
    const service2 = new CommitmentService(repo2, { currentUser: async () => other });

    expect(await service2.byId(commitment.id)).toBeNull();
    expect(await service2.list()).toHaveLength(0);
    expect(await service2.listArchived()).toHaveLength(0);
    expect(await service2.allPaidPayments()).toHaveLength(0);
    await expect(service2.markPaid(commitment.id, '2026-10-01')).rejects.toThrow('commitment not found');
    await expect(service2.unPay(payment.id)).rejects.toThrow('payment not found');
    await expect(service2.cancel(commitment.id)).rejects.toThrow('commitment not found');
    await expect(service2.delete(commitment.id)).rejects.toThrow('commitment not found');
    await expect(service2.upcoming('2026-12-01')).resolves.toEqual({ totalSen: 0, items: [] });

    // The owner's rows are untouched by the outsider's attempts.
    expect((await fixture.service.byId(commitment.id))?.status).toBe('active');
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(1);
  });
});

describe('CommitmentService.update (plan 016 follow-up — edit)', () => {
  it('edits name/type/end date and recomputes remaining from paid history', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01', fixture.cash.id); // 40,000 paid

    const edited = await fixture.service.update(commitment.id, fixedInput({
      name: 'Phone installment v2',
      type: 'bnpl',
      // New total lower than original — remaining = newTotal − paidSum.
      totalSen: 100000,
      endDate: '2026-12-01',
    }));
    expect(edited.name).toBe('Phone installment v2');
    expect(edited.type).toBe('bnpl');
    expect(edited.endDate).toBe('2026-12-01');
    expect(edited.totalSen).toBe(100000);
    expect(edited.remainingSen).toBe(60000); // 100,000 − 40,000 paid
    // The paid record survived untouched.
    expect(fixture.test.db.select().from(commitmentPayments).all()).toHaveLength(1);
  });

  it('changes payment amount and re-derives the remaining (paid sum unaffected)', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01'); // 40,000 paid, no account

    const edited = await fixture.service.update(commitment.id, fixedInput({ paymentSen: 20000 }));
    expect(edited.paymentSen).toBe(20000);
    expect(edited.remainingSen).toBe(80000); // 120,000 − 40,000 (paid at the OLD amount)
  });

  it('reopens a completed commitment when the new total is not paid down', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.markPaid(commitment.id, '2026-09-01');
    await fixture.service.markPaid(commitment.id, '2026-10-01');
    await fixture.service.markPaid(commitment.id, '2026-11-01'); // remaining → 0 → completed
    expect((await fixture.service.byId(commitment.id))?.status).toBe('completed');

    const edited = await fixture.service.update(commitment.id, fixedInput({ totalSen: 150000 }));
    expect(edited.status).toBe('active');
    expect(edited.remainingSen).toBe(30000); // 150,000 − 120,000 paid
  });

  it('edits ongoing ↔ fixed shape normalization (end date appears/disappears)', async () => {
    const fixture = await makeFixture();
    const ongoing = await fixture.service.create({
      name: 'Rent',
      type: 'rent',
      totalSen: null,
      paymentSen: 60000,
      frequency: 'monthly',
      startDate: '2026-09-01',
      endDate: null,
      dueDate: '2026-09-01',
    });
    // Ongoing → fixed: add a total + end date.
    const fixed = await fixture.service.update(ongoing.id, {
      name: 'Rent v2',
      type: 'rent',
      totalSen: 360000,
      paymentSen: 60000,
      frequency: 'monthly',
      startDate: '2026-09-01',
      endDate: '2027-02-01',
      dueDate: '2026-09-01',
    });
    expect(fixed.totalSen).toBe(360000);
    expect(fixed.endDate).toBe('2027-02-01');
    expect(fixed.remainingSen).toBe(360000);
  });

  it('rejects edits to cancelled and archived commitments', async () => {
    const fixture = await makeFixture();
    const commitment = await createFixed(fixture);
    await fixture.service.cancel(commitment.id);
    await expect(fixture.service.update(commitment.id, fixedInput())).rejects.toThrow(
      "Cancelled commitments can't be edited",
    );

    const fresh = await createFixed(fixture);
    await fixture.service.markPaid(fresh.id, '2026-09-01');
    await fixture.service.delete(fresh.id); // has payments → archived
    await expect(fixture.service.update(fresh.id, fixedInput())).rejects.toThrow(
      "Archived commitments can't be edited",
    );
  });

  it('keeps one-time edits on the due date', async () => {
    const fixture = await makeFixture();
    const oneTime = await fixture.service.create({
      name: 'SPL settle',
      type: 'bnpl',
      totalSen: null,
      paymentSen: 96500,
      frequency: 'one_time',
      startDate: '2026-10-01',
      endDate: null,
      dueDate: '2026-10-01',
    });
    const edited = await fixture.service.update(oneTime.id, {
      name: 'SPL settle (final)',
      type: 'bnpl',
      totalSen: null,
      paymentSen: 100000,
      frequency: 'one_time',
      startDate: '2026-11-01',
      endDate: null,
      dueDate: '2026-11-01',
    });
    expect(edited.dueDate).toBe('2026-11-01');
    expect(edited.startDate).toBe('2026-11-01');
    expect(edited.totalSen).toBeNull();
    expect(edited.remainingSen).toBe(0);
  });
});