/**
 * Plan 009 — empty-database suite (PRD §11). With zero expenses and zero
 * commitments: safe = available − buffer exactly, allowance by days, every
 * analytics function zeroes out, and — the hard invariant — NO NaN, Infinity,
 * or negative zero can appear from ANY zero-denominator call (acceptance
 * criterion 3). Each engine denominator is exercised at 0 here:
 * dailyAllowance days, monthOverMonth baseline, avgDaily elapsedDays,
 * projectMonthEnd elapsedDays, budgetUtilization budget, largest/top n.
 */
import { describe, expect, it } from '@jest/globals';
import {
  avgDaily,
  budgetUtilization,
  largestExpenses,
  monthOverMonth,
  projectMonthEnd,
  topCategories,
} from '@/engine/analytics';
import {
  cashFlowBreakdown,
  dailyAllowance,
  safeToSpend,
  type SafeToSpendInput,
} from '@/engine/cashflow';

const EMPTY: SafeToSpendInput = {
  availableSen: 250000,
  upcomingSen: 0, // no commitments
  remainingBudgetSen: 0, // no budget set (the engine's "set a budget" state)
  bufferSen: 30000,
};

describe('empty database — cash flow', () => {
  it('safe = available − buffer exactly (nothing else subtracts)', () => {
    expect(safeToSpend(EMPTY)).toEqual({ safeSen: 220000, deficit: false });
  });

  it('allowance spreads the safe over every remaining day', () => {
    expect(dailyAllowance(220000, '2026-09-01', '2026-09-30')).toBe(7333); // 7333.33 → 7333
    expect(dailyAllowance(220000, '2026-09-30', '2026-09-30')).toBe(220000); // last day
  });

  it('breakdown is all labelled zeros summing to 0', () => {
    const zero: SafeToSpendInput = { availableSen: 0, upcomingSen: 0, remainingBudgetSen: 0, bufferSen: 0 };
    const items = cashFlowBreakdown(zero);
    expect(items).toHaveLength(4);
    expect(items.every((i) => Object.is(i.amountSen, 0))).toBe(true); // −0 fails Object.is
    expect(items.reduce((s, i) => s + i.amountSen, 0)).toBe(0);
  });
});

describe('empty database — analytics zeroes', () => {
  it('month-over-month of nothing vs nothing: zero sen, undefined pct', () => {
    expect(monthOverMonth(0, 0)).toEqual({ changeSen: 0, changePct: null });
  });

  it('average daily of nothing: 0 (elapsed days 0)', () => {
    expect(avgDaily(0, 0)).toBe(0);
  });

  it('budget utilization with no budget: null pct, not over', () => {
    expect(budgetUtilization(0, null)).toEqual({ pct: null, overBudget: false });
    expect(budgetUtilization(0, 0)).toEqual({ pct: null, overBudget: false });
  });

  it('projection of nothing: 0 (elapsed days 0)', () => {
    expect(projectMonthEnd(0, 0, 30)).toBe(0);
  });

  it('no largest expenses, no top categories', () => {
    expect(largestExpenses([], 5)).toEqual([]);
    expect(topCategories(new Map(), 3)).toEqual([]);
  });
});

describe('division-by-zero for EVERY denominator — finite, never NaN/Infinity/−0', () => {
  it('dailyAllowance: days = 0 → 0 (positive zero)', () => {
    expect(Object.is(dailyAllowance(6000, '2026-10-01', '2026-09-30'), 0)).toBe(true);
  });

  it('monthOverMonth: baseline 0 → pct null, changeSen finite', () => {
    const result = monthOverMonth(0, 0);
    expect(Number.isFinite(result.changeSen)).toBe(true);
    expect(Object.is(result.changeSen, 0)).toBe(true);
    expect(result.changePct).toBeNull();
  });

  it('avgDaily: elapsedDays 0 → 0', () => {
    expect(Object.is(avgDaily(0, 0), 0)).toBe(true);
  });

  it('projectMonthEnd: elapsedDays 0 → 0, and 0 sen stays 0 across any denominator', () => {
    expect(Object.is(projectMonthEnd(0, 0, 30), 0)).toBe(true);
    expect(Object.is(projectMonthEnd(0, 5, 30), 0)).toBe(true);
  });

  it('budgetUtilization: budget 0/null → pct null (no 0/0)', () => {
    expect(budgetUtilization(0, 0).pct).toBeNull();
    expect(budgetUtilization(12345, null).pct).toBeNull();
  });

  it('n = 0 slicing on largest/top → empty, never an error', () => {
    expect(largestExpenses([{ amountSen: 1 }], 0)).toEqual([]);
    expect(topCategories(new Map([[1, 1]]), 0)).toEqual([]);
  });

  it('the full empty-DB result set is finite everywhere (no Infinity seepage)', () => {
    const results = [
      safeToSpend(EMPTY).safeSen,
      dailyAllowance(0, '2026-10-01', '2026-09-30'),
      avgDaily(0, 0),
      projectMonthEnd(0, 0, 30),
      monthOverMonth(0, 0).changeSen,
      budgetUtilization(0, 0).pct ?? 0,
      cashFlowBreakdown(EMPTY).reduce((s, i) => s + i.amountSen, 0),
      ...cashFlowBreakdown(EMPTY).map((i) => i.amountSen),
    ];
    expect(results.every((value) => Number.isFinite(value))).toBe(true);
    expect(results.every((value) => !Object.is(value, -0))).toBe(true);
  });
});