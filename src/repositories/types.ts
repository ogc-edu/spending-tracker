/**
 * Repository contracts (ARCHITECTURE §2 — repositories are interfaces so a
 * future cloud backend can reuse them). 003 introduces UserRepository;
 * financial repositories (004+) add userId scoping (A10): every method takes
 * the current user's id, so a repository can never read another user's rows.
 */

import type { Account, Budget, Category, Expense, User } from '@/db/schema';

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

/**
 * E7 (plan 005): expenses auto-created from commitment payments
 * (commitment_payment_id set) are READ-ONLY in the expense UI and service —
 * edit/delete blocked; removal happens by un-paying the payment in Commitments
 * (plan 008). Shown to the user verbatim.
 */
export const EXPENSE_LINKED_READ_ONLY_MESSAGE =
  'This expense was auto-created from a commitment payment — un-pay the payment in Commitments to change or remove it';

/** Input accepted by ExpenseService.create/edit — sen already parsed by the form (plan 005). */
export interface ExpenseInput {
  amountSen: number;
  categoryId: number;
  accountId: number;
  /** TEXT `YYYY-MM-DD` (device-local calendar). */
  date: string;
  /** Optional free text, ≤200 chars. Stored, NEVER sent to AI (plan 013 hygiene). */
  description?: string;
}

/** Row shape the transaction context inserts (service-scoped userId, description defaulted). */
export interface NewExpenseRow {
  userId: number;
  amountSen: number;
  categoryId: number;
  accountId: number;
  date: string;
  description: string;
}

/**
 * Transaction-scoped expense operations (plan 005 / ARCHITECTURE §10 "drizzle
 * transaction {expense row ± account balance}"). See ExpenseRepository.transaction.
 *
 * **All methods are SYNCHRONOUS — do not await them.** Drizzle 0.45's
 * expo-sqlite client (the app's `openDatabaseSync` session) runs
 * `transaction(fn)` without awaiting the callback: an async fn would commit
 * before its pending writes and break rollback on-device. The better-sqlite3
 * harness tolerates async, which makes this trap easy to miss in tests.
 */
export interface ExpenseTx {
  insert(input: NewExpenseRow): Expense;
  /** User-scoped fetch (A10) — null for another user's row. */
  getById(userId: number, id: number): Expense | null;
  /** User-scoped update; throws 'expense not found' when the row is gone. */
  update(userId: number, id: number, patch: Partial<Omit<NewExpenseRow, 'userId'>>): Expense;
  /** User-scoped delete; no-op when the row is gone (verified by the caller first). */
  remove(userId: number, id: number): void;
  /** User-scoped account fetch — the service reads the account type for the sign convention. */
  getAccount(userId: number, accountId: number): Account | null;
  /** Global category fetch (categories have no user_id, A10). */
  getCategory(categoryId: number): Category | null;
  /**
   * D1 balance adjustment: `balance_sen = balance_sen + deltaSen`, scoped by
   * user. `deltaSen` is the SIGNED effect the caller computed (credit-card
   * purchases arrive as +owed). Bumps updated_at.
   */
  adjustBalance(userId: number, accountId: number, deltaSen: number): void;
}

/**
 * Budget row identity (plan 007 / BUD-1): categoryId null = the OVERALL monthly
 * budget; set = one per-category budget. Month 1–12, year absolute (4-digit).
 */
export interface BudgetKey {
  /** NULL = overall budget; set = per-category budget. */
  categoryId: number | null;
  /** 1–12. */
  month: number;
  year: number;
}

/** Input accepted by BudgetService.upsert — sen already parsed by the form (BUD-1). */
export interface BudgetInput extends BudgetKey {
  amountSen: number;
}

