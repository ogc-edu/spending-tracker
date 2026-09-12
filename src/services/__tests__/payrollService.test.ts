/**
 * PayrollService — the payroll-in split: validation (positive integer sen,
 * credit cards refused), user scoping, the joined plan the UI renders, and
 * deposit end-to-end against the real repositories over the Node harness.
 */
import { describe, expect, it } from '@jest/globals';
import { users } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzlePayrollRepository } from '@/repositories/drizzle/payrollRepository';
import { AccountService, type CurrentUserSource } from '@/services/AccountService';
import { PayrollService, PAYROLL_CREDIT_CARD_MESSAGE } from '@/services/PayrollService';
import type { AccountType } from '@/repositories/types';
import type { User } from '@/db/schema';

interface Fixture {
  test: TestDb;
  user: User;
  accounts: AccountService;
  service: PayrollService;
}

function makeService({ signedIn = true } = {}): Fixture {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'h' }).run();
  const user = test.db.select().from(users).get() as User;
  const accountRepo = new DrizzleAccountRepository(test.db as unknown as never);
  const payrollRepo = new DrizzlePayrollRepository(test.db as unknown as never);
  const auth: CurrentUserSource = { currentUser: async () => (signedIn ? user : null) };
  return {
    test,
    user,
    accounts: new AccountService(accountRepo, auth),
    service: new PayrollService(payrollRepo, accountRepo, auth),
  };
}

const addAccount = (f: Fixture, name: string, type: AccountType, balanceSen: number) =>
  f.accounts.create({ name, type, initialBalanceSen: balanceSen });

describe('PayrollService — setting the split', () => {
  it('allocates per account and replaces on re-set', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 0);
    await f.service.setAllocation(savings.id, 150_000);
    await f.service.setAllocation(savings.id, 180_000);

    const plan = await f.service.plan();
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0]?.account.name).toBe('Savings');
    expect(plan.totalSen).toBe(180_000);
    expect(plan.lastRunAt).toBeNull();
  });

  it('rejects zero, negative and non-integer amounts', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 0);
    for (const amount of [0, -1, 12.5]) {
      await expect(f.service.setAllocation(savings.id, amount)).rejects.toThrow('invalid payroll amount');
    }
    expect((await f.service.plan()).lines).toHaveLength(0);
  });

  it('refuses a credit card — its balance is money owed, not money held', async () => {
    const f = makeService();
    const card = await addAccount(f, 'Citi', 'credit_card', 50_000);
    await expect(f.service.setAllocation(card.id, 100_000)).rejects.toThrow(
      PAYROLL_CREDIT_CARD_MESSAGE,
    );
  });

  it('refuses an account that is not the current user\'s', async () => {
    const f = makeService();
    await expect(f.service.setAllocation(9_999, 100_000)).rejects.toThrow('Account not found');
  });

  it('removes a slice (removing an unallocated account is a no-op)', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 0);
    const spending = await addAccount(f, 'Spending', 'cash', 0);
    await f.service.setAllocation(savings.id, 150_000);

    await f.service.removeAllocation(spending.id); // never allocated
    expect((await f.service.plan()).lines).toHaveLength(1);
    await f.service.removeAllocation(savings.id);
    expect((await f.service.plan()).lines).toHaveLength(0);
  });

  it('rejects everything when not signed in', async () => {
    const { service } = makeService({ signedIn: false });
    await expect(service.plan()).rejects.toThrow('not signed in');
    await expect(service.setAllocation(1, 100)).rejects.toThrow('not signed in');
    await expect(service.removeAllocation(1)).rejects.toThrow('not signed in');
    await expect(service.deposit()).rejects.toThrow('not signed in');
  });
});

describe('PayrollService.deposit', () => {
  it('credits each account by its slice and reports the total', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 20_000);
    const spending = await addAccount(f, 'Spending', 'cash', 5_000);
    await f.service.setAllocation(savings.id, 150_000);
    await f.service.setAllocation(spending.id, 50_000);

    const result = await f.service.deposit(new Date(1_760_000_000_000));
    expect(result.depositedSen).toBe(200_000);

    const balances = Object.fromEntries((await f.accounts.list()).map((a) => [a.name, a.balanceSen]));
    expect(balances).toEqual({ Savings: 170_000, Spending: 55_000 });
    // Available money simply rises — no expense, no other row.
    expect(await f.accounts.sumBalances()).toBe(225_000);
  });

  it('stamps the run time from the caller\'s reference date', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 0);
    await f.service.setAllocation(savings.id, 1_000);

    await f.service.deposit(new Date(1_760_000_000_000));
    expect((await f.service.plan()).lastRunAt).toBe(1_760_000_000_000);
  });

  it('refuses to run with an empty split', async () => {
    const f = makeService();
    await addAccount(f, 'Savings', 'bank', 20_000);
    await expect(f.service.deposit()).rejects.toThrow('no payroll allocations');
    expect(await f.accounts.sumBalances()).toBe(20_000);
  });

  it('deposits again each time it is pressed', async () => {
    const f = makeService();
    const savings = await addAccount(f, 'Savings', 'bank', 0);
    await f.service.setAllocation(savings.id, 150_000);

    await f.service.deposit();
    await f.service.deposit();
    expect((await f.accounts.list())[0]?.balanceSen).toBe(300_000);
  });
});
