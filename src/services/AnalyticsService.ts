/**
 * AnalyticsService (plan 011 / PRD §7.5 AN-1..4, ARCHITECTURE §2) — assembles
 * the typed SpendingSnapshot for an arbitrary selected month. This snapshot
 * is THE payload plan 014's "Analyze my spending" sends to the AI, so its
 * schema is fixed here (acceptance criterion 4).
 *
 * Data flow per plan §Technical Design:
 *   rows     = ExpenseRepository.listForMonth(selected month)   // (005)
 *   prevRows = ExpenseRepository.listForMonth(previous month)   // comparison is vs the PREVIOUS calendar month (AN-4)
 *   budget   = BudgetRepository.overallFor(selected month)      // (007) utilization
 *
 * CONSTRAINT: the service contains NO money arithmetic. Every figure is
 * produced by a pure 009 (or 005) engine function — monthlyTotals,
 * expenseTotalsByCategory, monthOverMonth, avgDaily, largestExpenses,
 * topCategories, budgetUtilization, projectMonthEnd — from explicitly
 * resolved inputs. The only math here is CALENDAR math (previous month,
 * elapsed days), which the engine delegates to the caller by design.
 *
 * SECURITY (plan §Security, A6): the snapshot carries categories/amounts/
 * dates but NEVER free-text expense descriptions — `largest` is a stripped
 * projection, so 014 can forward the snapshot to the AI without leaking
 * personal notes.
 */
import { z } from 'zod';
import type { Expense } from '@/db/schema';
import type {
  BudgetRepository,
  CategoryRepository,
  ExpenseRepository,
} from '@/repositories/types';
import { monthlyTotals, expenseTotalsByCategory, type MonthScope } from '@/engine/totals';
import {
  avgDaily,
  budgetUtilization,
  largestExpenses,
  monthOverMonth,
  projectMonthEnd,
  topCategories,
} from '@/engine/analytics';
import { daysInMonth, formatMonthLabel } from '@/utils/dates';
import type { CurrentUserSource } from './AccountService';

/** Service-boundary validation for a month selection (1–12, integer year). */
export const monthSelectionSchema = z.object({
  month: z
    .number({ error: 'Month required' })
    .int()
    .min(1, 'Invalid month')
    .max(12, 'Invalid month'),
  year: z.number({ error: 'Year required' }).int(),
});

/** The ANALYTICS month to render, e.g. { month: 9, year: 2026 }. */
export type AnalyticsMonth = MonthScope;

/** One category's spend in the month (snapshot rows are the 014 AI payload). */
export interface CategorySpend {
  categoryId: number;
  categoryName: string;
  amountSen: number;
}

/**
 * One of the largest expenses — the SAFE projection of an Expense for the
 * 014 AI payload: identity/amount/date/category ONLY, never the free-text
 * `description` (A6 hygiene: descriptions stay on-device, plan §Security).
 */
export interface LargestExpense {
  id: number;
  amountSen: number;
  date: string;
  categoryId: number;
  categoryName: string;
}

/** Budget utilization for the selected month — null when no OVERALL budget is set. */
export interface SnapshotUtilization {
  /** Percentage of the budget used, one decimal, floored; null only via an impossible bad row. */
  pct: number | null;
  overBudget: boolean;
}

/** The typed, JSON-serializable analytics snapshot (014's exact AI payload). */
export interface SpendingSnapshot {
  month: AnalyticsMonth;
  /** Total spent in the selected month, sen. */
  totalSen: number;
  /** Per-category totals, sorted DESCENDING by amountSen (full breakdown). */
  breakdown: CategorySpend[];
  /** Previous calendar month + its total (the MoM baseline, AN-4). */
  previousMonth: { month: AnalyticsMonth; totalSen: number };
  /** current − previous, sen (negative when spending FELL). */
  changeSen: number;
  /** One-decimal floored % change; NULL when previous total is 0 (UI "—"). */
  changePct: number | null;
  /** Average daily spend to date (floor); 0 when elapsedDays = 0. */
  avgDailySen: number;
  /** Top 5 largest expenses, descending; ties keep input order. */
  largest: LargestExpense[];
  /** Top 5 highest-spending categories, descending. */
  topCategories: CategorySpend[];
  /** null = no overall budget for the month ("no budget"). */
  utilization: SnapshotUtilization | null;
  /** End-of-month projection `spent ÷ elapsedDays × daysInMonth`, floored (AN-3). */
  projectionSen: number;
  /** Completed days of the selected month (0 on the 1st / future months). */
  elapsedDays: number;
  /** Calendar days in the selected month (leap-aware). */
  daysInMonth: number;
  /** e.g. "September 2026" — display label. */
  monthLabel: string;
}

