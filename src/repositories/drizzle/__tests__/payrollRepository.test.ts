/**
 * Drizzle PayrollRepository against the better-sqlite3 harness. Covers: the
 * one-row-per-account upsert, user scoping, the FK cascade that drops an
 * allocation when its account is deleted, and the deposit transaction —
 * every allocated account credited, the run stamped, and a rollback (no
 * partial credit) when a statement inside it fails.
 */
import { describe, expect, it } from '@jest/globals';
import { accounts as accountsTable, payrollAllocations, settings, users } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzlePayrollRepository } from '@/repositories/drizzle/payrollRepository';
import type { Account } from '@/db/schema';

interface Fixture {
  test: TestDb;
  userId: number;
  otherUserId: number;
  accounts: DrizzleAccountRepository;
  payroll: DrizzlePayrollRepository;
}

function fixture(): Fixture {
  const test = createMigratedTestDb();
  const userId = Number(
    test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'h' }).run().lastInsertRowid,
  );
  const otherUserId = Number(
    test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'h' }).run().lastInsertRowid,
  );
  return {
    test,
    userId,
    otherUserId,
    accounts: new DrizzleAccountRepository(test.db as unknown as never),
    payroll: new DrizzlePayrollRepository(test.db as unknown as never),
  };
}

const account = (f: Fixture, userId: number, name: string, balanceSen: number): Promise<Account> =>
  f.accounts.create({ userId, name, type: 'bank', initialBalanceSen: balanceSen });

describe('PayrollRepository — the split', () => {
  it('stores one row per account and replaces the amount on re-set', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 0);

    await f.payroll.upsert(f.userId, savings.id, 150_000);
    await f.payroll.upsert(f.userId, savings.id, 180_000); // changed their mind

    const list = await f.payroll.list(f.userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.amountSen).toBe(180_000);
  });

  it('keeps each user\'s split separate', async () => {
    const f = fixture();
    const mine = await account(f, f.userId, 'Savings', 0);
    const theirs = await account(f, f.otherUserId, 'Their savings', 0);
    await f.payroll.upsert(f.userId, mine.id, 100_000);
    await f.payroll.upsert(f.otherUserId, theirs.id, 999_000);

    expect(await f.payroll.list(f.userId)).toHaveLength(1);
    expect((await f.payroll.list(f.userId))[0]?.amountSen).toBe(100_000);
  });

  it('removes a slice, and deleting the account cascades its slice away', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 0);
    const spending = await account(f, f.userId, 'Spending', 0);
    await f.payroll.upsert(f.userId, savings.id, 150_000);
    await f.payroll.upsert(f.userId, spending.id, 50_000);

    await f.payroll.remove(f.userId, spending.id);
    expect(await f.payroll.list(f.userId)).toHaveLength(1);

    // The account goes → so does its allocation (config, not history).
    await f.accounts.delete(f.userId, savings.id);
    expect(await f.payroll.list(f.userId)).toHaveLength(0);
  });
});

describe('PayrollRepository.deposit', () => {
  it('credits every allocated account and stamps the run, in one transaction', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 20_000);
    const spending = await account(f, f.userId, 'Spending', 5_000);
    const untouched = await account(f, f.userId, 'Emergency', 70_000);
    await f.payroll.upsert(f.userId, savings.id, 150_000);
    await f.payroll.upsert(f.userId, spending.id, 50_000);

    const runAt = 1_760_000_000_000;
    const updated = await f.payroll.deposit(f.userId, runAt);

    expect(updated.map((a) => a.id).sort()).toEqual([savings.id, spending.id].sort());
    expect((await f.accounts.byId(f.userId, savings.id))?.balanceSen).toBe(170_000);
    expect((await f.accounts.byId(f.userId, spending.id))?.balanceSen).toBe(55_000);
    // An account with no slice is not touched.
    expect((await f.accounts.byId(f.userId, untouched.id))?.balanceSen).toBe(70_000);
    expect(await f.payroll.lastRunAt(f.userId)).toBe(runAt);
  });

  it('adds again on a second run (a deposit, not a set-to)', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 0);
    await f.payroll.upsert(f.userId, savings.id, 150_000);

    await f.payroll.deposit(f.userId, 1);
    await f.payroll.deposit(f.userId, 2);
    expect((await f.accounts.byId(f.userId, savings.id))?.balanceSen).toBe(300_000);
    expect(await f.payroll.lastRunAt(f.userId)).toBe(2);
  });

  it('creates the settings row when the user has none, and keeps the buffer default', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 0);
    await f.payroll.upsert(f.userId, savings.id, 1_000);
    expect(await f.payroll.lastRunAt(f.userId)).toBeNull();

    await f.payroll.deposit(f.userId, 42);
    const row = f.test.db.select().from(settings).all()[0];
    expect(row?.payrollLastRunAt).toBe(42);
    expect(row?.safetyBufferSen).toBe(30000);
  });

  it('throws — and writes nothing — when there is no split to apply', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 20_000);

    await expect(f.payroll.deposit(f.userId, 1)).rejects.toThrow('no payroll allocations');
    expect((await f.accounts.byId(f.userId, savings.id))?.balanceSen).toBe(20_000);
    expect(await f.payroll.lastRunAt(f.userId)).toBeNull();
  });

  it('rolls back every credit when a statement inside the transaction fails', async () => {
    const f = fixture();
    const savings = await account(f, f.userId, 'Savings', 20_000);
    const spending = await account(f, f.userId, 'Spending', 5_000);
    await f.payroll.upsert(f.userId, savings.id, 150_000);
    await f.payroll.upsert(f.userId, spending.id, 50_000);

    // Break the last statement of the transaction (the run stamp).
    f.test.sqlite.exec('DROP TABLE settings');
    await expect(f.payroll.deposit(f.userId, 1)).rejects.toThrow();

    // No half-applied payroll: both balances are untouched.
    expect((await f.accounts.byId(f.userId, savings.id))?.balanceSen).toBe(20_000);
    expect((await f.accounts.byId(f.userId, spending.id))?.balanceSen).toBe(5_000);
  });

  it('never credits another user\'s account with the same id', async () => {
    const f = fixture();
    const mine = await account(f, f.userId, 'Savings', 0);
    // Their row exists but belongs to the other user.
    f.test.db
      .insert(payrollAllocations)
      .values({ userId: f.otherUserId, accountId: mine.id, amountSen: 999_000 })
      .run();
    await f.payroll.upsert(f.userId, mine.id, 100_000);

    await f.payroll.deposit(f.userId, 1);
    const rows = f.test.db.select().from(accountsTable).all() as Account[];
    expect(rows.find((a) => a.id === mine.id)?.balanceSen).toBe(100_000);
  });
});
