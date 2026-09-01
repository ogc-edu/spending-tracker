/**
 * Financial engine — commitment schedules & upcoming totals (plan 008 /
 * ARCHITECTURE §6-§7, PRD COM-1..6, §8.3-§8.4).
 *
 * PURE module: no imports from db/, services/, or ai/; no I/O; no Date/now
 * calls — dates are passed in as `YYYY-MM-DD` strings, so every derivation is
 * deterministic and unit-testable against hand-computed fixtures.
 *
 * Commitments are DERIVED, never materialized (A3): `commitment_payments`
 * stores only PAID records; pending slots are computed on the fly from the
 * commitment's shape. Shapes (ARCH §7):
 *   - one-time:        single slot, amount = paymentSen, due on `dueDate`
 *   - fixed monthly:   N slots anchored at `startDate` + k months, where
 *                      N = min(ceil(total/payment), months start→end when
 *                      `endDate` set); amount = paymentSen except the LAST
 *                      slot, which absorbs the remainder (≥ 1 sen)
 *   - ongoing monthly: infinite series anchored at `startDate`; only the
 *                      slots inside the query window are materialized
 *
 * The engine defines its own structural CommitmentLike shape (ARCH §6 — the
 * engine never imports the DB schema); repository rows satisfy it structurally.
 */
import { addMonthsClamped, isValidDateStr, monthsBetweenInclusive } from '@/utils/dates';

/** Structural commitment shape the engine derives from — see CommitmentRow. */
export interface CommitmentLike {
  id: number;
  /** NULL = ongoing recurring (rent/subscription) or one-time. Set = fixed installments. */
  totalSen: number | null;
  paymentSen: number;
  /** 'monthly' | 'one_time'. */
  frequency: 'monthly' | 'one_time';
  /** Schedule anchor: slots are startDate + k months (monthly). */
  startDate: string;
  /** Optional fixed-monthly cap: the series stops at the end month. */
  endDate: string | null;
  /** One-time due date (monthly: informational, equals the first slot). */
  dueDate: string;
  /** 'active' | 'completed' | 'cancelled'. */
  status: string;
  /** Soft-delete (C1): non-null = archived, hidden from lists/upcoming. */
  archivedAt: number | null;
}

/** One derived payment slot. Due dates are deterministic (ARCH §7 clamping). */
export interface ScheduledPayment {
  /** `YYYY-MM-DD` — the anchor day, clamped to the month's last valid day. */
  dueDate: string;
  amountSen: number;
  /** 0-based position in the commitment's schedule. */
  index: number;
}

/** One item in the upcoming-obligations window (PRD COM-5). */
export interface UpcomingCommitmentItem {
  commitment: CommitmentLike;
  dueDate: string;
  amountSen: number;
}

export interface UpcomingResult {
  /** Σ amountSen of every item — the "due before window end" total. */
  totalSen: number;
  items: UpcomingCommitmentItem[];
}

/** True when the commitment has a fixed total to draw down (mark-paid decrements it). */
export function isFixedCommitment(c: CommitmentLike): boolean {
  return c.totalSen !== null;
}

/** True when the commitment is hidden from default lists/upcoming (C1). */
export function isArchived(c: CommitmentLike): boolean {
  return c.archivedAt !== null;
}

/**
 * Derive the commitment's payment schedule (ARCH §7 / PRD COM-2).
 *
 * Window: `from` (inclusive lower bound) and `to` (EXCLUSIVE upper bound) are
 * optional `YYYY-MM-DD` strings — matching the PRD's "due before the start of
 * the next month" semantics (windowEnd is exclusive everywhere in this module).
 * Slots outside the window are dropped; with no window the full bounded
 * schedule is returned.
 *
 * One-time / fixed: schedule is finite — a window is optional.
 * Ongoing monthly: the series is infinite — `to` is REQUIRED (throws without
 * it); slots anchored at startDate + k months with dueDate < to.
 */
export function commitmentSchedule(
  c: CommitmentLike,
  from?: string,
  to?: string,
): ScheduledPayment[] {
  if (from !== undefined && !isValidDateStr(from)) throw new Error('invalid from date');
  if (to !== undefined && !isValidDateStr(to)) throw new Error('invalid to date');
  if (from !== undefined && to !== undefined && from >= to) return [];

  let slots: ScheduledPayment[];
  if (c.frequency === 'one_time') {
    slots = [{ dueDate: c.dueDate, amountSen: c.paymentSen, index: 0 }];
  } else if (isFixedCommitment(c)) {
    slots = fixedSchedule(c);
  } else {
    if (to === undefined) {
      throw new Error('ongoing commitments need a window end (to)');
    }
    slots = ongoingSchedule(c, to);
  }
  return slots.filter(
    (slot) => (from === undefined || slot.dueDate >= from) && (to === undefined || slot.dueDate < to),
  );
}

/**
 * Fixed monthly: N = min(ceil(total/payment), months start→end inclusive when
 * endDate set); last slot absorbs the remainder `total − (N−1)·payment`
 * (≥ 1 sen — guaranteed because N ≤ ceil(total/payment), so (N−1)·payment <
 * total). Includes 2026-01-31 → 2026-02-28-style day clamping (ARCH §7).
 */
