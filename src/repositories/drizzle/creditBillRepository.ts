/**
 * Drizzle CreditBillRepository (plan 020) — persists credit bill payments and
 * provides transaction support for atomic bill payments and reversals.
 *
 * All methods are user-scoped (A10) — every query filters by `userId`.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  accounts,
  creditBillPayments,
  expenseInstallments,
  expenses,
  type Account,
  type CreditBillPayment,
  type Expense,
  type ExpenseInstallment,
} from '@/db/schema';
import type { CreditBillRepository, CreditBillTx } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

export class DrizzleCreditBillRepository implements CreditBillRepository {
  constructor(private readonly db: AnyDb) {}

  async listPayments(userId: number, accountId?: number): Promise<CreditBillPayment[]> {
    const conditions = [eq(creditBillPayments.userId, String(userId))];
    if (accountId != null) {
      conditions.push(eq(creditBillPayments.accountId, String(accountId)));
    }
    return (await this.db
      .select()
      .from(creditBillPayments)
      .where(and(...conditions))
      .orderBy(desc(creditBillPayments.paidDate), desc(creditBillPayments.id))) as unknown as CreditBillPayment[];
  }

  async paymentById(userId: number, paymentId: string): Promise<CreditBillPayment | null> {
    const rows = (await this.db
      .select()
      .from(creditBillPayments)
      .where(
        and(
          eq(creditBillPayments.userId, String(userId)),
          eq(creditBillPayments.id, paymentId),
        ),
      )) as unknown as CreditBillPayment[];
    return rows[0] ?? null;
  }

  async paymentsForBill(
    userId: number,
    accountId: number,
    billYear: number,
    billMonth: number,
  ): Promise<CreditBillPayment[]> {
    return (await this.db
      .select()
      .from(creditBillPayments)
      .where(
        and(
          eq(creditBillPayments.userId, String(userId)),
          eq(creditBillPayments.accountId, String(accountId)),
          eq(creditBillPayments.billYear, billYear),
          eq(creditBillPayments.billMonth, billMonth),
        ),
      )
      .orderBy(creditBillPayments.paidDate)) as unknown as CreditBillPayment[];
  }

  async transaction<T>(fn: (tx: CreditBillTx) => T): Promise<T> {
    const db = this.db as unknown as { transaction(fn: (tx: AnyTx) => T): T };
    return db.transaction((tx) => fn(this.makeTx(tx)));
  }

  private makeTx(tx: AnyTx): CreditBillTx {
    return {
      getAccount: (userId: number, accountId: number): Account | null => {
        const rows = tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
          .all() as unknown as Account[];
        return rows[0] ?? null;
      },
      adjustBalance: (userId: number, accountId: number, deltaSen: number): void => {
        tx.update(accounts)
          .set({
            balanceSen: sql`${accounts.balanceSen} + ${deltaSen}`,
            updatedAt: Date.now(),
          })
          .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
          .run();
      },
      insertPayment: (input): CreditBillPayment => {
        const rows = tx
          .insert(creditBillPayments)
          .values({
            id: input.id ?? crypto.randomUUID(),
            userId: String(input.userId),
            accountId: String(input.accountId),
            billYear: input.billYear,
            billMonth: input.billMonth,
            amountSen: input.amountSen,
            paidDate: input.paidDate,
            fromAccountId: String(input.fromAccountId),
            createdAt: input.createdAt ?? new Date().toISOString(),
          })
          .returning()
          .all() as unknown as CreditBillPayment[];
        const row = rows[0];
        if (!row) throw new Error('credit bill payment insert failed');
        return row;
      },
      getPaymentById: (userId: number, paymentId: string): CreditBillPayment | null => {
        const rows = tx
          .select()
          .from(creditBillPayments)
          .where(
            and(
              eq(creditBillPayments.userId, String(userId)),
              eq(creditBillPayments.id, paymentId),
            ),
          )
          .all() as unknown as CreditBillPayment[];
        return rows[0] ?? null;
      },
      deletePayment: (userId: number, paymentId: string): void => {
        tx.delete(creditBillPayments)
          .where(
            and(
              eq(creditBillPayments.userId, String(userId)),
              eq(creditBillPayments.id, paymentId),
            ),
          )
          .run();
      },
      listPaymentsForAccount: (userId: number, accountId: number): CreditBillPayment[] => {
        return tx
          .select()
          .from(creditBillPayments)
          .where(
            and(
              eq(creditBillPayments.userId, String(userId)),
              eq(creditBillPayments.accountId, String(accountId)),
            ),
          )
          .orderBy(creditBillPayments.paidDate, creditBillPayments.id)
          .all() as unknown as CreditBillPayment[];
      },
      listExpensesForAccount: (userId: number, accountId: number): Expense[] => {
        return tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.userId, userId), eq(expenses.accountId, accountId)))
          .orderBy(expenses.date, expenses.id)
          .all() as unknown as Expense[];
      },
      listInstallments: (userId: number): ExpenseInstallment[] => {
        return tx
          .select()
          .from(expenseInstallments)
          .where(eq(expenseInstallments.userId, String(userId)))
          .all() as unknown as ExpenseInstallment[];
      },
    };
  }
}
