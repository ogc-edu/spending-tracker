/**
 * Financial engine — month totals (plan 005 / ARCHITECTURE §6).
 *
 * PURE module: no imports from db/, services/, or ai/; no I/O; no date calls.
 * Callers pass already-fetched expense rows; month matching happens here on
 * the `YYYY-MM-DD` local-date string via src/utils/dates (also pure), so every
 * calculation is deterministic and unit-testable.
 *
 * Consumed by budgets (007), the dashboard (010) and analytics (011) — as well
 * as the 005 expenses list header.
 */

import { isSameLocalMonth } from '@/utils/dates';

/** Structural row type — anything with an amount, a date and a category works. */
export interface ExpenseRowLike {
  amountSen: number;
  date: string;
  categoryId: number;
}

export interface MonthScope {
  month: number; // 1–12
  year: number;
}

/**
 * Sum of `amountSen` for expenses whose local date falls in the given month.
 * Empty months (and empty lists) → 0. Expenses from other months are excluded.
 */
export function monthlyTotals(expenses: readonly ExpenseRowLike[], { month, year }: MonthScope): number {
  let total = 0;
  for (const expense of expenses) {
    if (isSameLocalMonth(expense.date, month, year)) {
      total += expense.amountSen;
    }
  }
  return total;
}

/**
 * Per-category sums for the given month, keyed by category id.
 * Categories with no expenses in the month are absent (empty map for empty
 * months). Other months' expenses are excluded.
 */
export function expenseTotalsByCategory(
  expenses: readonly ExpenseRowLike[],
  { month, year }: MonthScope,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const expense of expenses) {
    if (isSameLocalMonth(expense.date, month, year)) {
      totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountSen);
    }
  }
  return totals;
}