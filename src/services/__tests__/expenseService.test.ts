/**
 * Plan 005 — ExpenseService (balance math, transactions, validation, scoping,
 * E7). Uses the better-sqlite3 harness + Drizzle repositories with a stubbed
 * CurrentUserSource. Covers, per plan §Tests:
 *  - create adjusts balance: cash −amount, credit +owed (to the sen)
 *  - edit of amount/account moves money correctly (old out, new in, across
 *    accounts, both sign directions, net delta on same account)
 *  - delete reverses the effect
 *  - transaction atomicity (a failing step rolls back EVERY write)
 *  - invalid input rejected (0/negative/3-decimals/unset account/bad date/
 *    oversize description)
 *  - month boundary (prev/next-month dates not in the list; 1st/last day in)
 *  - linked expense (commitment_payment_id) edit/delete blocked + no balance
 *    side effects
 *  - user scoping (A10) — another user can neither see nor mutate the row
 */
import { describe, expect, it } from '@jest/globals';
import {
  categories as categoriesTable,
  commitmentPayments,
  commitments,
  expenses as expensesTable,
  users,
  type Account,
  type Category,
  type Commitment,
  type CommitmentPayment,
  type Expense,
  type User,
} from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { ExpenseService } from '@/services/ExpenseService';
import { EXPENSE_LINKED_READ_ONLY_MESSAGE, type ExpenseInput } from '@/repositories/types';

interface Fixture {
  test: TestDb;
  user: User;
  categories: Category[];
  cash: Account;
  credit: Account;
  accounts: DrizzleAccountRepository;
  repo: DrizzleExpenseRepository;
  service: ExpenseService;
}

/** Fresh migrated DB: one user, the 12 seeded categories, cash (RM1000) + credit card (owed RM500). */
async function makeFixture({ signedIn = true, user }: { signedIn?: boolean; user?: User } = {}): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run();
  const u = test.db.select().from(users).get() as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  const categories = test.db.select().from(categoriesTable).all() as Category[];
  const accounts = new DrizzleAccountRepository(test.db as unknown as never);
  const cash = await accounts.create({ userId: u.id, name: 'Cash', type: 'cash', initialBalanceSen: 100000 });
  const credit = await accounts.create({ userId: u.id, name: 'Card', type: 'credit_card', initialBalanceSen: 50000 });
  const repo = new DrizzleExpenseRepository(test.db as unknown as never);
  const catRepo = new DrizzleCategoryRepository(test.db as unknown as never);
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? (user ?? u) : null) };
  return { test, user: u, categories, cash, credit, accounts, repo, service: new ExpenseService(repo, catRepo, auth) };
}

/** Minimal valid input; `over` patches win. */
function input(fixture: Fixture, over: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    amountSen: 1000,
    categoryId: fixture.categories[0]!.id,
    accountId: fixture.cash.id,
    date: '2026-09-05',
    ...over,
  };
}

async function balanceOf(fixture: Fixture, account: Account): Promise<number> {
  const row = await fixture.accounts.byId(fixture.user.id, account.id);
  if (!row) throw new Error('account vanished');
  return row.balanceSen;
}

describe('ExpenseService user resolution', () => {
  it('rejects every operation when not signed in', async () => {
    const fixture = await makeFixture({ signedIn: false });
    await expect(fixture.service.create(input(fixture))).rejects.toThrow('not signed in');
    await expect(fixture.service.edit(1, input(fixture))).rejects.toThrow('not signed in');
    await expect(fixture.service.delete(1)).rejects.toThrow('not signed in');
    await expect(fixture.service.listForMonth(2026, 9)).rejects.toThrow('not signed in');
    await expect(fixture.service.byId(1)).rejects.toThrow('not signed in');
  });
});

