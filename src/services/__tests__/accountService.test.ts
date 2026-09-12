/**
 * Plan 004 — AccountService (thin orchestration + user scoping + validation).
 * Uses DrizzleAccountRepository + a stubbed CurrentUserSource. Covers:
 * not-signed-in rejection, input validation, delegation to the repository with
 * the resolved current user's id, and sumBalances end-to-end.
 */
import { describe, expect, it } from '@jest/globals';
import { users } from '@/db/schema';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { AccountService, type CurrentUserSource } from '@/services/AccountService';
import type { User } from '@/db/schema';

interface Fixture {
  test: TestDb;
  user: User;
  repo: DrizzleAccountRepository;
  service: AccountService;
}

/** In-memory current-user stub (AuthService satisfies CurrentUserSource on-device). */
function makeService({ signedIn = true, user }: { signedIn?: boolean; user?: User } = {}): Fixture {
  const test = createMigratedTestDb();
  test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run();
  const u = test.db.select().from(users).get() as User;
  const repo = new DrizzleAccountRepository(test.db as unknown as never);
  const auth: CurrentUserSource = {
    currentUser: async () => (signedIn ? (user ?? u) : null),
  };
  return { test, user: u, repo, service: new AccountService(repo, auth) };
}

describe('AccountService user resolution', () => {
  it('rejects when not signed in', async () => {
    const { service } = makeService({ signedIn: false });
    await expect(service.create({ name: 'X', type: 'cash', initialBalanceSen: 0 })).rejects.toThrow('not signed in');
    await expect(service.list()).rejects.toThrow('not signed in');
    await expect(service.sumBalances()).rejects.toThrow('not signed in');
    await expect(service.delete(1)).rejects.toThrow('not signed in');
  });
});

describe('AccountService.create validation', () => {
  it('trims + requires a non-empty name', async () => {
    const { service } = makeService();
    await expect(service.create({ name: '   ', type: 'cash', initialBalanceSen: 0 })).rejects.toThrow(
      'account name required',
    );
  });

  it('rejects an invalid account type', async () => {
    const { service } = makeService();
    await expect(
      service.create({ name: 'X', type: 'checking' as never, initialBalanceSen: 0 }),
    ).rejects.toThrow('invalid account type');
  });

  it('rejects negative and non-integer initial balances', async () => {
    const { service } = makeService();
    await expect(
      service.create({ name: 'X', type: 'cash', initialBalanceSen: -5 }),
    ).rejects.toThrow('invalid initial balance');
    await expect(
      service.create({ name: 'X', type: 'cash', initialBalanceSen: 12.5 }),
    ).rejects.toThrow('invalid initial balance');
  });

  it('creates and returns the account tagged with the current user', async () => {
    const { service, user, repo } = makeService();
    const account = await service.create({ name: ' Wallet ', type: 'credit_card', initialBalanceSen: 50000 });
    expect(account.name).toBe('Wallet'); // trimmed
    expect(account.type).toBe('credit_card');
    expect(account.userId).toBe(user.id);
    expect((await repo.list(user.id)).map((a) => a.id)).toContain(account.id);
  });
});

describe('AccountService orchestration', () => {
  it('list and sumBalances operate on the current user', async () => {
    const { service, user } = makeService();
    await service.create({ name: 'Cash', type: 'cash', initialBalanceSen: 100000 });
    await service.create({ name: 'Credit', type: 'credit_card', initialBalanceSen: 40000 });

    const list = await service.list();
    expect(list).toHaveLength(2);
    expect(list.every((a) => a.userId === user.id)).toBe(true);
    // signed: 100000 - 40000
    expect(await service.sumBalances()).toBe(60000);
  });

  it('delete delegates to the repository (FK-block surfaces)', async () => {
    const { service } = makeService();
    const a = await service.create({ name: 'Empty', type: 'cash', initialBalanceSen: 100 });
    await expect(service.delete(a.id)).resolves.toBeUndefined();
    expect(await service.list()).toHaveLength(0);
  });
});

describe('AccountService.setBalance', () => {
  it('writes the new balance for the current user', async () => {
    const { service } = makeService();
    const account = await service.create({ name: 'Wallet', type: 'cash', initialBalanceSen: 10_000 });

    const updated = await service.setBalance(account.id, 4_250);
    expect(updated.balanceSen).toBe(4_250);
    expect((await service.list())[0]?.balanceSen).toBe(4_250);
    expect(await service.sumBalances()).toBe(4_250);
  });

  it('accepts 0 but rejects negatives and non-integers (sen only)', async () => {
    const { service } = makeService();
    const account = await service.create({ name: 'Wallet', type: 'cash', initialBalanceSen: 10_000 });

    await expect(service.setBalance(account.id, 0)).resolves.toMatchObject({ balanceSen: 0 });
    await expect(service.setBalance(account.id, -1)).rejects.toThrow('invalid balance');
    await expect(service.setBalance(account.id, 12.5)).rejects.toThrow('invalid balance');
    expect((await service.list())[0]?.balanceSen).toBe(0); // nothing written by the rejects
  });

  it('rejects when not signed in', async () => {
    const { service } = makeService({ signedIn: false });
    await expect(service.setBalance(1, 100)).rejects.toThrow('not signed in');
  });

  it('cannot touch another user\'s account', async () => {
    const owner = makeService();
    const account = await owner.service.create({ name: 'Wallet', type: 'cash', initialBalanceSen: 10_000 });

    // Same DB, a different signed-in user id.
    owner.test.db.insert(users).values({ email: 'other@example.com', passwordHash: 'hash' }).run();
    const others = owner.test.db.select().from(users).all() as User[];
    const intruder = others.find((u) => u.email === 'other@example.com') as User;
    const intruderService = new AccountService(owner.repo, { currentUser: async () => intruder });

    await expect(intruderService.setBalance(account.id, 1)).rejects.toThrow('Account not found');
    expect((await owner.service.list())[0]?.balanceSen).toBe(10_000);
  });
});
