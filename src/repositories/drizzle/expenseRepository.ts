/**
 * Drizzle ExpenseRepository (plan 005) — the only ExpenseRepository impl in
 * the MVP. Compatible with both the app's expo-sqlite AppDatabase (sync
 * session over openDatabaseSync) and the Node harness BetterSQLite3Database
 * (sync): reads are awaited (a plain value awaits fine), and every WRITE runs
 * inside `transaction()`, which pairs the expense row change with the owning
 * account's D1 balance adjustment.
 *
 * THE TRANSACTION IS SYNCHRONOUS on purpose: drizzle 0.45's expo-sqlite
 * `transaction(fn)` runs `begin → fn → commit` without awaiting the callback,
 * so an async fn would commit before its pending writes — silently breaking
 * atomicity on-device while the better-sqlite3 harness (whose native txn
 * supports async) hides the bug. The tx-context methods therefore return plain
 * values and the service's callback awaits nothing inside the txn.
 *
 * All reads are user-scoped (A10) — every query filters by `userId`.
 */
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { accounts, categories, expenses, type Account, type Category, type Expense } from '@/db/schema';
import { monthStartDate, nextMonthStartDate } from '@/utils/dates';
import type { ExpenseRepository, ExpenseTx, NewExpenseRow } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
/** The transactional handle drizzle passes to `transaction(fn)`. */
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

export class DrizzleExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: AnyDb) {}

  async byId(userId: number, id: number): Promise<Expense | null> {
    const rows = (await this.db
      .select()
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))) as unknown as Expense[];
    return rows[0] ?? null;
  }

  /**
   * Month-scoped list via a half-open SQL date range:
   * `date >= 'YYYY-MM-01' AND date < first-of-next-month` — inclusive of the
   * 1st and last day of the month, exclusive of the next month's 1st.
   * Newest first (EXP-4), ties broken by id (later insert first).
   */
  async listForMonth(userId: number, year: number, month: number): Promise<Expense[]> {
    return (await this.db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          gte(expenses.date, monthStartDate(year, month)),
          lt(expenses.date, nextMonthStartDate(year, month)),
        ),
      )
      .orderBy(desc(expenses.date), desc(expenses.id))) as unknown as Expense[];
  }

  /**
   * One SQLite transaction (D1). The callback is SYNCHRONOUS (see ExpenseTx);
   * any throw rolls back every statement (insert + balance adjustment + …).
   * The outer async wrapper awaits only AFTER the driver has committed.
   */
  async transaction<T>(fn: (tx: ExpenseTx) => T): Promise<T> {
    const db = this.db as unknown as { transaction(fn: (tx: AnyTx) => T): T };
    return db.transaction((tx) => fn(this.makeTx(tx)));
  }

  /** Bind the synchronous tx-context over the driver's transaction handle. */
  private makeTx(tx: AnyTx): ExpenseTx {
    return {
      insert: (input: NewExpenseRow): Expense => {
        // Sync sessions execute .returning().all() eagerly — no thenables inside
        // the transaction (the expo driver would commit before they resolve).
        const rows = tx.insert(expenses).values(input).returning().all() as unknown as Expense[];
        const row = rows[0];
        if (!row) throw new Error('expense insert failed — row not found after insert');
        return row;
      },
      getById: (userId: number, id: number): Expense | null => {
        const rows = tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.userId, userId), eq(expenses.id, id)))
          .all() as unknown as Expense[];
        return rows[0] ?? null;
      },
      update: (userId: number, id: number, patch: Partial<Omit<NewExpenseRow, 'userId'>>): Expense => {
        const rows = tx
          .update(expenses)
          .set({ ...patch, updatedAt: Date.now() })
          .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
          .returning()
          .all() as unknown as Expense[];
        const row = rows[0];
        if (!row) throw new Error('expense not found');
        return row;
      },
      remove: (userId: number, id: number): void => {
        tx.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).run();
      },
      getAccount: (userId: number, accountId: number): Account | null => {
        const rows = tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
          .all() as unknown as Account[];
        return rows[0] ?? null;
      },
      getCategory: (categoryId: number): Category | null => {
        const rows = tx
          .select()
          .from(categories)
          .where(eq(categories.id, categoryId))
          .all() as unknown as Category[];
        return rows[0] ?? null;
      },
      adjustBalance: (userId: number, accountId: number, deltaSen: number): void => {
        tx.update(accounts)
          .set({
            // balance_sen = balance_sen + deltaSen (single SQL statement — atomic)
            balanceSen: sql`${accounts.balanceSen} + ${deltaSen}`,
            updatedAt: Date.now(),
          })
          .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
          .run();
      },
    };
  }
}