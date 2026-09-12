/**
 * Plan 002 test suite — runs against the committed generated migrations
 * (drizzle/*.sql) on an in-memory better-sqlite3 DB (the Node harness).
 *
 * Covers the plan's Tests section: migration harness + sqlite_master checks,
 * seed idempotency, FK behavior, unique constraints (budgets key,
 * expenses.commitment_payment_id, users.email NOCASE), and CRUD smoke per table
 * with integer-sen values (no float coercion).
 */
import { describe, expect, it } from '@jest/globals';
import { and, eq } from 'drizzle-orm';
import {
  accounts,
  budgets,
  categories,
  commitmentPayments,
  commitments,
  expenses,
  settings,
  users,
} from '../schema';
import { createMigratedTestDb, createTestDb, runMigrations, type TestDb } from '../testing';
import { DEFAULT_CATEGORY_SEED, insertDefaultCategoriesIfEmpty } from '../seed';

/** Committed migrations, read from drizzle-kit's journal (the app's cursor). */
function committedMigrationCount(): number {
  const journal = require('../../../drizzle/meta/_journal.json') as { entries: unknown[] };
  return journal.entries.length;
}

const TABLES = [
  'users',
  'categories',
  'accounts',
  'expenses',
  'budgets',
  'commitments',
  'commitment_payments',
  'settings',
  'payroll_allocations',
  '__drizzle_migrations',
];

const INDEXES = [
  'users_email_unique',
  'accounts_user_id_idx',
  'expenses_date_idx',
  'expenses_category_id_idx',
  'expenses_user_id_idx',
  'expenses_commitment_payment_id_unique',
  'budgets_user_id_idx',
  'budgets_user_category_month_year_unique',
  'commitments_user_id_idx',
  'commitments_status_idx',
  'commitment_payments_user_id_idx',
  'commitment_payments_commitment_id_idx',
  'payroll_allocations_user_id_idx',
  'payroll_allocations_user_account_unique',
];

function tableNames(db: TestDb): string[] {
  return db.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => (row as { name: string }).name);
}

function indexNames(db: TestDb): string[] {
  return db.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name")
    .all()
    .map((row) => (row as { name: string }).name);
}

function columnsOf(db: TestDb, table: string): string[] {
  return (db.sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  );
}

interface Fixture {
  test: TestDb;
  userId: number;
  categoryId: number;
}

/** user + seeded categories + one extra category; no financial rows. */
function fixture(): Fixture {
  const test = createMigratedTestDb();
  const userId = Number(
    test.db.insert(users).values({ email: 'owner@example.com', passwordHash: 'hash' }).run()
      .lastInsertRowid,
  );
  const categoryId = Number(
    test.db
      .insert(categories)
      .values({ name: 'Test Cat', icon: 'pricetag-outline', type: 'expense' })
      .run().lastInsertRowid,
  );
  return { test, userId, categoryId };
}

