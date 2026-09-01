/**
 * Repository contracts (ARCHITECTURE §2 — repositories are interfaces so a
 * future cloud backend can reuse them). 003 introduces UserRepository;
 * financial repositories (004+) add userId scoping (A10): every method takes
 * the current user's id, so a repository can never read another user's rows.
 */

import type { Account, Category, User } from '@/db/schema';

export interface UserRepository {
  /**
   * Insert a user. Caller normalizes email (trim + lowercase); the DB
   * enforces UNIQUE + COLLATE NOCASE. Returns the created row.
   */
  create(input: { email: string; passwordHash: string }): Promise<User>;
  /** Lookup by email, case-insensitive (NOCASE). */
  byEmail(email: string): Promise<User | null>;
  byId(id: number): Promise<User | null>;
  count(): Promise<number>;
}

/** Account type — the four supported storage accounts (plan 004 / ACC-1). */
export const ACCOUNT_TYPES = ['cash', 'bank', 'ewallet', 'credit_card'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Delete-blocking message shown when an account still has referencing expenses (FK-protected). */
export const ACCOUNT_DELETE_BLOCKED_MESSAGE =
  "This account has expenses and can't be deleted";

/** Input accepted by AccountService.create (sen already parsed by the form). */
export interface AccountInput {
  name: string;
  type: AccountType;
  initialBalanceSen: number;
}

/**
 * AccountRepository — all methods user-scoped (A10 / plan 004).
 * A credit card's balance_sen stores the AMOUNT OWED (positive); sumBalances
 * negates it (PRD §8.4 "available"). DELETE CASCADE is deliberately NOT
 * configured — delete() blocks on referencing expenses (plan 004 edge cases).
 */
export interface AccountRepository {
  create(input: { userId: number; name: string; type: AccountType; initialBalanceSen: number }): Promise<Account>;
  list(userId: number): Promise<Account[]>;
  byId(userId: number, id: number): Promise<Account | null>;
  /** Available money = sum of balances, credit_card owed negated. Single SQL. */
  sumBalances(userId: number): Promise<number>;
  /** Number of expenses referencing this account (for delete-blocking). */
  countExpenses(userId: number, accountId: number): Promise<number>;
  /** Deletes only when no expense references the account; otherwise throws with ACCOUNT_DELETE_BLOCKED_MESSAGE. */
  delete(userId: number, id: number): Promise<void>;
}

/** CategoryRepository — categories are GLOBAL (no user_id, A10): read-only in the MVP (plan 004). */
export interface CategoryRepository {
  list(): Promise<Category[]>;
  byId(id: number): Promise<Category | null>;
}