/** Previous calendar month (year rollover: Jan → Dec of the year before) — ARCH §5 shift formula. */
function previousMonth(scope: AnalyticsMonth): AnalyticsMonth {
  const total = scope.year * 12 + (scope.month - 1) - 1;
  return { month: (total % 12) + 1, year: Math.floor(total / 12) };
}

export class AnalyticsService {
  constructor(
    private readonly expenses: ExpenseRepository,
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryRepository,
    private readonly auth: CurrentUserSource,
    /** Injectable clock for deterministic elapsed-day tests; the app passes nothing. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * Completed days of the selected month, resolved from the injected clock —
   * dates are CALLER-resolved so the engine stays pure (it takes elapsedDays
   * as a plain number). Semantics (plan §Edge cases):
   *   current month → today's day-of-month − 1 (0 on the 1st);
   *   past month    → the full month (complete);
   *   future month  → 0 (nothing elapsed yet).
   */
  private elapsedDaysFor(scope: AnalyticsMonth): number {
    const today = this.now();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    if (todayYear === scope.year && todayMonth === scope.month) {
      return Math.max(0, todayDay - 1);
    }
    // Past month — fully elapsed, use the whole month (avg = spent ÷ daysInMonth).
    if (todayYear > scope.year || (todayYear === scope.year && todayMonth > scope.month)) {
      return daysInMonth(scope.year, scope.month);
    }
    return 0;
  }

  /**
   * Build the SpendingSnapshot for an arbitrary selected month (no range
   * limit — any month with data is reachable, AN-4). Every figure flows
   * through a pure engine function; this method only wires repo rows + dates
   * into them and shapes the output for the UI/AI.
   */
  async analyzePeriod(month: AnalyticsMonth): Promise<SpendingSnapshot> {
    const parsed = monthSelectionSchema.safeParse(month);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? 'invalid month selection');
    }
    const userId = await this.requireUserId();
    const scope = parsed.data;
    const previous = previousMonth(scope);

    const [rows, prevRows, budget, categoryRows] = await Promise.all([
      this.expenses.listForMonth(userId, scope.year, scope.month),
      this.expenses.listForMonth(userId, previous.year, previous.month),
      this.budgets.overallFor(userId, scope.month, scope.year),
      this.categories.list(),
    ]);

    const totalSen = monthlyTotals(rows, scope);
    const prevTotalSen = monthlyTotals(prevRows, previous);
    const byCategory = expenseTotalsByCategory(rows, scope);

    const nameById = new Map(categoryRows.map((c) => [c.id, c.name] as const));
    const toCategorySpend = ([categoryId, amountSen]: readonly [number, number]): CategorySpend => ({
      categoryId,
      amountSen,
      categoryName: nameById.get(categoryId) ?? 'Unknown',
    });
    // `largestExpenses` types rows as AmountRowLike; these ARE Expense rows, so
    // a single boundary cast yields the stripped LargestExpense projection.
    const toLargest = (row: Expense): LargestExpense => ({
      id: row.id,
      amountSen: row.amountSen,
      date: row.date,
      categoryId: row.categoryId,
      categoryName: nameById.get(row.categoryId) ?? 'Unknown',
    });

    const elapsedDays = this.elapsedDaysFor(scope);
    const days = daysInMonth(scope.year, scope.month);
    const mom = monthOverMonth(totalSen, prevTotalSen);

    return {
      month: { ...scope },
      totalSen,
      // Full breakdown sorted desc = engine topCategories over the WHOLE map (n = size).
      breakdown: topCategories(byCategory, byCategory.size).map(toCategorySpend),
      previousMonth: { month: { ...previous }, totalSen: prevTotalSen },
      changeSen: mom.changeSen,
      changePct: mom.changePct,
      avgDailySen: avgDaily(totalSen, elapsedDays),
      largest: (largestExpenses(rows, 5) as Expense[]).map(toLargest),
      topCategories: topCategories(byCategory, 5).map(toCategorySpend),
      utilization: budget === null ? null : budgetUtilization(totalSen, budget.amountSen),
      projectionSen: projectMonthEnd(totalSen, elapsedDays, days),
      elapsedDays,
      daysInMonth: days,
      monthLabel: formatMonthLabel(scope.year, scope.month),
    };
  }
}
