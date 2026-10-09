/**
 * Drizzle AccountRepository (plan 004) — the only AccountRepository impl in
 * the MVP. Compatible with both the app's expo-sqlite AppDatabase (async) and
 * the Node harness BetterSQLite3Database (sync): every query is awaited, which
 * works on both (sync returns a plain value, async a Promise).
 *
 * All methods are user-scoped (A10) — every query filters by `userId`.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { accounts, expenses, type Account } from '@/db/schema';
import {
  ACCOUNT_DELETE_BLOCKED_MESSAGE,
  type AccountRepository,
  type AccountType,
} from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: AnyDb) {}

  async create(input: {
    userId: number;
    name: string;
    type: AccountType;
    initialBalanceSen: number;
  }): Promise<Account> {
    const rows = (await (this.db
      .insert(accounts)
      .values({
        userId: input.userId,
        name: input.name,
        type: input.type,
        balanceSen: input.initialBalanceSen,
      })
      .returning() as unknown as Promise<Account[]>)) as Account[];
    if (rows.length > 0 && rows[0]) return rows[0];
    throw new Error('Account insert failed — row not found after insert');
  }

  async list(userId: number): Promise<Account[]> {
    return (await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.id)) as unknown as Account[];
  }

  async byId(userId: number, id: number): Promise<Account | null> {
    const rows = (await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))) as unknown as Account[];
    return rows[0] ?? null;
  }

  /**
   * Available money = SUM(balance_sen) with credit-card owed amounts negated
   * (PRD §8.4 / plan 004 spec): `SUM(CASE WHEN type='credit_card' THEN
   * -balance_sen ELSE balance_sen END)`. One deterministic query, COALESCE'd to
   * 0 when the user has no accounts.
   */
  async sumBalances(userId: number): Promise<number> {
    const rows = (await this.db
      .select({
        total: sql<number>`COALESCE(SUM(CASE WHEN ${accounts.type} = 'credit_card' THEN -${accounts.balanceSen} ELSE ${accounts.balanceSen} END), 0)`.mapWith(
          Number,
        ),
      })
      .from(accounts)
      .where(eq(accounts.userId, userId))) as unknown as { total: number }[];
    return rows[0]?.total ?? 0;
  }

  async countExpenses(userId: number, accountId: number): Promise<number> {
    const rows = (await this.db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.accountId, accountId)))) as unknown as {
      n: number;
    }[];
    return rows[0]?.n ?? 0;
  }

  /**
   * Blocks (throws ACCOUNT_DELETE_BLOCKED_MESSAGE) when any expense references
   * the account. DELETE CASCADE is deliberately NOT configured (plan 004); the
   * explicit guard gives a friendly message while the FK constraint is the
   * backstop. Scoped by userId so it can never affect another user's account.
   */
  /** Single user-scoped UPDATE; a missing row means "not this user's account". */
  async setBalance(userId: number, id: number, balanceSen: number): Promise<Account> {
    const rows = (await (this.db
      .update(accounts)
      .set({ balanceSen, updatedAt: Date.now() })
      .where(and(eq(accounts.userId, userId), eq(accounts.id, id)))
      .returning() as unknown as Promise<Account[]>)) as Account[];
    const row = rows[0];
    if (!row) throw new Error('Account not found');
    return row;
  }

  async delete(userId: number, id: number): Promise<void> {
    const refs = await this.countExpenses(userId, id);
    if (refs > 0) {
      throw new Error(ACCOUNT_DELETE_BLOCKED_MESSAGE);
    }
    await this.db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  }
}