/**
 * Financial engine — budget metrics (plan 007 / ARCHITECTURE §6, PRD BUD-1..4).
 *
 * PURE module: no imports from db/, services/, or ai/; no I/O; no date calls.
 * Callers pass already-fetched sen values, so every metric is deterministic and
 * unit-testable against hand-computed fixtures.
 *
 * Metrics contract (plan 007 §Technical Design):
 *   remaining = max(0, budget − spent)                    (BUD-4 — floors at 0)
 *   pctUsed   = floor(spent × 1000 / budget) / 10         (one decimal,
 *                                                          integer-sen math —
 *                                                          ARCH §6 rounding)
 *   overBudget = spent > budget                           (equality is NOT over)
 *   no budget set → remaining/pctUsed null, overBudget false (UI shows "—" /
 *   "no budget"; PRD §8.4 treats a missing overall budget as term 0 in the
 *   cash-flow formula, which is the dashboard's concern — plan 010, never here).
 */

export interface BudgetMetrics {
  /** Amount spent this month (sen) — passed through unchanged. */
  spent: number;
  /**
   * max(0, budget − spent). Null when no budget is set (UI shows "no budget").
   */
  remaining: number | null;
  /**
   * floor(spent × 1000 / budget) / 10 — always one decimal (12.0, 0.3, 138.5).
   * Null when no budget is set. May exceed 100 when over budget.
   */
  pctUsed: number | null;
  /** spent > budget — equality is NOT over (plan §Edge cases, boundary-tested). */
  overBudget: boolean;
}

/**
 * Deterministic per-budget metrics (BUD-2). `budgetSen` null (or a non-positive
 * guard value — service validation requires > 0, so budget 0 never reaches
 * production; the guard also prevents a division by zero) means "no budget":
 * remaining/pctUsed null and overBudget false.
 */
export function budgetMetrics(budgetSen: number | null, spentSen: number): BudgetMetrics {
  const spent = spentSen;
  if (budgetSen === null || budgetSen <= 0) {
    return { spent, remaining: null, pctUsed: null, overBudget: false };
  }
  const remaining = Math.max(0, budgetSen - spentSen);
  // Integer-sen math: multiply first so the division is exact to 1/10 sen,
  // then floor (never round) and divide back to one decimal (ARCH §6).
  const pctUsed = Math.floor((spentSen * 1000) / budgetSen) / 10;
  const overBudget = spentSen > budgetSen;
  return { spent, remaining, pctUsed, overBudget };
}