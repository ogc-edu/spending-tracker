/**
 * CommitmentService (plan 008 / ARCHITECTURE §2, §10) — business rules for
 * commitments: create (fixed XOR ongoing XOR one-time), derive schedules via
 * the pure engine, mark payments paid (D3: paid record + linked Debt/
 * Repayment expense + balance adjustment + remaining decrement in ONE
 * transaction, idempotent), un-pay (E7's counterpart — full reversal in one
 * transaction), cancel (terminal), and delete per C1 (archive when the
 * commitment has paid payments, hard delete only when it has none).
 *
 * User-scoping comes from the injected auth handle (A10). Validation is
 * double by design (the form schema rejects strings first; this boundary
 * re-validates the parsed sen input — never trust the caller). Money stays in
 * sen; the engine does every derivation; this layer only orchestrates.
 */
import { z } from 'zod';
import { DATE_RE, addMonthsClamped, isValidDateStr, todayLocal } from '@/utils/dates';
import {
  COMMITMENT_FREQUENCIES,
  COMMITMENT_TYPES,
  type CommitmentInput,
  type CommitmentRepository,
  type CommitmentStatus,
} from '@/repositories/types';
import type { Commitment, CommitmentPayment, Expense } from '@/db/schema';
import {
  commitmentSchedule,
  commitmentSlotAt,
  upcomingCommitments,
  type CommitmentLike,
  type ScheduledPayment,
  type UpcomingResult,
} from '@/engine/commitments';
import { balanceEffectFor } from './ExpenseService';
import type { CurrentUserSource } from './AccountService';

/** The seeded category every auto-created repayment expense uses (PRD EXP-7, D3). */
export const DEBT_REPAYMENT_CATEGORY_NAME = 'Debt / Repayment';

/** Service-boundary validation — fixed XOR ongoing XOR one-time + sane dates. */
export const commitmentInputSchema = z
  .object({
    name: z
      .string({ error: 'Name required' })
      .trim()
      .min(1, 'Name required')
      .max(100, 'Name must be 100 characters or fewer'),
    type: z.enum(COMMITMENT_TYPES, { error: 'Choose a type' }),
    totalSen: z
      .number({ error: 'Total required' })
      .int('Total must be whole sen')
      .positive('Total must be greater than 0')
      .nullable(),
    paymentSen: z
      .number({ error: 'Payment required' })
      .int('Payment must be whole sen')
      .positive('Payment must be greater than 0'),
    frequency: z.enum(COMMITMENT_FREQUENCIES, { error: 'Choose a frequency' }),
    startDate: z
      .string({ error: 'Start date required' })
      .regex(DATE_RE, 'Start date must be YYYY-MM-DD')
      .refine(isValidDateStr, 'Enter a real start date'),
    endDate: z
      .string()
      .regex(DATE_RE, 'End date must be YYYY-MM-DD')
      .refine(isValidDateStr, 'Enter a real end date')
      .nullable(),
    dueDate: z
      .string({ error: 'Due date required' })
      .regex(DATE_RE, 'Due date must be YYYY-MM-DD')
      .refine(isValidDateStr, 'Enter a real due date'),
  })
  .refine((v) => v.frequency !== 'one_time' || v.totalSen === null, {
    message: 'One-time commitments have no total — enter the payment amount only',
    path: ['totalSen'],
  })
  .refine((v) => v.frequency !== 'monthly' || v.totalSen !== null || v.endDate === null, {
    message: 'Ongoing commitments have no end date',
    path: ['endDate'],
  })
  .refine((v) => v.endDate === null || v.endDate >= v.startDate, {
    message: 'End date must not be before the start date',
    path: ['endDate'],
  });

/** markPaid boundary — the dueDate must be a real date; account is optional (A15). */
export const markPaidSchema = z.object({
  commitmentId: z.number({ error: 'Commitment required' }).int().positive('Invalid commitment'),
  dueDate: z
    .string({ error: 'Due date required' })
    .regex(DATE_RE, 'Due date must be YYYY-MM-DD')
    .refine(isValidDateStr, 'Enter a real due date'),
  accountId: z.number({ error: 'Invalid account' }).int().positive('Invalid account').nullable().optional(),
});

