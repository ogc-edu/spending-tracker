/**
 * Drizzle schema — single source of truth (ARCHITECTURE §4, plan 002).
 *
 * Conventions:
 * - Money is integer sen everywhere (`*_sen` columns) — never floats.
 * - Timestamps are integer unix milliseconds (Date.now()).
 * - `expenses.date` / commitment dates are TEXT `YYYY-MM-DD` (local calendar;
 *   month/year are derived in the engine, feature 009).
 * - All financial tables carry a `user_id` FK + index (A10 user scoping);
 *   `categories` is global (no user_id).
 * - This module imports ONLY `drizzle-orm/sqlite-core` so the Node-side Jest
 *   harness (better-sqlite3) can load it without expo-sqlite (plan 002 §Node harness).
 */

import {
  index,
  integer,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

/** Users — local accounts. Seeded default user lands in feature 003 (needs the Argon2 hasher). */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /**
   * UNIQUE + COLLATE NOCASE: case-insensitive email identity.
   * Drizzle's sqlite builder has no `collate()` — the COLLATE NOCASE clause is
   * applied to this column in the committed generated migration (drizzle/0000_*.sql).
   */
  email: text('email').notNull().unique(),
  /** Argon2id encoded string (feature 003). */
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  /** 'expense' | 'income' — all 12 seeds are 'expense'; validation lives in services (004+). */
  type: text('type').notNull().default('expense'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    /** 'cash' | 'bank' | 'ewallet' | 'credit_card'. */
    type: text('type').notNull(),
    /** Credit-card balance_sen = amount owed (positive), counted negatively in "available". */
    balanceSen: integer('balance_sen').notNull().default(0),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    /** NULL = overall monthly budget; set = per-category budget. */
    categoryId: integer('category_id').references(() => categories.id),
    /** 1–12. */
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    amountSen: integer('amount_sen').notNull(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    // Upsert semantics: editing a month's (category) budget replaces its row.
    // Caveat (SQLite): NULLs are distinct in unique indexes, so an "overall"
    // row (category_id NULL) is not deduped by this constraint — feature 007's
    // repository enforces the single-overall-row invariant via its upsert query.
    unique('budgets_user_category_month_year_unique').on(
      t.userId,
      t.categoryId,
      t.month,
      t.year,
    ),
    index('budgets_user_id_idx').on(t.userId),
  ],
);

export const commitments = sqliteTable(
  'commitments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    /** 'credit_card' | 'installment' | 'bnpl' | 'bill' | 'subscription' | 'rent' | 'phone' | 'owed' | 'other' (COM-1). */
    type: text('type').notNull(),
    /** NULL = ongoing recurring (rent/subscription); set = fixed installments. */
    totalSen: integer('total_sen'),
    remainingSen: integer('remaining_sen').notNull(),
    paymentSen: integer('payment_sen').notNull(),
    /** 'monthly' | 'one_time'. */
    frequency: text('frequency').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    dueDate: text('due_date').notNull(),
    /** 'active' | 'completed' | 'cancelled'. */
    status: text('status').notNull().default('active'),
    /** Soft-delete (C1, plan 008): NULL = not archived. */
    archivedAt: integer('archived_at'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    index('commitments_user_id_idx').on(t.userId),
    index('commitments_status_idx').on(t.status),
  ],
);

/** Stores only PAID records (A3); the pending schedule is derived, not materialized. */
export const commitmentPayments = sqliteTable(
  'commitment_payments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    commitmentId: integer('commitment_id')
      .notNull()
      .references(() => commitments.id),
    amountSen: integer('amount_sen').notNull(),
    dueDate: text('due_date').notNull(),
    paidDate: text('paid_date'),
    /** 'paid'. */
    status: text('status').notNull().default('paid'),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    index('commitment_payments_user_id_idx').on(t.userId),
    index('commitment_payments_commitment_id_idx').on(t.commitmentId),
  ],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    amountSen: integer('amount_sen').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    description: text('description').notNull().default(''),
    /** TEXT `YYYY-MM-DD` (local calendar). */
    date: text('date').notNull(),
    accountId: integer('account_id').references(() => accounts.id),
    /** Unique link enforces D3 idempotency: a commitment payment's expense is created exactly once. */
    commitmentPaymentId: integer('commitment_payment_id')
      .references(() => commitmentPayments.id)
      .unique(),
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  },
  (t) => [
    index('expenses_user_id_idx').on(t.userId),
    index('expenses_date_idx').on(t.date),
    index('expenses_category_id_idx').on(t.categoryId),
  ],
);

/**
 * User preferences (folded into this initial migration set — plan 010/016).
 * NEVER secrets: AI keys live in SecureStore (plan 013); only provider/model
 * selections persist here.
 */
export const settings = sqliteTable('settings', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  /** Formula buffer for safe-to-spend (PRD §8.4); default RM 300. */
  safetyBufferSen: integer('safety_buffer_sen').notNull().default(30000),
  /** 'gemini' | 'deepseek' | NULL = none configured (no fallback). */
  aiActiveProvider: text('ai_active_provider'),
  aiModelGemini: text('ai_model_gemini'),
  aiModelDeepseek: text('ai_model_deepseek'),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Date.now()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Commitment = typeof commitments.$inferSelect;
export type NewCommitment = typeof commitments.$inferInsert;
export type CommitmentPayment = typeof commitmentPayments.$inferSelect;
export type NewCommitmentPayment = typeof commitmentPayments.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;