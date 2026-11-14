import { describe, expect, it } from '@jest/globals';
import { createMigratedTestDb } from '../testing';
import { insertDefaultCategoriesIfEmpty } from '../seed';
import { seedDefaultUserIfEmpty } from '../seedUser';
import { seedDefaultAccounts } from '../seedAccounts';
import { accounts, expenses, users } from '../schema';
import { and, eq } from 'drizzle-orm';
import type { PasswordHasher } from '@/auth/passwordHasher';

class FakeHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `hash:${password}`;
  }
  async verify(password: string, hash: string): Promise<boolean> {
    return hash === `hash:${password}`;
  }
}

describe('seedDefaultAccounts', () => {
  it('seeds default accounts and expenses for default user', async () => {
    const test = createMigratedTestDb();
    await insertDefaultCategoriesIfEmpty(test.db);
    await seedDefaultUserIfEmpty(test.db, new FakeHasher());

    await seedDefaultAccounts(test.db);

    const user = await test.db.select().from(users).limit(1);
    expect(user.length).toBe(1);
    const userId = user[0].id;

    const userAccounts = await test.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));

    expect(userAccounts.length).toBe(3);

    const savings = userAccounts.find((a) => a.name === 'Savings');
    const investment = userAccounts.find((a) => a.name === 'Investment');
    const food = userAccounts.find((a) => a.name === 'Food');

    expect(savings).toBeDefined();
    expect(savings?.balanceSen).toBe(322_100); // 6421 - 800 - 1600 - 800 = 3221.00
    expect(savings?.type).toBe('bank');

    expect(investment).toBeDefined();
    expect(investment?.balanceSen).toBe(160_000); // 1600.00
    expect(investment?.type).toBe('bank');

    expect(food).toBeDefined();
    expect(food?.balanceSen).toBe(80_000); // 800.00
    expect(food?.type).toBe('cash');

    const userExpenses = await test.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));

    expect(userExpenses.length).toBe(2);
    const amounts = userExpenses.map((e) => e.amountSen).sort((a, b) => a - b);
    expect(amounts).toEqual([20_000, 60_000]); // 200.00 and 600.00

    // Test idempotency
    await seedDefaultAccounts(test.db);
    const accountsAfter = await test.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));
    expect(accountsAfter.length).toBe(3);

    const expensesAfter = await test.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, userId));
    expect(expensesAfter.length).toBe(2);
  });

  it('leaves live account balances and expenses untouched on later boots', async () => {
    const test = createMigratedTestDb();
    await insertDefaultCategoriesIfEmpty(test.db);
    await seedDefaultUserIfEmpty(test.db, new FakeHasher());
    await seedDefaultAccounts(test.db);

    const user = (await test.db.select().from(users).limit(1))[0];
    const savings = (
      await test.db
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, user.id), eq(accounts.name, 'Savings')))
    )[0];

    // Live state: spending deducted RM 500, and the user deleted one seed expense.
    const spentSen = 50_000;
    await test.db
      .update(accounts)
      .set({ balanceSen: savings.balanceSen - spentSen })
      .where(eq(accounts.id, savings.id));
    await test.db
      .delete(expenses)
      .where(and(eq(expenses.userId, user.id), eq(expenses.amountSen, 20_000)));

    // Next app launch runs the boot seed again.
    await seedDefaultAccounts(test.db);

    const savingsAfter = (
      await test.db.select().from(accounts).where(eq(accounts.id, savings.id))
    )[0];
    expect(savingsAfter.balanceSen).toBe(savings.balanceSen - spentSen);

    const expensesAfter = await test.db
      .select()
      .from(expenses)
      .where(eq(expenses.userId, user.id));
    expect(expensesAfter.length).toBe(1);
  });
});