/**
 * BudgetRepository (plan 007 / ARCHITECTURE §2, §4) — all methods user-scoped
 * (A10). Upsert semantics: editing a month's (category) budget REPLACES its
 * row — never duplicates. The committed unique index is
 * UNIQUE(user_id, category_id, month, year); because SQLite treats NULLs as
 * distinct in unique indexes, the OVERALL row (category_id NULL) can never
 * conflict with that index — the implementation enforces the
 * single-overall-row invariant itself (delete-then-insert in one transaction,
 * same sync-txn discipline as ExpenseRepository).
 */
export interface BudgetRepository {
  /** REPLACE the row for (categoryId, month, year) — inserts or updates in place. */
  upsert(userId: number, input: BudgetInput): Promise<Budget>;
  /** DELETE the row — clearing is removal, never a zero sentinel (plan §Decisions). */
  clear(userId: number, key: BudgetKey): Promise<void>;
  /** The month's overall budget row, or null when unset (cash-flow input, PRD §8.4). */
  overallFor(userId: number, month: number, year: number): Promise<Budget | null>;
  /** EVERY budget row for the month (overall + all categories); other months excluded. */
  forMonth(userId: number, month: number, year: number): Promise<Budget[]>;
}

/**
 * Expense history filter (plan 006 / EXP-5). All predicates are OPTIONAL and
 * AND-compose; empty search + no category + no range = all rows (paginated).
 * `from`/`to` are inclusive local-date boundaries (`YYYY-MM-DD`); `search` is
 * a case-insensitive substring match on description with `%`/`_` escaped.
 */
export interface ExpenseFilter {
  /** Case-insensitive LIKE '%…%' on description; `%` and `_` are escaped (matched literally). */
  search?: string;
  /** Single-select category filter (F1). */
  categoryId?: number;
  /** Inclusive lower bound, `YYYY-MM-DD` (local calendar). */
  from?: string;
  /** Inclusive upper bound, `YYYY-MM-DD` (local calendar). */
  to?: string;
  /** query() only: page size. sum() ignores pagination — totals cover the WHOLE filtered set (EXP-6). */
  limit?: number;
  /** query() only: row offset for the filtered set; reset to 0 on any filter change. */
  offset?: number;
}

/** Aggregate over the filtered set (EXP-6): row count + sum of amountSen. one predicate set. */
export interface ExpenseTotals {
  count: number;
  totalSen: number;
}

/**
 * ExpenseRepository (plan 005 + 006) — all methods user-scoped (A10).
 * byId/listForMonth/query/sum are plain async reads; every WRITE runs inside
 * `transaction()`, which pairs the expense row change with the owning
 * account's balance adjustment so a failure rolls back everything.
 */
export interface ExpenseRepository {
  byId(userId: number, id: number): Promise<Expense | null>;
  /**
   * Month-scoped list (local calendar): `date >= first of month` and
   * `< first of next month`, newest first (EXP-4 ordering). Queries never
   * touch another user's rows.
   */
  listForMonth(userId: number, year: number, month: number): Promise<Expense[]>;
  /**
   * Filtered history, newest first (date DESC, id DESC), user-scoped.
   * `limit`/`offset` paginate the FILTERED set (offset resets on filter
   * change). Plan 006 single-source-of-predicates: query() and sum() build
   * their WHERE with the SAME predicate function, so the totals bar can
   * never disagree with the list.
   */
  query(userId: number, filter?: ExpenseFilter): Promise<Expense[]>;
  /**
   * { count, totalSen } over the FULL filtered set (pagination fields are
   * ignored — EXP-6 "total for the currently filtered set"). Never disagrees
   * with query(): identical predicate builder.
   */
  sum(userId: number, filter?: ExpenseFilter): Promise<ExpenseTotals>;
  /**
   * Run `fn` inside ONE SQLite transaction (D1). The callback MUST be
   * synchronous (see ExpenseTx) — it receives the transactional contexts and
   * returns its value; any throw rolls back every statement.
   */
  transaction<T>(fn: (tx: ExpenseTx) => T): Promise<T>;
}