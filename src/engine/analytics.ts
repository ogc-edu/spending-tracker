/**
 * Financial engine — analytics math (plan 009 / ARCHITECTURE §6, PRD §7.5
 * AN-1..4, §8.2).
 *
 * PURE module: no imports at all (not even from db/, services/, ai/ or other
 * engine modules) — every function takes plain numbers/rows and an explicit
 * denominator, so each calculation is deterministic and unit-testable against
 * hand-computed fixtures. Month selection and date counts are resolved by the
 * CALLER (service layer, 011) and passed in as plain numbers.
 *
 * Rounding policy (ARCH §6): every division FLOORS — never rounds. Sen
 * values floor to the sen; percentages floor at one decimal via
 * `floor(n × 1000 / d) / 10` (deterministic, integer-sen input). For negative
 * change (MoM down), floor keeps the conservative direction:
 * floor(−12.4) = −13 → −1.3%.
 *
 * Zero-denominator guards are TOTAL: every function with a denominator
 * returns a sentinel (0 / null) instead of NaN/Infinity — see empty.test.ts.
 */

export interface MonthOverMonthResult {
  /** current − previous, in sen (negative when spending fell). */
  changeSen: number;
  /**
   * Percentage change at one decimal, floored (ARCH §6); NULL when the
   * baseline (previous) is 0 — the UI's "—" (undefined change, PRD AN-1).
   */
  changePct: number | null;
}

/**
 * Month-over-month vs the PREVIOUS calendar month (PRD AN-4). `current` /
 * `previous` are already-resolved month totals (sen). pct is null when
 * previous === 0 — a division by zero AND a genuinely undefined change.
 */
export function monthOverMonth(current: number, previous: number): MonthOverMonthResult {
  const changeSen = current - previous;
  const changePct =
    previous === 0 ? null : Math.floor((changeSen * 1000) / previous) / 10;
  return { changeSen, changePct };
}

/** Average daily spend to date (PRD AN-2): floor(spent / elapsedDays). */
export function avgDaily(spent: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 0;
  return Math.floor(spent / elapsedDays);
}

/** Structural row for largest-expense ordering — anything with a sen amount. */
export interface AmountRowLike {
  amountSen: number;
  [key: string]: unknown;
}

/**
 * The `n` largest expenses by amount, descending (PRD AN-2). Ties keep input
 * order (stable sort); the input array is NOT mutated. n ≤ 0 → [].
 */
export function largestExpenses(rows: readonly AmountRowLike[], n: number): AmountRowLike[] {
  return [...rows].sort((a, b) => b.amountSen - a.amountSen).slice(0, Math.max(0, n));
}

/**
 * The `n` highest-spending categories from a per-category breakdown
 * (005's expenseTotalsByCategory map), as [categoryId, totalSen] pairs,
 * descending by total (PRD AN-2). Ties keep insertion order. n ≤ 0 → [].
 */
export function topCategories(
  breakdown: ReadonlyMap<number, number>,
  n: number,
): [number, number][] {
  return [...breakdown.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, n));
}

export interface BudgetUtilizationResult {
  /**
   * Percentage of the budget used, one decimal, floored; NULL when no budget
   * is set (budgetSen null) or the budget is 0/negative (division by zero —
   * treated as "no budget", mirroring budgets.ts).
   */
  pct: number | null;
  /** spent > budget (spent == budget is exactly on budget, NOT over — BUD-2 boundary). */
  overBudget: boolean;
}

/** Budget utilization for analytics (PRD AN-2); see BudgetUtilizationResult. */
export function budgetUtilization(
  spentSen: number,
  budgetSen: number | null,
): BudgetUtilizationResult {
  if (budgetSen === null || budgetSen <= 0) {
    return { pct: null, overBudget: false };
  }
  return {
    pct: Math.floor((spentSen * 1000) / budgetSen) / 10,
    overBudget: spentSen > budgetSen,
  };
}

/**
 * Month-end projection (PRD AN-3): `spent ÷ elapsedDays × daysInMonth`,
 * floored to the sen. The product `spent × daysInMonth` is computed FIRST
 * (exact integer arithmetic), then floored — no float drift in the sen
 * result. elapsedDays ≤ 0 → 0 (nothing can be projected before the month
 * starts; also the division-by-zero guard).
 */
export function projectMonthEnd(
  spentSen: number,
  elapsedDays: number,
  daysInMonth: number,
): number {
  if (elapsedDays <= 0) return 0;
  return Math.floor((spentSen * daysInMonth) / elapsedDays);
}