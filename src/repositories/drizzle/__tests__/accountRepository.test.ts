/**
 * Plan 004 — Drizzle AccountRepository against the better-sqlite3 harness.
 * Covers: create→list round-trip (all four types), sumBalances signed math
 * with mixed cash/bank/credit, user scoping, delete-blocking when an expense
 * references the account (FK-protected), and delete-on-empty.
 */
import { describe, expect, it } from '@jest/globals';
import { categories, expenses, users } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { ACCOUNT_DELETE_BLOCKED_MESSAGE } from '@/repositories/types';

interface Fixture {
  test: TestDb;
  ownerUserId: number;
  otherUserId: number;
  categoryId: number;
  accounts: DrizzleAccountRepository;
}

function fixture(): Fixture {
  const test = createMigratedTestDb();
  const ownerUserId = Number(
    test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run().lastInsertRowid,
  );
  const otherUserId = Number(
    test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'hash' }).run().lastInsertRowid,
  );
  const categoryId = Number(
    test.db.insert(categories).values({ name: 'Food', icon: 'restaurant-outline', type: 'expense' }).run()
      .lastInsertRowid,
  );
  return { test, ownerUserId, otherUserId, categoryId, accounts: new DrizzleAccountRepository(test.db as unknown as never) };
}

async function createAccount(
  f: Fixture,
  userId: number,
  name: string,
  type: 'cash' | 'bank' | 'ewallet' | 'credit_card',
  balanceSen: number,
) {
  return f.accounts.create({ userId, name, type, initialBalanceSen: balanceSen });
}

describe('DrizzleAccountRepository CRUD', () => {
  it('create → list round-trip for every account type', async () => {
    const f = fixture();
    await createAccount(f, f.ownerUserId, 'Wallet', 'cash', 10050);
    await createAccount(f, f.ownerUserId, 'Maybank', 'bank', 200000);
    await createAccount(f, f.ownerUserId, 'TNG', 'ewallet', 0);
    await createAccount(f, f.ownerUserId, 'Citi', 'credit_card', 50000);

    const list = await f.accounts.list(f.ownerUserId);
    expect(list).toHaveLength(4);
    const cash = list.find((a) => a.name === 'Wallet');
    expect(cash?.type).toBe('cash');
    expect(cash?.balanceSen).toBe(10050);
    expect(Number.isInteger(cash?.balanceSen)).toBe(true);
    const cc = list.find((a) => a.name === 'Citi');
    expect(cc?.type).toBe('credit_card');
    // Credit-card balance stored positive = amount owed (never negated at rest).
    expect(cc?.balanceSen).toBe(50000);
  });

  it('byId returns the row for the owning user, null for a different user / unknown', async () => {
    const f = fixture();
    const created = await createAccount(f, f.ownerUserId, 'Wallet', 'cash', 1000);

    const mine = await f.accounts.byId(f.ownerUserId, created.id);
    expect(mine?.id).toBe(created.id);

    // Same id, but another user's query → null (scoped read).
    expect(await f.accounts.byId(f.otherUserId, created.id)).toBeNull();
    expect(await f.accounts.byId(f.ownerUserId, 99999)).toBeNull();
  });

  it('list is user-scoped', async () => {
    const f = fixture();
    await createAccount(f, f.ownerUserId, 'Owner cash', 'cash', 1);
    await createAccount(f, f.otherUserId, 'Other bank', 'bank', 2);
    expect(await f.accounts.list(f.ownerUserId)).toHaveLength(1);
    expect(await f.accounts.list(f.otherUserId)).toHaveLength(1);
  });
});

describe('AccountRepository.sumBalances — available money (credit owed negative)', () => {
  it('returns 0 with no accounts', async () => {
    const f = fixture();
    expect(await f.accounts.sumBalances(f.ownerUserId)).toBe(0);
  });

  it('mixed cash + bank + credit: SUM with credit negated', async () => {
    const f = fixture();
    await createAccount(f, f.ownerUserId, 'Cash', 'cash', 100000); // +1000.00
    await createAccount(f, f.ownerUserId, 'Bank', 'bank', 200000); // +2000.00
    await createAccount(f, f.ownerUserId, 'Credit', 'credit_card', 50000); // owed 500.00 → -500.00
    // expected = 100000 + 200000 - 50000 = 250000
    expect(await f.accounts.sumBalances(f.ownerUserId)).toBe(250000);
  });

  it('all credit cards → fully negative', async () => {
    const f = fixture();
    await createAccount(f, f.ownerUserId, 'CC1', 'credit_card', 120000);
    await createAccount(f, f.ownerUserId, 'CC2', 'credit_card', 30000);
    expect(await f.accounts.sumBalances(f.ownerUserId)).toBe(-150000);
  });

  it('is user-scoped: other users balances are not included', async () => {
    const f = fixture();
    await createAccount(f, f.ownerUserId, 'Cash', 'cash', 100000);
    await createAccount(f, f.otherUserId, 'Other credit', 'credit_card', 999999);
    expect(await f.accounts.sumBalances(f.ownerUserId)).toBe(100000);
  });
});

describe('AccountRepository.delete — FK-protected', () => {
  it('deletes an account with no referencing expenses', async () => {
    const f = fixture();
    const created = await createAccount(f, f.ownerUserId, 'Empty', 'cash', 1000);
    await f.accounts.delete(f.ownerUserId, created.id);
    expect(await f.accounts.list(f.ownerUserId)).toHaveLength(0);
  });

  it('blocks deletion when an expense references the account', async () => {
    const f = fixture();
    const account = await createAccount(f, f.ownerUserId, 'Wallet', 'cash', 1000);
    // Insert a referencing expense via the harness (same schema path as the app).
    f.test.db.insert(expenses).values({
      userId: f.ownerUserId,
      amountSen: 1000,
      categoryId: f.categoryId,
      description: 'Lunch',
      date: '2026-09-01',
      accountId: account.id,
    }).run();

    expect(await f.accounts.countExpenses(f.ownerUserId, account.id)).toBe(1);
    await expect(f.accounts.delete(f.ownerUserId, account.id)).rejects.toThrow(ACCOUNT_DELETE_BLOCKED_MESSAGE);
    // The account must still exist after the blocked attempt.
    expect(await f.accounts.byId(f.ownerUserId, account.id)).not.toBeNull();
  });

  it('does not delete another users account even when id collides', async () => {
    const f = fixture();
    const created = await createAccount(f, f.otherUserId, 'Other', 'cash', 5);
    await f.accounts.delete(f.ownerUserId, created.id); // not owner → no-op
    expect(await f.accounts.list(f.otherUserId)).toHaveLength(1);
  });
});