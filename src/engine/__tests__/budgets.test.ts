/**
 * Plan 007 — engine budget metrics (pure). Fixture matrix per plan §Tests:
 * zero/partial/exact/over spent, pct flooring at one decimal (never rounds),
 * remaining floor at 0 (BUD-4), the spent == budget boundary (NOT over), and
 * the no-budget / division-by-zero guards.
 */
import { describe, expect, it } from '@jest/globals';
import { budgetMetrics } from '@/engine/budgets';

describe('budgetMetrics', () => {
  it('returns null metrics when no budget is set (UI shows "no budget")', () => {
    expect(budgetMetrics(null, 13250)).toEqual({
      spent: 13250,
      remaining: null,
      pctUsed: null,
      overBudget: false,
    });
  });

  it('partial spend: remaining = budget − spent, one-decimal pct', () => {
    // RM1,000.00 budget, RM120.50 spent: 12050 × 1000 / 100000 = 120.5 → floor 120 → 12.0
    expect(budgetMetrics(100000, 12050)).toEqual({
      spent: 12050,
      remaining: 87950,
      pctUsed: 12.0,
      overBudget: false,
    });
  });

  it('floors the percentage at one decimal — never rounds up', () => {
    // RM300.00 budget: 104 sen → 104000/30000 = 3.466… → 0.3;
    // 105 sen → 105000/30000 = 3.5 → floor 3 → 0.3 (rounding would give 0.4).
    expect(budgetMetrics(30000, 104).pctUsed).toBe(0.3);
    expect(budgetMetrics(30000, 105).pctUsed).toBe(0.3);
  });

  it('spent == budget is exactly 100% and NOT over-budget (boundary)', () => {
    expect(budgetMetrics(100000, 100000)).toEqual({
      spent: 100000,
      remaining: 0,
      pctUsed: 100.0,
      overBudget: false,
    });
  });

  it('spent == budget + 1 sen IS over-budget', () => {
    const m = budgetMetrics(100000, 100001);
    expect(m.overBudget).toBe(true);
    expect(m.remaining).toBe(0);
    expect(m.pctUsed).toBe(100.0); // 100001×1000/100000 = 1000.01 → floor 1000 → 100.0
  });

  it('remaining floors at 0 when over budget, pct exceeds 100 (BUD-4)', () => {
    expect(budgetMetrics(50000, 60000)).toEqual({
      spent: 60000,
      remaining: 0, // not −10000
      pctUsed: 120.0,
      overBudget: true,
    });
  });

  it('zero spend: remaining = budget, pct 0, not over', () => {
    expect(budgetMetrics(100000, 0)).toEqual({
      spent: 0,
      remaining: 100000,
      pctUsed: 0,
      overBudget: false,
    });
  });

  it('guards division by zero and negative budgets (treated as no budget)', () => {
    expect(budgetMetrics(0, 100)).toEqual({ spent: 100, remaining: null, pctUsed: null, overBudget: false });
    expect(budgetMetrics(-5, 100).pctUsed).toBeNull();
  });

  it('does not mutate inputs and stays integer-exact', () => {
    const m = budgetMetrics(33333, 11111);
    // 11111000/33333 = 333.33… → floor 333 → 33.3 — no float drift in sen math
    expect(m.pctUsed).toBe(33.3);
  });
});