describe('ExpenseService.create — D1 balance adjustment', () => {
  it('debits a cash account to the sen', async () => {
    const fixture = await makeFixture();
    const expense = await fixture.service.create(input(fixture, { amountSen: 12345 }));
    expect(expense.userId).toBe(fixture.user.id);
    expect(expense.amountSen).toBe(12345);
    expect(expense.date).toBe('2026-09-05');
    expect(expense.accountId).toBe(fixture.cash.id);
    expect(expense.commitmentPaymentId).toBeNull();
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 12345);
  });

  it('increases a credit card owed amount (sign convention flip)', async () => {
    const fixture = await makeFixture();
    await fixture.service.create(input(fixture, { amountSen: 9876, accountId: fixture.credit.id }));
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000 + 9876);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000); // untouched
  });

  it('stores a trimmed description, defaulting to empty', async () => {
    const fixture = await makeFixture();
    const withDesc = await fixture.service.create(input(fixture, { description: '  lunch with team  ' }));
    expect(withDesc.description).toBe('lunch with team');
    const without = await fixture.service.create(input(fixture));
    expect(without.description).toBe('');
  });
});

describe('ExpenseService.edit — deterministic balance deltas', () => {
  it('amount-only change nets the delta on the same account (no double adjustment)', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 10000 }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(90000);
    // 10000 → 25000: net −15000 → balance 75000. Neither −10000-then−25000 nor −25000 twice.
    await fixture.service.edit(id, input(fixture, { amountSen: 25000 }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(75000);
  });

  it('moves money between accounts (cash → credit): old reversed, new applied', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 5000 }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(95000);
    await fixture.service.edit(id, input(fixture, { amountSen: 5000, accountId: fixture.credit.id }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000); // old effect removed
    expect(await balanceOf(fixture, fixture.credit)).toBe(55000); // new effect applied (+owed)
  });

  it('moves money the other way (credit → cash) with the sign flip', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 7000, accountId: fixture.credit.id }));
    expect(await balanceOf(fixture, fixture.credit)).toBe(57000);
    await fixture.service.edit(id, input(fixture, { amountSen: 7000, accountId: fixture.cash.id }));
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000); // owed reversed
    expect(await balanceOf(fixture, fixture.cash)).toBe(93000); // debited
  });

  it('amount + account in ONE edit adjusts both sides exactly once', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 10000 }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(90000);
    await fixture.service.edit(id, input(fixture, { amountSen: 30000, accountId: fixture.credit.id }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
    expect(await balanceOf(fixture, fixture.credit)).toBe(80000); // owe 30000 + initial 50000
  });

  it('keeps the SAME row id (edit never duplicates, PRD note 6)', async () => {
    const fixture = await makeFixture();
    const created = await fixture.service.create(input(fixture));
    const edited = await fixture.service.edit(created.id, input(fixture, { amountSen: 2500, date: '2026-09-12' }));
    expect(edited.id).toBe(created.id);
    const rows = await fixture.test.db.select().from(expensesTable).all();
    expect(rows).toHaveLength(1);

    // End-state equals a single corrected record on a fresh DB.
    const fresh = await makeFixture();
    await fresh.service.create(input(fresh, { amountSen: 2500, date: '2026-09-12' }));
    const rowA = fixture.test.db.select().from(expensesTable).all()[0]!;
    const rowB = fresh.test.db.select().from(expensesTable).all()[0]!;
    expect(rowA.amountSen).toBe(rowB.amountSen);
    expect(rowA.date).toBe(rowB.date);
    expect(rowA.categoryId).toBe(rowB.categoryId);
    expect(rowA.accountId).toBe(rowB.accountId);
    expect(await balanceOf(fixture, fixture.cash)).toBe(await balanceOf(fresh, fresh.cash));
  });

  it('chains multiple sequential edits to the same exact final balance', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 1000 }));
    const e1 = await fixture.service.edit(id, input(fixture, { amountSen: 25000 }));
    const e2 = await fixture.service.edit(e1.id, input(fixture, { amountSen: 900, date: '2026-09-20' }));
    expect(e2.id).toBe(id);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000 - 900);

    const fresh = await makeFixture();
    await fresh.service.create(input(fresh, { amountSen: 900, date: '2026-09-20' }));
    expect(await balanceOf(fresh, fresh.cash)).toBe(100000 - 900);
  });
});