function fixedSchedule(c: CommitmentLike): ScheduledPayment[] {
  const total = c.totalSen as number;
  const byCeil = Math.ceil(total / c.paymentSen);
  const byEnd = c.endDate ? monthsBetweenInclusive(c.startDate, c.endDate) : Infinity;
  const n = Math.min(byCeil, byEnd);
  const slots: ScheduledPayment[] = [];
  for (let k = 0; k < n; k += 1) {
    slots.push({
      dueDate: addMonthsClamped(c.startDate, k),
      amountSen: k < n - 1 ? c.paymentSen : total - (n - 1) * c.paymentSen,
      index: k,
    });
  }
  return slots;
}

/** Ongoing monthly: slots anchored at startDate + k months, dueDate < to. */
function ongoingSchedule(c: CommitmentLike, to: string): ScheduledPayment[] {
  const slots: ScheduledPayment[] = [];
  for (let k = 0; ; k += 1) {
    const dueDate = addMonthsClamped(c.startDate, k);
    if (dueDate >= to) break;
    slots.push({ dueDate, amountSen: c.paymentSen, index: k });
  }
  return slots;
}

/**
 * Locate the derived slot for an EXACT due date (mark-paid lookup, plan §Mark).
 * Returns null when the date is not on the commitment's grid: before the
 * anchor, beyond the fixed count, off-month, or not the one-time date.
 * The slot's amountSen is the grid's amount for that position (the fixed
 * remainder slot carries the remainder), so mark-paid always records what the
 * schedule says the slot is worth.
 */
export function commitmentSlotAt(c: CommitmentLike, dueDate: string): ScheduledPayment | null {
  if (!isValidDateStr(dueDate)) return null;
  if (c.frequency === 'one_time') {
    return dueDate === c.dueDate ? { dueDate, amountSen: c.paymentSen, index: 0 } : null;
  }
  const [dy, dm] = dueDate.split('-').map(Number);
  const [sy, sm] = c.startDate.split('-').map(Number);
  const k = dy * 12 + (dm - 1) - (sy * 12 + (sm - 1));
  if (k < 0) return null; // before the anchor
  if (addMonthsClamped(c.startDate, k) !== dueDate) return null; // off-grid (day clamp mismatch)
  if (isFixedCommitment(c)) {
    const byCeil = Math.ceil((c.totalSen as number) / c.paymentSen);
    const byEnd = c.endDate ? monthsBetweenInclusive(c.startDate, c.endDate) : Infinity;
    const n = Math.min(byCeil, byEnd);
    if (k >= n) return null; // beyond the fixed count
    const amountSen = k < n - 1 ? c.paymentSen : (c.totalSen as number) - (n - 1) * c.paymentSen;
    return { dueDate, amountSen, index: k };
  }
  return { dueDate, amountSen: c.paymentSen, index: k };
}

/**
 * Remainder math (plan 008 engine API): what `remaining_sen` SHOULD be after
 * the given paid amounts. For fixed commitments: max(0, total − Σ paid) —
 * sum-based (plan §unPay: "schedule positions are date-keyed; sum-based
 * remaining stays correct"), so paying slots out of order or un-paying any
 * slot always lands on the same number. Ongoing/one-time have no fixed total
 * (nothing to draw down): returns 0.
 */
export function remainingAfterPaid(c: CommitmentLike, paidAmounts: number[]): number {
  if (!isFixedCommitment(c)) return 0;
  const paid = paidAmounts.reduce((sum, amount) => sum + amount, 0);
  return Math.max(0, (c.totalSen as number) - paid);
}

/**
 * Upcoming obligations before a window end (PRD COM-5 / ARCH §7 / §8.3-§8.4):
 * every UNPAID slot with dueDate < windowEnd, across the given commitments —
 * including OVERDUE slots (they are in the past, hence < windowEnd, and still
 * must be paid) — and EXCLUDING paid slots (disjoint from expenses by
 * construction), cancelled commitments, and archived ones (C1).
 *
 * `windowEnd` is the EXCLUSIVE bound ("due before the start of next month"):
 * slots due ON windowEnd are outside the window.
 *
 * The double-count partition (PRD §8.3): a paid slot is an Expense (spent),
 * an unpaid slot is here (upcoming) — never both, never nowhere. Completed
 * commitments contribute nothing (their slots are all paid by construction).
 */
export function upcomingCommitments(
  commitments: CommitmentLike[],
  paidPayments: readonly { commitmentId: number; dueDate: string }[],
  windowEnd: string,
): UpcomingResult {
  const paidKeys = new Set(paidPayments.map((p) => `${p.commitmentId}:${p.dueDate}`));
  const items: UpcomingCommitmentItem[] = [];
  for (const commitment of commitments) {
    if (commitment.status === 'cancelled' || isArchived(commitment)) continue;
    const slots = commitmentSchedule(commitment, undefined, windowEnd);
    for (const slot of slots) {
      if (paidKeys.has(`${commitment.id}:${slot.dueDate}`)) continue;
      items.push({ commitment, dueDate: slot.dueDate, amountSen: slot.amountSen });
    }
  }
  const totalSen = items.reduce((sum, item) => sum + item.amountSen, 0);
  return { totalSen, items };
}