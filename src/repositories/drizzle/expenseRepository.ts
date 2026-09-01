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
import { and, desc, eq, gte, lt, lte, sql, type Column, type SQL } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { accounts, categories, expenses, type Account, type Category, type Expense } from '@/db/schema';
import { DATE_RE, monthStartDate, nextMonthStartDate } from '@/utils/dates';
import type { ExpenseFilter, ExpenseRepository, ExpenseTotals, ExpenseTx, NewExpenseRow } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
/** The transactional handle drizzle passes to `transaction(fn)`. */
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

/**
 * Escape LIKE wildcards (`%`, `_`, and the escape char itself) so a search
 * term matches only its literal text (plan 006 edge case). Combined with the
 * `ESCAPE '\'` clause in `likeEscaped` — without it SQLite treats `\` as a
 * plain character and the escaping silently does nothing.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** `column LIKE ? ESCAPE '\'` — drizzle 0.45's `like()` has no escape-char parameter, so raw SQL. */
function likeEscaped(column: Column, pattern: string): SQL {
  return sql`${column} like ${pattern} escape '\\'`;
}

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
   * THE plan-006 predicate builder — the single source of predicates for the
   * Expenses tab. query() and sum() BOTH call it, so the list and the totals
   * bar can never disagree (tested). Everything AND-composes against the
   * user's rows; malformed optional values (bad date shapes, non-positive
   * category ids) are dropped rather than crashing the history screen.
   */
  private predicatesFor(userId: number, filter: ExpenseFilter): SQL[] {
    const predicates: SQL[] = [eq(expenses.userId, userId)];
    const search = filter.search?.trim();
    if (search) {
      predicates.push(likeEscaped(expenses.description, `%${escapeLike(search)}%`));
    }
    if (filter.categoryId != null && Number.isInteger(filter.categoryId) && filter.categoryId > 0) {
      predicates.push(eq(expenses.categoryId, filter.categoryId));
    }
    if (filter.from && DATE_RE.test(filter.from)) {
      predicates.push(gte(expenses.date, filter.from)); // inclusive lower bound
    }
    if (filter.to && DATE_RE.test(filter.to)) {
      predicates.push(lte(expenses.date, filter.to)); // inclusive upper bound
    }
    return predicates;
  }

  /**
   * Filtered history (EXP-4/EXP-5): newest first, ties broken by id (later
   * insert first) — deterministic pagination. limit/offset apply to the
   * FILTERED set; the caller resets offset to 0 on any filter change.
   */
  async query(userId: number, filter: ExpenseFilter = {}): Promise<Expense[]> {
    const builder = this.db
      .select()
      .from(expenses)
      .where(and(...this.predicatesFor(userId, filter)))
      .orderBy(desc(expenses.date), desc(expenses.id));
    // limit/offset are a PAIR: SQLite rejects OFFSET without LIMIT, so offset
    // alone is ignored (no pagination). The UI always sends both.
    const withPage =
      filter.limit != null ? builder.limit(filter.limit).offset(filter.offset ?? 0) : builder;
    return (await withPage) as unknown as Expense[];
  }

  /**
   * COUNT + SUM(amount_sen) over the WHOLE filtered set (EXP-6): pagination
   * fields are deliberately ignored so the pinned totals bar reflects every
   * matching row, not just the loaded page. Same predicates as query().
   * COALESCE keeps an empty match set at { count: 0, totalSen: 0 }.
   */
  async sum(userId: number, filter: ExpenseFilter = {}): Promise<ExpenseTotals> {
    const rows = (await this.db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        totalSen: sql<number>`COALESCE(sum(${expenses.amountSen}), 0)`.mapWith(Number),
      })
      .from(expenses)
      .where(and(...this.predicatesFor(userId, filter)))) as unknown as ExpenseTotals[];
    return rows[0] ?? { count: 0, totalSen: 0 };
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