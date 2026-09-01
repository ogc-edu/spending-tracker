/**
 * Financial engine — cash-flow math (plan 009 / ARCHITECTURE §6, PRD §8.4,
 * decision D2 — conservative).
 *
 * PURE module: no imports from db/, services/, or ai/; no I/O; no Date/now
 * calls — `today`/`monthEnd` are passed in as `YYYY-MM-DD` strings, so every
 * calculation is deterministic and unit-testable against hand-computed
 * fixtures. This module NEVER imports the 007/008 engines: its inputs
 * (upcoming total, remaining budget) are already-computed numbers, and 007/008
 * may not exist yet when this lands in parallel (plan 009 sequencing).
 *
 * The canonical formula (PRD §8.4):
 *   safe = available − upcoming − remainingBudget − buffer
 *
 * Documented invariants (also encoded as tests):
 * 1. The SPENT TERM CANCELS. Available already nets out spending (D1) and
 *    remaining budget subtracts it back in: `safe = startingAvailable −
 *    budget − commitments − buffer`, constant across the month. Safe changes
 *    only on rollover, commitment changes, balance corrections, or buffer
 *    edits — never on spending alone.
 * 2. `deficit = safeSen < 0` — safe returns raw (may be negative); the UI
 *    owns the deficit presentation state.
 * 3. Every division floors to the sen (ARCH §6), deterministically — for
 *    negative allowance, floor keeps the deficit direction conservative
 *    (floor(−2.1) = −3).
 * 4. `days` counts today INCLUSIVE through month-end INCLUSIVE; days = 0 → 0.
 */
import { daysRemainingInMonthInclusive } from '@/utils/dates';

/** The four cash-flow terms (PRD §8.4) — all pre-computed sen integers. */
export interface SafeToSpendInput {
  /** Σ account balances; credit-card owed amounts count negative (ACC-3). */
  availableSen: number;
  /** Σ unpaid payments due before next month start (008 output; excludes paid, D3). */
  upcomingSen: number;
  /** max(0, monthlyBudget − spent); 0 when no overall budget is set (BUD-4, D2). */
  remainingBudgetSen: number;
  /** User-defined safety buffer (SET-1; default RM300). */
  bufferSen: number;
}

export interface SafeToSpendResult {
  /** available − upcoming − remainingBudget − buffer; may be negative (deficit). */
  safeSen: number;
  /** `safeSen < 0` — the UI's explicit deficit flag (PRD §8.4 property 3). */
  deficit: boolean;
}

export interface CashFlowBreakdownItem {
  label: CashFlowBreakdownLabel;
  /**
   * SIGNED contribution: Available is positive, the three subtracted terms
   * are negative, so Σ amountSen === safeToSpend(...).safeSen — the formula
   * card (DASH-3) and the AI allowance payload (015) render terms summing to
   * the headline number.
   */
  amountSen: number;
}

export type CashFlowBreakdownLabel =
  | 'Available'
  | 'Upcoming commitments'
  | 'Remaining budget'
  | 'Safety buffer';

/**
 * Negate a sen term without producing −0 for zero inputs — the engine
 * invariant is "no negative zero anywhere" (plan 009 acceptance criteria 3).
 */
const negated = (sen: number): number => (sen === 0 ? 0 : -sen);

/** PRD §8.4 canonical formula. See module header for the cancellation invariant. */
export function safeToSpend({
  availableSen,
  upcomingSen,
  remainingBudgetSen,
  bufferSen,
}: SafeToSpendInput): SafeToSpendResult {
  const safeSen = availableSen - upcomingSen - remainingBudgetSen - bufferSen;
  return { safeSen, deficit: safeSen < 0 };
}

/**
 * Daily allowance (PRD §8.4): floor(safe / days) — integer sen, never
 * rounded. `days` runs from `today` inclusive through `monthEnd` inclusive
 * (last day of the month → 1 → the full remaining safe is allowed). days = 0
 * → 0 (even for negative safe — the "no days left" reading). Negative safe
 * yields a NEGATIVE allowance (floor keeps it conservative); the UI decides
 * presentation: explicit deficit state, never a misleading positive number.
 */
export function dailyAllowance(safeSen: number, today: string, monthEnd: string): number {
  const days = daysRemainingInMonthInclusive(today, monthEnd);
  if (days <= 0) return 0;
  return Math.floor(safeSen / days);
}

/**
 * The same four inputs rendered as labelled, SIGNED components for the
 * Dashboard's expandable formula card (DASH-3) and AI payload (015): the sum
 * of the items equals safeToSpend's safeSen (see CashFlowBreakdownItem).
 */
export function cashFlowBreakdown(input: SafeToSpendInput): CashFlowBreakdownItem[] {
  return [
    { label: 'Available', amountSen: input.availableSen },
    { label: 'Upcoming commitments', amountSen: negated(input.upcomingSen) },
    { label: 'Remaining budget', amountSen: negated(input.remainingBudgetSen) },
    { label: 'Safety buffer', amountSen: negated(input.bufferSen) },
  ];
}