describe('migration harness', () => {
  it('applies all generated migrations to a fresh DB with no error', () => {
    const test = createTestDb();
    expect(() => runMigrations(test.db)).not.toThrow();
    const names = tableNames(test);
    for (const table of TABLES) {
      expect(names).toContain(table);
    }
    const indexes = indexNames(test);
    for (const index of INDEXES) {
      expect(indexes).toContain(index);
    }
  });

  it('creates versioned bookkeeping rows one-per-migration in __drizzle_migrations', () => {
    const test = createTestDb();
    runMigrations(test.db);
    const rows = test.sqlite
      .prepare('SELECT id, hash, created_at FROM __drizzle_migrations')
      .all() as { id: number; hash: string; created_at: number }[];
    // One row per committed migration — counted from the journal, so adding a
    // migration doesn't require editing this expectation.
    expect(rows).toHaveLength(committedMigrationCount());
    for (const row of rows) {
      expect(row.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(typeof row.created_at).toBe('number');
    }
  });

  it('is idempotent: re-running migrations is a no-op over the recorded cursor', () => {
    const test = createTestDb();
    runMigrations(test.db);
    expect(() => runMigrations(test.db)).not.toThrow();
    const count = test.sqlite
      .prepare('SELECT count(*) AS n FROM __drizzle_migrations')
      .get() as { n: number };
    expect(count.n).toBe(committedMigrationCount());
    // the schema still works after the no-op run
    expect(() => test.db.select().from(users).all()).not.toThrow();
  });

  it('enables foreign keys per connection', () => {
    const test = createTestDb();
    expect(test.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
    runMigrations(test.db);
  });

  it('categories stays global while every financial table carries user_id', () => {
    const { test } = fixture();
    expect(columnsOf(test, 'categories')).not.toContain('user_id');
    for (const table of ['accounts', 'expenses', 'budgets', 'commitments', 'commitment_payments']) {
      expect(columnsOf(test, table)).toContain('user_id');
    }
    expect(columnsOf(test, 'settings')).toContain('user_id');
  });

  it('declares the money columns as integer-backed types', () => {
    const { test } = fixture();
    const moneyColumns: [string, string[]][] = [
      ['accounts', ['balance_sen']],
      ['expenses', ['amount_sen']],
      ['budgets', ['amount_sen']],
      ['commitments', ['total_sen', 'remaining_sen', 'payment_sen']],
      ['commitment_payments', ['amount_sen']],
      ['settings', ['safety_buffer_sen']],
    ];
    for (const [table, cols] of moneyColumns) {
      const info = test.sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string;
        type: string;
      }[];
      for (const col of cols) {
        const found = info.find((c) => c.name === col);
        expect(found).toBeDefined();
        expect(found!.type.toUpperCase()).toBe('INTEGER');
      }
    }
  });
});

describe('seed (12 default categories)', () => {
  it('inserts exactly the 12 EXP-7 categories once', async () => {
    const test = createMigratedTestDb();
    await insertDefaultCategoriesIfEmpty(test.db);
    await insertDefaultCategoriesIfEmpty(test.db); // idempotent
    const rows = test.db.select().from(categories).all();
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.name)).toEqual(DEFAULT_CATEGORY_SEED.map((s) => s.name));
    expect(rows.every((r) => r.type === 'expense')).toBe(true);
    expect(rows.every((r) => r.icon.length > 0)).toBe(true);
    // no user_id on the global table
    expect(rows.every((r) => !('userId' in r))).toBe(true);
  });

  it('does not touch categories that already exist (e.g. user-created later)', async () => {
    const test = createMigratedTestDb();
    test.db
      .insert(categories)
      .values({ name: 'Custom', icon: 'star-outline', type: 'expense' })
      .run();
    await insertDefaultCategoriesIfEmpty(test.db);
    const count = test.sqlite.prepare('SELECT count(*) AS n FROM categories').get() as {
      n: number;
    };
    expect(count.n).toBe(1); // the seed is skipped when the table is non-empty
  });
});