export type ValidatedCommitmentInput = z.infer<typeof commitmentInputSchema>;
export type ValidatedMarkPaid = z.infer<typeof markPaidSchema>;

function parseInput(input: CommitmentInput): ValidatedCommitmentInput {
  const result = commitmentInputSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? 'invalid commitment input');
  }
  return result.data;
}

function parseMarkPaid(input: {
  commitmentId: number;
  dueDate: string;
  accountId?: number | null;
}): ValidatedMarkPaid {
  const result = markPaidSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? 'invalid mark-paid input');
  }
  return result.data;
}

function assertId(value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error('invalid id');
}

export class CommitmentService {
  constructor(
    private readonly commitments: CommitmentRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * Create a commitment. Shape normalization (fixed XOR ongoing XOR one-time):
   * monthly schedules anchor at startDate (ARCH §7 — the due date mirrors the
   * anchor; end_date stays only for fixed); one-time schedules live entirely
   * on dueDate. remaining_sen starts at total (fixed) or 0 (ongoing/one-time —
   * only fixed draw down, so only fixed can auto-complete).
   */
  async create(input: CommitmentInput): Promise<Commitment> {
    const userId = await this.requireUserId();
    const data = parseInput(input);
    const monthly = data.frequency === 'monthly';
    const anchor = monthly ? data.startDate : data.dueDate;
    return this.commitments.create(userId, {
      name: data.name,
      type: data.type,
      totalSen: data.totalSen,
      remainingSen: data.totalSen ?? 0,
      paymentSen: data.paymentSen,
      frequency: data.frequency,
      startDate: anchor,
      endDate: monthly && data.totalSen !== null ? data.endDate : null,
      dueDate: anchor,
    });
  }

  /**
   * Edit a commitment (plan 016 follow-up) — same shape rules as create.
   * Cancelled/archived commitments are terminal (delete + recreate instead);
   * editing back to a paid-down state recomputes remaining_sen from the paid
   * history (fixed: max(0, newTotal − paidSum); ongoing/one-time: 0), and a
   * completed commitment that is no longer paid down reopens (→ active).
   * Paid records themselves are never moved — the schedule re-derives.
   */
  async update(id: number, input: CommitmentInput): Promise<Commitment> {
    const userId = await this.requireUserId();
    assertId(id);
    const data = parseInput(input);
    const existing = await this.commitments.byId(userId, id);
    if (!existing) throw new Error('commitment not found');
    if (existing.status === 'cancelled') {
      throw new Error("Cancelled commitments can't be edited — delete and create a new one");
    }
    if (existing.archivedAt !== null) {
      throw new Error("Archived commitments can't be edited — restore it first");
    }
    const monthly = data.frequency === 'monthly';
    const anchor = monthly ? data.startDate : data.dueDate;
    const paid = await this.commitments.paymentsForCommitment(userId, id);
    const paidSen = paid.reduce((sum, p) => sum + p.amountSen, 0);
    const remainingSen = data.totalSen !== null ? Math.max(0, data.totalSen - paidSen) : 0;
    const status: CommitmentStatus | undefined =
      existing.status === 'completed' && remainingSen > 0 ? 'active' : undefined;
    return this.commitments.update(userId, id, {
      name: data.name,
      type: data.type,
      totalSen: data.totalSen,
      remainingSen,
      paymentSen: data.paymentSen,
      frequency: data.frequency,
      startDate: anchor,
      endDate: monthly && data.totalSen !== null ? data.endDate : null,
      dueDate: anchor,
      status,
    });
  }

  /**
   * Mark a derived slot paid (D3 / ARCH §7, A5): ONE transaction that inserts
   * the paid record, decrements remaining (fixed only), inserts the linked
   * Debt/Repayment expense (unique commitment_payment_id = exactly once), and
   * adjusts the paying account's balance (assets −, credit + — the same sign
   * convention as plan 005). accountId is optional (A15): null skips the
   * balance adjustment. Idempotent: a second call for a paid slot is blocked.
   */
  async markPaid(
    commitmentId: number,
    dueDate: string,
    accountId?: number | null,
  ): Promise<CommitmentPayment> {
    const userId = await this.requireUserId();
    const data = parseMarkPaid({ commitmentId, dueDate, accountId: accountId ?? null });
    return this.commitments.transaction((tx) => {
      const commitment = tx.getById(userId, data.commitmentId);
      if (!commitment) throw new Error('commitment not found');
      if (commitment.status === 'cancelled') throw new Error('commitment is cancelled');
      if (commitment.archivedAt !== null) throw new Error('commitment is archived');
      const slot = commitmentSlotAt(commitment as CommitmentLike, data.dueDate);
      if (!slot) throw new Error(`no payment due on ${data.dueDate}`);
      if (tx.getPaymentByDueDate(userId, commitment.id, slot.dueDate)) {
        throw new Error('payment already recorded'); // double-tap blocked (plan §Edge cases)
      }
      if (data.accountId != null) {
        const account = tx.getAccount(userId, data.accountId);
        if (!account) throw new Error('unknown account');
        tx.adjustBalance(userId, account.id, balanceEffectFor(account, slot.amountSen));
      }
      const debtCategory = tx.getCategoryByName(DEBT_REPAYMENT_CATEGORY_NAME);
      if (!debtCategory) {
        throw new Error(`${DEBT_REPAYMENT_CATEGORY_NAME} category missing — reseed categories`);
      }
      const today = todayLocal();
      const payment = tx.insertPayment({
        userId,
        commitmentId: commitment.id,
        amountSen: slot.amountSen,
        dueDate: slot.dueDate,
        paidDate: today,
      });
      tx.insertExpense({
        userId,
        amountSen: slot.amountSen,
        categoryId: debtCategory.id,
        description: commitment.name,
        date: today,
        accountId: data.accountId ?? null,
        commitmentPaymentId: payment.id,
      });
      if (commitment.totalSen !== null) {
        tx.adjustRemaining(userId, commitment.id, -slot.amountSen);
        const after = tx.getById(userId, commitment.id);
        if (after && after.remainingSen === 0) {
          tx.updateStatus(userId, commitment.id, 'completed'); // COM-6 auto-complete
        }
      }
      return payment;
    });
  }

  /**
   * Un-pay (E7 counterpart, required so linked expenses can be removed): one
   * transaction that deletes the linked expense, deletes the paid record,
   * restores remaining (fixed only), and reverses the balance delta — exactly
   * the inverse of markPaid. Allowed for ANY paid slot (positions are
   * date-keyed; sum-based remaining stays correct). Un-paying the last payment
   * of a completed commitment reopens it (completed → active).
   */
  async unPay(paymentId: number): Promise<void> {
    const userId = await this.requireUserId();
    assertId(paymentId);
    return this.commitments.transaction((tx) => {
      const payment = tx.getPaymentById(userId, paymentId);
      if (!payment) throw new Error('payment not found');
      const commitment = tx.getById(userId, payment.commitmentId);
      if (!commitment) throw new Error('commitment not found');
      const expense = tx.getExpenseByCommitmentPaymentId(userId, payment.id);
      if (expense && expense.accountId !== null) {
        const account = tx.getAccount(userId, expense.accountId);
        if (account) {
          tx.adjustBalance(userId, account.id, -balanceEffectFor(account, expense.amountSen));
        }
      }
      if (expense) tx.deleteExpenseByCommitmentPaymentId(userId, payment.id);
      tx.deletePayment(userId, payment.id);
      if (commitment.totalSen !== null) {
        tx.adjustRemaining(userId, commitment.id, payment.amountSen);
        const after = tx.getById(userId, commitment.id);
        if (after && after.status === 'completed' && after.remainingSen > 0) {
          tx.updateStatus(userId, commitment.id, 'active');
        }
      }
    });
  }

  /** Cancel is TERMINAL (plan Decisions — re-create instead of re-activate); paid history is kept. */
  async cancel(commitmentId: number): Promise<void> {
    const userId = await this.requireUserId();
    assertId(commitmentId);
    return this.commitments.transaction((tx) => {
      const commitment = tx.getById(userId, commitmentId);
      if (!commitment) throw new Error('commitment not found');
      if (commitment.status !== 'cancelled') {
        tx.updateStatus(userId, commitmentId, 'cancelled');
      }
    });
  }

  /**
   * Delete per C1: hard-delete ONLY commitments with zero paid payments
   * (nothing to orphan); any commitment with paid payments is ARCHIVED
   * (archived_at set — every row stays, restorable via unarchive). Returns
   * which action was taken so the UI can say so.
   */
  async delete(commitmentId: number): Promise<{ action: 'deleted' | 'archived' }> {
    const userId = await this.requireUserId();
    assertId(commitmentId);
    return this.commitments.transaction((tx) => {
      const commitment = tx.getById(userId, commitmentId);
      if (!commitment) throw new Error('commitment not found');
      const paid = tx.countPayments(userId, commitmentId);
      if (paid > 0) {
        tx.setArchivedAt(userId, commitmentId, Date.now());
        return { action: 'archived' };
      }
      tx.deleteCommitment(userId, commitmentId);
      return { action: 'deleted' };
    });
  }

  /** Restore an archived commitment (C1). */
  async unarchive(commitmentId: number): Promise<void> {
    const userId = await this.requireUserId();
    assertId(commitmentId);
    return this.commitments.transaction((tx) => {
      const commitment = tx.getById(userId, commitmentId);
      if (!commitment) throw new Error('commitment not found');
      tx.setArchivedAt(userId, commitmentId, null);
    });
  }

  /** Includes archived rows (the archived detail view + restore). */
  async byId(id: number): Promise<Commitment | null> {
    return this.commitments.byId(await this.requireUserId(), id);
  }

  /** Non-archived commitments (any status), newest first — the Commitments tab. */
  async list(): Promise<Commitment[]> {
    return this.commitments.list(await this.requireUserId());
  }

  /** Archived commitments (C1), newest first — the restore list. */
  async listArchived(): Promise<Commitment[]> {
    return this.commitments.listArchived(await this.requireUserId());
  }

  /** Every paid record for the user (progress + upcoming inputs — A3: only paid rows persist). */
  async allPaidPayments(): Promise<CommitmentPayment[]> {
    return this.commitments.paidPayments(await this.requireUserId());
  }

  /** Paid records of one commitment, oldest first (detail schedule rows). */
  async paymentsForCommitment(commitmentId: number): Promise<CommitmentPayment[]> {
    return this.commitments.paymentsForCommitment(await this.requireUserId(), commitmentId);
  }

  /** The linked expenses of a commitment's paid records (paid-row → account pairing). */
  async expensesForCommitment(commitmentId: number): Promise<Expense[]> {
    return this.commitments.expensesForCommitment(await this.requireUserId(), commitmentId);
  }

  /**
   * The commitment's derived schedule (engine, bounded). Ongoing commitments
   * are infinite: without an explicit `to` the service defaults the window to
   * today + 12 months so the detail screen always gets a finite list past and
   * future; fixed/one-time are finite and need no default. Includes paid and
   * unpaid slots — the caller matches paid records to render rows.
   */
  async schedule(commitmentId: number, to?: string): Promise<ScheduledPayment[]> {
    const userId = await this.requireUserId();
    const commitment = await this.commitments.byId(userId, commitmentId);
    if (!commitment) throw new Error('commitment not found');
    const bound =
      to ??
      (commitment.totalSen === null ? addMonthsClamped(todayLocal(), 12) : undefined);
    return commitmentSchedule(commitment as CommitmentLike, undefined, bound);
  }

  /**
   * Upcoming obligations due before `windowEnd` (exclusive) — PRD COM-5 and
   * the dashboard/cash-flow input (plans 009/010). Unpaid slots only; paid,
   * cancelled, and archived excluded; overdue included (never hidden).
   */
  async upcoming(windowEnd: string): Promise<UpcomingResult> {
    const userId = await this.requireUserId();
    const [commitments, paid] = await Promise.all([
      this.commitments.list(userId),
      this.commitments.paidPayments(userId),
    ]);
    return upcomingCommitments(commitments as CommitmentLike[], paid, windowEnd);
  }
}