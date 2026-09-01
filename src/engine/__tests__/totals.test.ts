/**
 * Plan 005 — engine month totals (pure). Hand-computed fixtures covering
 * month-boundary inclusivity (1st/31st, next-month exclusion, leap Feb,
 * December wrap), empty months → zero/empty map, and per-category keys.
 */
import { describe, expect, it } from '@jest/globals';
import { expenseTotalsByCategory, monthlyTotals, type ExpenseRowLike } from '@/engine/totals';

const SEPTEMBER: ExpenseRowLike[] = [
  { amountSen: 12050, date: '2026-09-01', categoryId: 1 }, // century date — inclusive
  { amountSen: 500, date: '2026-09-30', categoryId: 1 }, // last day of month
  { amountSen: 9999, date: '2026-08-31', categoryId: 2 }, // previous month — excluded
  { amountSen: 100, date: '2026-10-01', categoryId: 1 }, // next month — excluded
  { amountSen: 700, date: '2026-09-15', categoryId: 2 },
  { amountSen: 250, date: '2025-09-15', categoryId: 3 }, // same month, different year — excluded
];

describe('monthlyTotals', () => {
  it('sums only the matching local month (hand-computed)', () => {
    // 12050 + 500 + 700 = 13250; the 08/10/2025 rows must not count.
    expect(monthlyTotals(SEPTEMBER, { month: 9, year: 2026 })).toBe(13250);
  });

  it('is inclusive of the 1st and last day of the month', () => {
    const edges = [
      { amountSen: 100, date: '2026-02-01', categoryId: 1 },
      { amountSen: 200, date: '2026-02-28', categoryId: 1 },
      { amountSen: 400, date: '2026-03-01', categoryId: 1 },
    ];
    expect(monthlyTotals(edges, { month: 2, year: 2026 })).toBe(300);
  });

  it('includes leap-day February in a leap year', () => {
    const rows = [{ amountSen: 777, date: '2024-02-29', categoryId: 1 }];
    expect(monthlyTotals(rows, { month: 2, year: 2024 })).toBe(777);
    expect(monthlyTotals(rows, { month: 3, year: 2024 })).toBe(0);
  });

  it('returns zero for empty months and empty lists', () => {
    expect(monthlyTotals([], { month: 9, year: 2026 })).toBe(0);
    expect(monthlyTotals(SEPTEMBER, { month: 1, year: 2030 })).toBe(0);
  });
});

describe('expenseTotalsByCategory', () => {
  it('groups by category for the matching month only', () => {
    const totals = expenseTotalsByCategory(SEPTEMBER, { month: 9, year: 2026 });
    expect(totals.get(1)).toBe(12550); // 12050 + 500
    expect(totals.get(2)).toBe(700);
    expect(totals.has(3)).toBe(false); // 2025 row excluded
    expect(totals.size).toBe(2);
  });

  it('returns an empty map for empty months', () => {
    expect(expenseTotalsByCategory([], { month: 9, year: 2026 }).size).toBe(0);
    expect(expenseTotalsByCategory(SEPTEMBER, { month: 12, year: 2026 }).size).toBe(0);
  });

  it('does not mutate the input list', () => {
    const rows: ExpenseRowLike[] = [{ amountSen: 5, date: '2026-09-02', categoryId: 9 }];
    expenseTotalsByCategory(rows, { month: 9, year: 2026 });
    expect(rows).toHaveLength(1);
  });
});