describe('ExpenseService.delete — reverses the balance effect', () => {
  it('restores a cash balance exactly', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 4321 }));
    expect(await balanceOf(fixture, fixture.cash)).toBe(95679);
    await fixture.service.delete(id);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });

  it('restores a credit card owed amount exactly', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 9876, accountId: fixture.credit.id }));
    expect(await balanceOf(fixture, fixture.credit)).toBe(59876);
    await fixture.service.delete(id);
    expect(await balanceOf(fixture, fixture.credit)).toBe(50000);
  });

  it('deleting the last expense reverts to the initial balance (no special case needed)', async () => {
    const fixture = await makeFixture();
    const a = await fixture.service.create(input(fixture, { amountSen: 100 }));
    const b = await fixture.service.create(input(fixture, { amountSen: 200 }));
    await fixture.service.delete(a.id);
    expect(await balanceOf(fixture, fixture.cash)).toBe(99800); // only a's 100 restored
    await fixture.service.delete(b.id);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });
});

describe('ExpenseService.transaction atomicity', () => {
  it('a failing step rolls back EVERY statement (insert + balance adjust)', async () => {
    const fixture = await makeFixture();
    await expect(
      fixture.repo.transaction((tx) => {
        tx.insert({
          userId: fixture.user.id,
          amountSen: 5000,
          categoryId: fixture.categories[0]!.id,
          accountId: fixture.cash.id,
          date: '2026-09-01',
          description: '',
        });
        tx.adjustBalance(fixture.user.id, fixture.cash.id, -5000);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(0);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });

  it('rejects an unknown account before anything is written (friendly FK mapping)', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.create(input(fixture, { accountId: 99999 }))).rejects.toThrow('unknown account');
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(0);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });

  it('rejects an unknown category (stale picker) before anything is written', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.create(input(fixture, { categoryId: 99999 }))).rejects.toThrow('unknown category');
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(0);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);
  });
});

describe('ExpenseService input validation (service boundary)', () => {
  it('rejects zero and negative amounts', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.create(input(fixture, { amountSen: 0 }))).rejects.toThrow('Amount must be greater than 0');
    await expect(fixture.service.create(input(fixture, { amountSen: -5 }))).rejects.toThrow('Amount must be greater than 0');
  });

  it('rejects non-integer sen (3-decimal amounts arrive as fractions)', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.create(input(fixture, { amountSen: 12.345 }))).rejects.toThrow('Amount must be whole sen');
  });

  it('requires an account (empty/unset account rejected)', async () => {
    const fixture = await makeFixture();
    await expect(
      fixture.service.create({ ...input(fixture), accountId: undefined as unknown as number }),
    ).rejects.toThrow('Account required');
  });

  it('rejects malformed and impossible dates', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.create(input(fixture, { date: '2026-13-01' }))).rejects.toThrow('Enter a real date');
    await expect(fixture.service.create(input(fixture, { date: '2026-02-30' }))).rejects.toThrow('Enter a real date');
    await expect(fixture.service.create(input(fixture, { date: '2026-9-1' }))).rejects.toThrow('YYYY-MM-DD');
  });

  it('caps the description at 200 characters', async () => {
    const fixture = await makeFixture();
    await expect(
      fixture.service.create(input(fixture, { description: 'x'.repeat(201) })),
    ).rejects.toThrow('Description must be 200 characters or fewer');
    const ok = await fixture.service.create(input(fixture, { description: 'x'.repeat(200) }));
    expect(ok.description).toHaveLength(200);
  });

  it('validates the month argument of listForMonth', async () => {
    const fixture = await makeFixture();
    await expect(fixture.service.listForMonth(2026, 0)).rejects.toThrow('invalid month');
    await expect(fixture.service.listForMonth(2026, 13)).rejects.toThrow('invalid month');
    await expect(fixture.service.listForMonth(2026, 1.5)).rejects.toThrow('invalid month');
  });
});

describe('ExpenseService.listForMonth — month boundaries', () => {
  it('includes 1st/last day, excludes previous/next month (test year: Sep 2026)', async () => {
    const fixture = await makeFixture();
    const prev = await fixture.service.create(input(fixture, { date: '2026-08-31' }));
    const first = await fixture.service.create(input(fixture, { date: '2026-09-01' }));
    const last = await fixture.service.create(input(fixture, { date: '2026-09-30' }));
    const next = await fixture.service.create(input(fixture, { date: '2026-10-01' }));

    const sep = await fixture.service.listForMonth(2026, 9);
    expect(sep.map((e) => e.id)).toEqual([last.id, first.id]); // newest first
    expect(sep.map((e) => e.id)).not.toContain(prev.id);
    expect(sep.map((e) => e.id)).not.toContain(next.id);

    expect((await fixture.service.listForMonth(2026, 8)).map((e) => e.id)).toEqual([prev.id]);
    expect((await fixture.service.listForMonth(2026, 10)).map((e) => e.id)).toEqual([next.id]);
  });
});

