/**
 * Drizzle BudgetRepository (plan 007) — the only BudgetRepository impl in the
 * MVP. Compatible with both the app's expo-sqlite AppDatabase (sync session
 * over openDatabaseSync) and the Node harness BetterSQLite3Database (sync).
 *
 * Upsert semantics (BUD-1): editing a month's (category) budget REPLACES its
 * row. Category budgets are a plain `insert … onConflictDoUpdate` on the
 * committed UNIQUE(user_id, category_id, month, year) index.
 *
 * THE OVERALL ROW IS DIFFERENT. SQLite unique indexes treat NULLs as distinct,
 * so an insert with category_id NULL can never conflict — onConflictDoUpdate
 * would silently leave two overall rows for the same month. The
 * single-overall-row invariant is enforced with delete-then-insert inside ONE
 * transaction. The transaction callback is SYNCHRONOUS on purpose (the same
 * expo-sqlite commit-before-await trap documented in ExpenseRepository):
 * drizzle 0.45's expo-sqlite `transaction(fn)` runs begin → fn → commit
 * without awaiting the callback, so an async fn would commit before its
 * pending writes while the better-sqlite3 harness hides the bug.
 *
 * All queries are user-scoped (A10) — every WHERE filters by `userId`.
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { budgets, type Budget } from '@/db/schema';
import type { BudgetInput, BudgetKey, BudgetRepository } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
/** The transactional handle drizzle passes to `transaction(fn)`. */
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

export class DrizzleBudgetRepository implements BudgetRepository {
  constructor(private readonly db: AnyDb) {}

  async upsert(userId: number, input: BudgetInput): Promise<Budget> {
    const { categoryId, month, year, amountSen } = input;
    if (categoryId === null) {
      return this.replaceOverall(userId, month, year, amountSen);
    }
    const rows = (await this.db
      .insert(budgets)
      .values({ userId, categoryId, month, year, amountSen })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month, budgets.year],
        set: { amountSen, updatedAt: Date.now() },
      })
      .returning()) as unknown as Budget[];
    const row = rows[0];
    if (!row) throw new Error('budget insert failed — row not found after insert');
    return row;
  }

  /**
   * Overall-row upsert (category_id NULL): delete the month's existing overall
   * row, then insert the new one — atomically. The returned row is the fresh
   * insert; the id changes on replace (unlike onConflictDoUpdate, which keeps
   * the id) — callers must not depend on id stability across overall edits.
   */
  private replaceOverall(userId: number, month: number, year: number, amountSen: number): Budget {
    const db = this.db as unknown as { transaction<T>(fn: (tx: AnyTx) => T): T };
    return db.transaction((tx) => {
      tx.delete(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            isNull(budgets.categoryId),
            eq(budgets.month, month),
            eq(budgets.year, year),
          ),
        )
        .run();
      const rows = tx
        .insert(budgets)
        .values({ userId, categoryId: null, month, year, amountSen })
        .returning()
        .all() as unknown as Budget[];
      const row = rows[0];
      if (!row) throw new Error('budget insert failed — row not found after insert');
      return row;
    });
  }

  /** Delete the targeted row — clearing is removal, never a zero sentinel. */
  async clear(userId: number, key: BudgetKey): Promise<void> {
    await this.db
      .delete(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          key.categoryId === null
            ? isNull(budgets.categoryId)
            : eq(budgets.categoryId, key.categoryId),
          eq(budgets.month, key.month),
          eq(budgets.year, key.year),
        ),
      );
  }

  async overallFor(userId: number, month: number, year: number): Promise<Budget | null> {
    const rows = (await this.db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          isNull(budgets.categoryId),
          eq(budgets.month, month),
          eq(budgets.year, year),
        ),
      )) as unknown as Budget[];
    return rows[0] ?? null;
  }

  /** Every row for the month (overall + all categories); other months excluded. */
  async forMonth(userId: number, month: number, year: number): Promise<Budget[]> {
    return (await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.month, month), eq(budgets.year, year)))
      .orderBy(budgets.id)) as unknown as Budget[];
  }
}