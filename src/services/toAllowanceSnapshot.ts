/**
 * Plan 015 — CashFlowSnapshot → AllowanceSnapshot mapping ("Explain my
 * allowance").
 *
 * Pure field mapping of the ALREADY-COMPUTED dashboard snapshot (010): the
 * AI never recalculates anything, so this must not recompute either — every
 * number is copied straight from the snapshot. The only derivation is
 * `daysRemaining`, which the CashFlowSnapshot does not carry: it is the same
 * calendar count the engine used for `dailyAllowanceSen` (today inclusive
 * through the snapshot month's end), so the caller passes the SAME reference
 * date the snapshot was built with.
 *
 * `hasBudget` mirrors the snapshot's flag: false exactly when the UI shows
 * "—" for the remaining budget (no overall budget set), signalling the AI
 * never to invent one (PRD §7.6; prompt covers "no budget set").
 */
import type { AllowanceSnapshot } from '@/ai/types';
import { daysRemainingInMonthInclusive, monthEndDate, toLocalDateString } from '@/utils/dates';
import type { CashFlowSnapshot } from './CashFlowService';

/**
 * Map the dashboard's CashFlowSnapshot onto the AI allowance payload.
 * `at` must be the same reference date used to build `snapshot` (the month
 * scope comes from the snapshot; a `at` outside that month yields 0 days
 * remaining — the engine's "no days left" reading, never a NaN).
 */
export function toAllowanceSnapshot(
  snapshot: CashFlowSnapshot,
  at: Date,
): AllowanceSnapshot {
  return {
    availableSen: snapshot.availableSen,
    upcomingSen: snapshot.upcomingSen,
    remainingBudgetSen: snapshot.remainingSen,
    bufferSen: snapshot.bufferSen,
    safeSen: snapshot.safeSen,
    dailyAllowanceSen: snapshot.dailyAllowanceSen,
    daysRemaining: daysRemainingInMonthInclusive(
      toLocalDateString(at),
      monthEndDate(snapshot.month.year, snapshot.month.month),
    ),
    hasBudget: snapshot.hasBudget,
  };
}