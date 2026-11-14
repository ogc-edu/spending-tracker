/**
 * Default accounts and initial expenses seed.
 *
 * Configures the user's initial wallet state:
 * - Investment: RM 1,600.00 (160,000 sen)
 * - Food: RM 800.00 (80,000 sen)
 * - Savings: RM 3,221.00 (322,100 sen)
 *   Calculated as: 6,421 - food (800) - investment (1,600) - expense (600 + 200) = 3,221
 * - Two initial expenses: RM 600.00 and RM 200.00
 *
 * FIRST-RUN ONLY: runs at every app boot, so it must never touch users who
 * already have accounts. Balances are mutated by expenses/payroll/commitments
 * afterwards; re-writing the seed amounts here would wipe that state on every
 * launch. A user is seeded only while they have zero accounts.
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { and, eq } from 'drizzle-orm';
import { accounts, categories, expenses, users } from './schema';
import { toLocalDateString } from '@/utils/dates';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('./schema')>;

export const DEFAULT_ACCOUNTS = [
  { name: 'Savings', type: 'bank' as const, balanceSen: 322_100 },
  { name: 'Investment', type: 'bank' as const, balanceSen: 160_000 },
  { name: 'Food', type: 'cash' as const, balanceSen: 80_000 },
];

export async function seedDefaultAccounts(db: AnyDb): Promise<void> {
  // Find all users (or default user) so new local user profiles are seeded
  const userRows = await db.select({ id: users.id }).from(users);

  if (userRows.length === 0) {
    return;
  }

  for (const user of userRows) {
    const userId = user.id;

    // First-run only: an existing account means the wallet is already live.
    // Never touch it here — every boot would reset expense/payroll deductions.
    const existing = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);
    if (existing.length > 0) {
      continue;
    }

    let savingsAccountId: number | null = null;

    for (const target of DEFAULT_ACCOUNTS) {
      await db.insert(accounts).values({
        userId,
        name: target.name,
        type: target.type,
        balanceSen: target.balanceSen,
      });

      const inserted = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.name, target.name)))
        .limit(1);

      if (target.name === 'Savings' && inserted.length > 0) {
        savingsAccountId = inserted[0].id;
      }
    }

    // Seed the two expenses (RM600 + RM200) if not already present
    const has600 = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.amountSen, 60_000)))
      .limit(1);

    const has200 = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.amountSen, 20_000)))
      .limit(1);

    const today = toLocalDateString(new Date());
    const catRows = await db.select({ id: categories.id, name: categories.name }).from(categories).limit(12);
    const billsCat = catRows.find((c) => c.name.toLowerCase() === 'bills') ?? catRows[0];
    const otherCat = catRows.find((c) => c.name.toLowerCase() === 'other') ?? catRows[0];

    if (has600.length === 0 && billsCat) {
      await db.insert(expenses).values({
        userId,
        amountSen: 60_000,
        categoryId: billsCat.id,
        description: 'Expense',
        date: today,
        accountId: savingsAccountId,
      });
    }

    if (has200.length === 0 && otherCat) {
      await db.insert(expenses).values({
        userId,
        amountSen: 20_000,
        categoryId: otherCat.id,
        description: 'Expense',
        date: today,
        accountId: savingsAccountId,
      });
    }
  }
}
