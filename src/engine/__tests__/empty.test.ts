/**
 * Plan 009 — empty-database suite (PRD §11). With zero expenses and zero
 * commitments every analytics function zeroes out, and — the hard invariant —
 * NO NaN, Infinity, or negative zero can appear from ANY zero-denominator call
 * (acceptance criterion 3). Each engine denominator is exercised at 0 here:
 * monthOverMonth baseline, avgDaily elapsedDays, projectMonthEnd elapsedDays,
 * largest/top n. (Plan 020 removed the cash-flow and budget math.)
 */
import { describe, expect, it } from '@jest/globals';
import {
  avgDaily,
  largestExpenses,
  monthOverMonth,
  projectMonthEnd,
  topCategories,
} from '@/engine/analytics';
describe('empty database — analytics zeroes', () => {
  it('month-over-month of nothing vs nothing: zero sen, undefined pct', () => {
    expect(monthOverMonth(0, 0)).toEqual({ changeSen: 0, changePct: null });
  });

  it('average daily of nothing: 0 (elapsed days 0)', () => {
    expect(avgDaily(0, 0)).toBe(0);
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

  it('n = 0 slicing on largest/top → empty, never an error', () => {
    expect(largestExpenses([{ amountSen: 1 }], 0)).toEqual([]);
    expect(topCategories(new Map([[1, 1]]), 0)).toEqual([]);
  });

  it('the full empty-DB result set is finite everywhere (no Infinity seepage)', () => {
    const results = [
      avgDaily(0, 0),
      projectMonthEnd(0, 0, 30),
      monthOverMonth(0, 0).changeSen,
    ];
    expect(results.every((value) => Number.isFinite(value))).toBe(true);
    expect(results.every((value) => !Object.is(value, -0))).toBe(true);
  });
});