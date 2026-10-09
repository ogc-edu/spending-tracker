/**
 * Drizzle PayrollRepository — the standing payroll split and the deposit that
 * applies it. Compatible with both the app's expo-sqlite AppDatabase and the
 * Node harness (reads are awaited; a plain value awaits fine).
 *
 * THE DEPOSIT TRANSACTION IS SYNCHRONOUS, for the same reason as
 * DrizzleExpenseRepository's: drizzle 0.45's expo-sqlite `transaction(fn)`
 * runs `begin → fn → commit` without awaiting the callback, so an async
 * callback would commit before its writes landed. Every credit plus the
 * last-run stamp therefore commits as one unit — a half-applied payroll (some
 * accounts credited, some not) is not reachable.
 *
 * All queries are user-scoped (A10).
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { accounts, payrollAllocations, settings, type Account, type PayrollAllocation } from '@/db/schema';
import type { PayrollRepository } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

export class DrizzlePayrollRepository implements PayrollRepository {
  constructor(private readonly db: AnyDb) {}

  async list(userId: number): Promise<PayrollAllocation[]> {
    return (await this.db
      .select()
      .from(payrollAllocations)
      .where(eq(payrollAllocations.userId, userId))
      .orderBy(payrollAllocations.id)) as unknown as PayrollAllocation[];
  }

  /** One row per account: a second set for the same account replaces the amount. */
  async upsert(userId: number, accountId: number, amountSen: number): Promise<PayrollAllocation> {
    const rows = (await (this.db
      .insert(payrollAllocations)
      .values({ userId, accountId, amountSen })
      .onConflictDoUpdate({
        target: [payrollAllocations.userId, payrollAllocations.accountId],
        set: { amountSen, updatedAt: Date.now() },
      })
      .returning() as unknown as Promise<PayrollAllocation[]>)) as PayrollAllocation[];
    const row = rows[0];
    if (!row) throw new Error('Payroll allocation write failed');
    return row;
  }

  async remove(userId: number, accountId: number): Promise<void> {
    await this.db
      .delete(payrollAllocations)
      .where(
        and(eq(payrollAllocations.userId, userId), eq(payrollAllocations.accountId, accountId)),
      );
  }

  /**
   * Credit every allocated account by its amount and stamp the run time — one
   * transaction, all or nothing. Returns the accounts as they now stand.
   */
  async deposit(userId: number, runAt: number): Promise<Account[]> {
    const db = this.db as unknown as { transaction(fn: (tx: AnyTx) => Account[]): Account[] };
    return db.transaction((tx) => {
      const allocations = tx
        .select()
        .from(payrollAllocations)
        .where(eq(payrollAllocations.userId, userId))
        .all() as unknown as PayrollAllocation[];
      if (allocations.length === 0) throw new Error('no payroll allocations');

      for (const allocation of allocations) {
        tx.update(accounts)
          .set({
            // balance_sen = balance_sen + amount (single statement — atomic)
            balanceSen: sql`${accounts.balanceSen} + ${allocation.amountSen}`,
            updatedAt: runAt,
          })
          .where(and(eq(accounts.id, allocation.accountId), eq(accounts.userId, userId)))
          .run();
      }

      // The stamp lives on the settings row; create it if the user has none yet.
      tx.insert(settings)
        .values({ userId, payrollLastRunAt: runAt })
        .onConflictDoUpdate({
          target: settings.userId,
          set: { payrollLastRunAt: runAt, updatedAt: runAt },
        })
        .run();

      return tx
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            inArray(
              accounts.id,
              allocations.map((a) => a.accountId),
            ),
          ),
        )
        .all() as unknown as Account[];
    });
  }

  async lastRunAt(userId: number): Promise<number | null> {
    const rows = (await this.db
      .select({ at: settings.payrollLastRunAt })
      .from(settings)
      .where(eq(settings.userId, userId))) as unknown as { at: number | null }[];
    return rows[0]?.at ?? null;
  }
}