describe('ExpenseService E7 — linked expenses are read-only', () => {
  it('blocks edit AND delete (auto-created from a commitment payment), with no balance side effects', async () => {
    const fixture = await makeFixture();
    const [commitment] = (await (fixture.test.db
      .insert(commitments)
      .values({
        userId: fixture.user.id,
        name: 'Loan',
        type: 'other',
        totalSen: 100000,
        remainingSen: 90000,
        paymentSen: 10000,
        frequency: 'monthly',
        startDate: '2026-01-01',
        dueDate: '2026-09-01',
      })
      .returning() as unknown as Promise<Commitment[]>)) as Commitment[];
    const [payment] = (await (fixture.test.db
      .insert(commitmentPayments)
      .values({
        userId: fixture.user.id,
        commitmentId: commitment!.id,
        amountSen: 10000,
        dueDate: '2026-09-01',
        paidDate: '2026-09-01',
      })
      .returning() as unknown as Promise<CommitmentPayment[]>)) as CommitmentPayment[];
    const [linked] = (await (fixture.test.db
      .insert(expensesTable)
      .values({
        userId: fixture.user.id,
        amountSen: 10000,
        categoryId: fixture.categories[0]!.id,
        description: 'auto-created',
        date: '2026-09-05',
        accountId: fixture.cash.id,
        commitmentPaymentId: payment!.id,
      })
      .returning() as unknown as Promise<Expense[]>)) as Expense[];

    await expect(fixture.service.edit(linked!.id, input(fixture))).rejects.toThrow(
      EXPENSE_LINKED_READ_ONLY_MESSAGE,
    );
    await expect(fixture.service.delete(linked!.id)).rejects.toThrow(EXPENSE_LINKED_READ_ONLY_MESSAGE);

    // Blocked before any write: the row survives and no balance moved.
    expect(fixture.test.db.select().from(expensesTable).all()).toHaveLength(1);
    expect(await balanceOf(fixture, fixture.cash)).toBe(100000);

    // The row is still LISTED (it is a real expense — the UI shows the badge).
    const listed = await fixture.service.listForMonth(2026, 9);
    expect(listed.map((e) => e.id)).toContain(linked!.id);
  });
});

describe('ExpenseService user scoping (A10)', () => {
  it('another user can neither see nor mutate the row', async () => {
    const fixture = await makeFixture();
    const { id } = await fixture.service.create(input(fixture, { amountSen: 5000 }));

    // Second user in the SAME database (autoincrement ids must not collide).
    fixture.test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'hash' }).run();
    const other = fixture.test.db.select().from(users).all().find((u) => u.email === 'other@example.com') as User;
    expect(other.id).not.toBe(fixture.user.id);
    const accounts2 = new DrizzleAccountRepository(fixture.test.db as unknown as never);
    await accounts2.create({ userId: other.id, name: 'Other cash', type: 'cash', initialBalanceSen: 0 });
    // Same repositories, but user-scoped by the OTHER user id (A10).
    const repo2 = new DrizzleExpenseRepository(fixture.test.db as unknown as never);
    const catRepo2 = new DrizzleCategoryRepository(fixture.test.db as unknown as never);
    const service2 = new ExpenseService(repo2, catRepo2, {
      currentUser: async () => other,
    });

    expect(await service2.byId(id)).toBeNull();
    expect(await service2.listForMonth(2026, 9)).toHaveLength(0);
    await expect(service2.edit(id, input(fixture))).rejects.toThrow('expense not found');
    await expect(service2.delete(id)).rejects.toThrow('expense not found');
    expect(await balanceOf(fixture, fixture.cash)).toBe(95000); // owner's balance untouched
  });
});