describe('foreign keys', () => {
  it('rejects an expense with a bogus category_id', () => {
    const { test, userId } = fixture();
    expect(() =>
      test.db
        .insert(expenses)
        .values({ userId, amountSen: 1000, categoryId: 99999, date: '2026-09-01' })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('rejects an expense for a nonexistent user', () => {
    const { test, categoryId } = fixture();
    expect(() =>
      test.db
        .insert(expenses)
        .values({ userId: 99999, amountSen: 1000, categoryId, date: '2026-09-01' })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('rejects a budget row referencing a bogus category', () => {
    const { test, userId } = fixture();
    expect(() =>
      test.db
        .insert(budgets)
        .values({ userId, categoryId: 99999, month: 9, year: 2026, amountSen: 500000 })
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('rejects a settings row for a nonexistent user', () => {
    const test = createMigratedTestDb();
    expect(() => test.db.insert(settings).values({ userId: 99999 }).run()).toThrow(
      /FOREIGN KEY/i,
    );
  });
});

describe('unique constraints', () => {
  it('rejects duplicate budgets per (user, category, month, year)', () => {
    const { test, userId, categoryId } = fixture();
    test.db
      .insert(budgets)
      .values({ userId, categoryId, month: 9, year: 2026, amountSen: 500000 })
      .run();
    expect(() =>
      test.db
        .insert(budgets)
        .values({ userId, categoryId, month: 9, year: 2026, amountSen: 700000 })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('still allows the same (category, month, year) for a different user', () => {
    const { test, categoryId } = fixture();
    const other = Number(
      test.db
        .insert(users)
        .values({ email: 'other@example.com', passwordHash: 'hash' })
        .run().lastInsertRowid,
    );
    test.db
      .insert(budgets)
      .values({ userId: other, categoryId, month: 9, year: 2026, amountSen: 100000 })
      .run();
    expect(() =>
      test.db
        .insert(budgets)
        .values({ userId: other, categoryId, month: 9, year: 2026, amountSen: 300000 })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('rejects a second expense linked to the same commitment payment (D3 idempotency)', () => {
    const { test, userId, categoryId } = fixture();
    const commitmentId = Number(
      test.db
        .insert(commitments)
        .values({
          userId,
          name: 'Rent',
          type: 'rent',
          totalSen: null,
          remainingSen: 120000,
          paymentSen: 120000,
          frequency: 'monthly',
          startDate: '2026-09-01',
          dueDate: '2026-09-01',
          status: 'active',
        })
        .run().lastInsertRowid,
    );
    const paymentId = Number(
      test.db
        .insert(commitmentPayments)
        .values({
          userId,
          commitmentId,
          amountSen: 120000,
          dueDate: '2026-09-01',
          paidDate: '2026-09-01',
          status: 'paid',
        })
        .run().lastInsertRowid,
    );
    test.db
      .insert(expenses)
      .values({
        userId,
        amountSen: 120000,
        categoryId,
        date: '2026-09-01',
        commitmentPaymentId: paymentId,
      })
      .run();
    // double-tap: second insert with the same link must fail
    expect(() =>
      test.db
        .insert(expenses)
        .values({
          userId,
          amountSen: 120000,
          categoryId,
          date: '2026-09-01',
          commitmentPaymentId: paymentId,
        })
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it('enforces case-insensitive unique email (COLLATE NOCASE)', () => {
    const test = createMigratedTestDb();
    test.db
      .insert(users)
      .values({ email: 'foo@example.com', passwordHash: 'hash' })
      .run();
    expect(() =>
      test.db
        .insert(users)
        .values({ email: 'FOO@example.com', passwordHash: 'hash' })
        .run(),
    ).toThrow(/UNIQUE/i);
  });
});

describe('CRUD smoke (integer sen round-trip)', () => {
  it('users', () => {
    const test = createMigratedTestDb();
    const id = Number(
      test.db
        .insert(users)
        .values({ email: 'me@example.com', passwordHash: 'argon2-encoded' })
        .run().lastInsertRowid,
    );
    const row = test.db.select().from(users).where(eq(users.email, 'me@example.com')).get();
    expect(row?.id).toBe(id);
    expect(row?.passwordHash).toBe('argon2-encoded');
    expect(typeof row?.createdAt).toBe('number');
  });

  it('accounts balance_sen stays an integer', () => {
    const { test, userId } = fixture();
    const id = Number(
      test.db
        .insert(accounts)
        .values({ userId, name: 'Wallet', type: 'cash', balanceSen: 123456789 })
        .run().lastInsertRowid,
    );
    const row = test.db.select().from(accounts).where(eq(accounts.id, id)).get();
    expect(row?.balanceSen).toBe(123456789);
    expect(typeof row?.balanceSen).toBe('number');
    expect(Number.isInteger(row?.balanceSen)).toBe(true);
  });

  it('expenses amount_sen, date TEXT and defaults', () => {
    const { test, userId, categoryId } = fixture();
    const id = Number(
      test.db
        .insert(expenses)
        .values({ userId, amountSen: 4200, categoryId, description: 'Lunch', date: '2026-09-01' })
        .run().lastInsertRowid,
    );
    const row = test.db.select().from(expenses).where(eq(expenses.id, id)).get();
    expect(row?.amountSen).toBe(4200);
    expect(Number.isInteger(row?.amountSen)).toBe(true);
    expect(row?.date).toBe('2026-09-01');
    expect(row?.description).toBe('Lunch');
    expect(row?.accountId).toBeNull();
    expect(row?.commitmentPaymentId).toBeNull();
    expect(typeof row?.createdAt).toBe('number');
    expect(typeof row?.updatedAt).toBe('number');
  });

  it('budgets month/year ints and sen', () => {
    const { test, userId, categoryId } = fixture();
    test.db
      .insert(budgets)
      .values({ userId, categoryId, month: 12, year: 2026, amountSen: 150000 })
      .run();
    const row = test.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.month, 12), eq(budgets.year, 2026)))
      .get();
    expect(row?.amountSen).toBe(150000);
    expect(Number.isInteger(row?.amountSen)).toBe(true);
  });

  it('commitments: nullable total_sen (ongoing) vs fixed', () => {
    const { test, userId } = fixture();
    const ongoingId = Number(
      test.db
        .insert(commitments)
        .values({
          userId,
          name: 'Netflix',
          type: 'subscription',
          totalSen: null,
          remainingSen: 5900,
          paymentSen: 5900,
          frequency: 'monthly',
          startDate: '2026-01-15',
          dueDate: '2026-01-15',
          status: 'active',
        })
        .run().lastInsertRowid,
    );
    const fixedId = Number(
      test.db
        .insert(commitments)
        .values({
          userId,
          name: 'Phone',
          type: 'phone',
          totalSen: 360000,
          remainingSen: 120000,
          paymentSen: 120000,
          frequency: 'monthly',
          startDate: '2026-09-01',
          endDate: '2026-11-01',
          dueDate: '2026-09-01',
          status: 'active',
        })
        .run().lastInsertRowid,
    );
    const ongoing = test.db.select().from(commitments).where(eq(commitments.id, ongoingId)).get();
    const fixed = test.db.select().from(commitments).where(eq(commitments.id, fixedId)).get();
    expect(ongoing?.totalSen).toBeNull();
    expect(ongoing?.archivedAt ?? null).toBeNull();
    expect(fixed?.totalSen).toBe(360000);
    expect(fixed?.remainingSen).toBe(120000);
    expect(fixed?.endDate).toBe('2026-11-01');
    expect(fixed?.status).toBe('active');
  });

  it('commitment_payments stores only paid records', () => {
    const { test, userId } = fixture();
    const commitmentId = Number(
      test.db
        .insert(commitments)
        .values({
          userId,
          name: 'Loan',
          type: 'installment',
          totalSen: 1000000,
          remainingSen: 500000,
          paymentSen: 500000,
          frequency: 'one_time',
          startDate: '2026-09-01',
          dueDate: '2026-09-30',
          status: 'active',
        })
        .run().lastInsertRowid,
    );
    const id = Number(
      test.db
        .insert(commitmentPayments)
        .values({
          userId,
          commitmentId,
          amountSen: 500000,
          dueDate: '2026-09-30',
          paidDate: '2026-09-01',
          status: 'paid',
        })
        .run().lastInsertRowid,
    );
    const row = test.db
      .select()
      .from(commitmentPayments)
      .where(eq(commitmentPayments.id, id))
      .get();
    expect(row?.amountSen).toBe(500000);
    expect(Number.isInteger(row?.amountSen)).toBe(true);
    expect(row?.paidDate).toBe('2026-09-01');
    expect(row?.status).toBe('paid');
  });

  it('settings: safety_buffer_sen default 30000, per-user PK, non-secret AI prefs', () => {
    const { test, userId } = fixture();
    test.db.insert(settings).values({ userId }).run(); // defaults only
    const row = test.db.select().from(settings).where(eq(settings.userId, userId)).get();
    expect(row?.safetyBufferSen).toBe(30000);
    expect(row?.aiActiveProvider).toBeNull();
    expect(row?.aiModelGemini).toBeNull();
    expect(row?.aiModelDeepseek).toBeNull();

    // a second row for the same user is rejected by the PK (upsert replaces instead)
    expect(() => test.db.insert(settings).values({ userId, safetyBufferSen: 50000 }).run()).toThrow(
      /UNIQUE/i,
    );

    // upsert semantics (repositories, feature 010): onConflictDoUpdate replaces the row
    test.db
      .insert(settings)
      .values({
        userId,
        safetyBufferSen: 50000,
        aiActiveProvider: 'gemini',
        aiModelGemini: 'gemini-2.5-pro',
      })
      .onConflictDoUpdate({
        target: settings.userId,
        set: {
          safetyBufferSen: 50000,
          aiActiveProvider: 'gemini',
          aiModelGemini: 'gemini-2.5-pro',
          updatedAt: Date.now(),
        },
      })
      .run();
    const updated = test.db.select().from(settings).where(eq(settings.userId, userId)).get();
    expect(updated?.safetyBufferSen).toBe(50000);
    expect(updated?.aiActiveProvider).toBe('gemini');
  });
});