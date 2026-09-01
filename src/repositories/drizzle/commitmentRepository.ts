/**
 * Drizzle CommitmentRepository (plan 008) — the only CommitmentRepository impl
 * in the MVP. Compatible with both the app's expo-sqlite AppDatabase (sync
 * session over openDatabaseSync) and the Node harness BetterSQLite3Database
 * (sync).
 *
 * `commitment_payments` stores ONLY PAID records (A3); the pending schedule
 * is derived by the engine, never written. Every WRITE runs inside
 * `transaction()` so mark-paid (payment + linked expense + account balance +
 * remaining) and un-pay (the reverse) are each ONE atomic step.
 *
 * THE TRANSACTION IS SYNCHRONOUS on purpose — the same drizzle 0.45
 * expo-sqlite commit-before-await trap documented in ExpenseRepository: the
 * tx-context methods return plain values and the service's callback awaits
 * nothing inside the txn.
 *
 * All queries are user-scoped (A10) — every WHERE filters by `userId`.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import {
  accounts,
  categories,
  commitmentPayments,
  commitments,
  expenses,
  type Account,
  type Category,
  type Commitment,
  type CommitmentPayment,
  type Expense,
} from '@/db/schema';
import type {
  CommitmentInput,
  CommitmentRepository,
  CommitmentStatus,
  CommitmentTx,
} from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;
/** The transactional handle drizzle passes to `transaction(fn)`. */
type AnyTx = Parameters<Parameters<AnyDb['transaction']>[0]>[0];

export class DrizzleCommitmentRepository implements CommitmentRepository {
  constructor(private readonly db: AnyDb) {}

  async create(userId: number, input: CommitmentInput & { remainingSen: number }): Promise<Commitment> {
    const rows = (await this.db
      .insert(commitments)
      .values({
        userId,
        name: input.name,
        type: input.type,
        totalSen: input.totalSen,
        remainingSen: input.remainingSen,
        paymentSen: input.paymentSen,
        frequency: input.frequency,
        startDate: input.startDate,
        endDate: input.endDate,
        dueDate: input.dueDate,
      })
      .returning()) as unknown as Commitment[];
    const row = rows[0];
    if (!row) throw new Error('commitment insert failed — row not found after insert');
    return row;
  }

