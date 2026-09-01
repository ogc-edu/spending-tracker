/**
 * Repository factory (plan 004 — "wired via a lightweight factory").
 * Builds Drizzle repository instances over the initialized app client.
 * Screens/contexts construct services from these (screens never touch the
 * client directly). The Node harness (better-sqlite3) builds the same classes
 * directly — no factory needed there.
 */
import { getDb } from './client';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import type {
  AccountRepository,
  BudgetRepository,
  CategoryRepository,
  CommitmentRepository,
  ExpenseRepository,
} from '@/repositories/types';

export interface Repositories {
  accounts: AccountRepository;
  categories: CategoryRepository;
  expenses: ExpenseRepository;
  budgets: BudgetRepository;
  commitments: CommitmentRepository;
}

/** Repositories bound to the initialized app DB. Throws if initDb() hasn't resolved. */
export function repositories(): Repositories {
  const db = getDb();
  return {
    accounts: new DrizzleAccountRepository(db as unknown as never),
    categories: new DrizzleCategoryRepository(db as unknown as never),
    expenses: new DrizzleExpenseRepository(db as unknown as never),
    budgets: new DrizzleBudgetRepository(db as unknown as never),
    commitments: new DrizzleCommitmentRepository(db as unknown as never),
  };
}