  /** Includes archived rows (detail view / un-archive need them). */
  async byId(userId: number, id: number): Promise<Commitment | null> {
    const rows = (await this.db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, userId), eq(commitments.id, id)))) as unknown as Commitment[];
    return rows[0] ?? null;
  }

  /** Non-archived commitments (any status), newest first — the Commitments tab. */
  async list(userId: number): Promise<Commitment[]> {
    return (await this.db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, userId), isNull(commitments.archivedAt)))
      .orderBy(desc(commitments.id))) as unknown as Commitment[];
  }

  /** Archived commitments (C1), newest first — restore entry point. */
  async listArchived(userId: number): Promise<Commitment[]> {
    return (await this.db
      .select()
      .from(commitments)
      .where(and(eq(commitments.userId, userId), isNotNull(commitments.archivedAt)))
      .orderBy(desc(commitments.id))) as unknown as Commitment[];
  }

  /** EVERY paid record for the user, oldest first (upcoming + progress inputs). */
  async paidPayments(userId: number): Promise<CommitmentPayment[]> {
    return (await this.db
      .select()
      .from(commitmentPayments)
      .where(eq(commitmentPayments.userId, userId))
      .orderBy(asc(commitmentPayments.dueDate), asc(commitmentPayments.id))) as unknown as CommitmentPayment[];
  }

  /** Paid records of one commitment, oldest first (detail schedule rows). */
  async paymentsForCommitment(userId: number, commitmentId: number): Promise<CommitmentPayment[]> {
    return (await this.db
      .select()
      .from(commitmentPayments)
      .where(and(eq(commitmentPayments.userId, userId), eq(commitmentPayments.commitmentId, commitmentId)))
      .orderBy(asc(commitmentPayments.dueDate), asc(commitmentPayments.id))) as unknown as CommitmentPayment[];
  }

  /** The linked Debt/Repayment expenses of a commitment's paid records (detail pairing). */
  async expensesForCommitment(userId: number, commitmentId: number): Promise<Expense[]> {
    const paymentIds = (await this.paymentsForCommitment(userId, commitmentId)).map((p) => p.id);
    if (paymentIds.length === 0) return [];
    return (await this.db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, userId),
          inArray(expenses.commitmentPaymentId, paymentIds),
        ),
      )) as unknown as Expense[];
  }

  /**
   * One SQLite transaction (D1). The callback is SYNCHRONOUS (see
   * CommitmentTx); any throw rolls back every statement (mark-paid's four
   * writes, un-pay's three, C1's archive/delete…). The outer async wrapper
   * awaits only AFTER the driver has committed.
   */
  async transaction<T>(fn: (tx: CommitmentTx) => T): Promise<T> {
    const db = this.db as unknown as { transaction(fn: (tx: AnyTx) => T): T };
    return db.transaction((tx) => fn(this.makeTx(tx)));
  }

  /** Bind the synchronous tx-context over the driver's transaction handle. */
  private makeTx(tx: AnyTx): CommitmentTx {
    return {
      getById: (userId: number, id: number): Commitment | null => {
        const rows = tx
          .select()
          .from(commitments)
          .where(and(eq(commitments.userId, userId), eq(commitments.id, id)))
          .all() as unknown as Commitment[];
        return rows[0] ?? null;
      },
      getAccount: (userId: number, accountId: number): Account | null => {
        const rows = tx
          .select()
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
          .all() as unknown as Account[];
        return rows[0] ?? null;
      },
      getCategoryByName: (name: string): Category | null => {
        const rows = tx
          .select()
          .from(categories)
          .where(eq(categories.name, name))
          .all() as unknown as Category[];
        return rows[0] ?? null;
      },
      getPaymentByDueDate: (userId: number, commitmentId: number, dueDate: string): CommitmentPayment | null => {
        const rows = tx
          .select()
          .from(commitmentPayments)
          .where(
            and(
              eq(commitmentPayments.userId, userId),
              eq(commitmentPayments.commitmentId, commitmentId),
              eq(commitmentPayments.dueDate, dueDate),
            ),
          )
          .all() as unknown as CommitmentPayment[];
        return rows[0] ?? null;
      },
      getPaymentById: (userId: number, paymentId: number): CommitmentPayment | null => {
        const rows = tx
          .select()
          .from(commitmentPayments)
          .where(and(eq(commitmentPayments.userId, userId), eq(commitmentPayments.id, paymentId)))
          .all() as unknown as CommitmentPayment[];
        return rows[0] ?? null;
      },
      insertPayment: (input: {
        userId: number;
        commitmentId: number;
        amountSen: number;
        dueDate: string;
        paidDate: string;
      }): CommitmentPayment => {
        const rows = tx
          .insert(commitmentPayments)
          .values(input)
          .returning()
          .all() as unknown as CommitmentPayment[];
        const row = rows[0];
        if (!row) throw new Error('payment insert failed — row not found after insert');
        return row;
      },
      insertExpense: (input: {
        userId: number;
        amountSen: number;
        categoryId: number;
        description: string;
        date: string;
        accountId: number | null;
        commitmentPaymentId: number;
      }): Expense => {
        // The UNIQUE expenses.commitment_payment_id constraint is the DB
        // backstop for D3 idempotency (a payment's expense is created once).
        const rows = tx
          .insert(expenses)
          .values(input)
          .returning()
          .all() as unknown as Expense[];
        const row = rows[0];
        if (!row) throw new Error('expense insert failed — row not found after insert');
        return row;
      },
      getExpenseByCommitmentPaymentId: (userId: number, commitmentPaymentId: number): Expense | null => {
        const rows = tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.userId, userId), eq(expenses.commitmentPaymentId, commitmentPaymentId)))
          .all() as unknown as Expense[];
        return rows[0] ?? null;
      },
      deleteExpenseByCommitmentPaymentId: (userId: number, commitmentPaymentId: number): void => {
        tx.delete(expenses)
          .where(and(eq(expenses.userId, userId), eq(expenses.commitmentPaymentId, commitmentPaymentId)))
          .run();
      },
      deletePayment: (userId: number, paymentId: number): void => {
        tx.delete(commitmentPayments)
          .where(and(eq(commitmentPayments.userId, userId), eq(commitmentPayments.id, paymentId)))
          .run();
      },
      adjustRemaining: (userId: number, commitmentId: number, deltaSen: number): void => {
        tx.update(commitments)
          .set({
            remainingSen: sql`${commitments.remainingSen} + ${deltaSen}`,
            updatedAt: Date.now(),
          })
          .where(and(eq(commitments.id, commitmentId), eq(commitments.userId, userId)))
          .run();
      },
      updateStatus: (userId: number, commitmentId: number, status: CommitmentStatus): void => {
        tx.update(commitments)
          .set({ status, updatedAt: Date.now() })
          .where(and(eq(commitments.id, commitmentId), eq(commitments.userId, userId)))
          .run();
      },
      setArchivedAt: (userId: number, commitmentId: number, archivedAt: number | null): void => {
        tx.update(commitments)
          .set({ archivedAt, updatedAt: Date.now() })
          .where(and(eq(commitments.id, commitmentId), eq(commitments.userId, userId)))
          .run();
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
      countPayments: (userId: number, commitmentId: number): number => {
        const rows = tx
          .select({ n: sql<number>`count(*)`.mapWith(Number) })
          .from(commitmentPayments)
          .where(and(eq(commitmentPayments.userId, userId), eq(commitmentPayments.commitmentId, commitmentId)))
          .all() as unknown as { n: number }[];
        return rows[0]?.n ?? 0;
      },
      deleteCommitment: (userId: number, commitmentId: number): void => {
        tx.delete(commitments)
          .where(and(eq(commitments.id, commitmentId), eq(commitments.userId, userId)))
          .run();
      },
    };
  }
}