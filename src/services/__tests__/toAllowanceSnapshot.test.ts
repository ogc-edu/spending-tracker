/**
 * Plan 015 — CashFlowSnapshot → AllowanceSnapshot mapping ("Explain my
 * allowance"): pure field equality against the PRD §8.5 worked-example
 * fixture (300000 − 80000 − 184000 − 30000 = 6000 → 200 sen/day over 30
 * days), hasBudget variants (budget set / no budget → UI "—"), and the
 * daysRemaining derivation from the snapshot's reference date.
 */
import { describe, expect, it } from '@jest/globals';
import { toAllowanceSnapshot } from '../toAllowanceSnapshot';
import type { CashFlowSnapshot } from '../CashFlowService';
import type { Budget } from '@/db/schema';

const BUDGET: Budget = {
  id: 1,
  userId: 1,
  categoryId: null,
  month: 8,
  year: 2026,
  amountSen: 300_000,
  createdAt: 0,
  updatedAt: 0,
};

const base = (overrides: Partial<CashFlowSnapshot> = {}): CashFlowSnapshot => ({
  month: { month: 8, year: 2026 },
  availableSen: 300_000,
  spentSen: 116_000,
  budget: BUDGET,
  hasBudget: true,
  remainingSen: 184_000,
  upcomingSen: 80_000,
  upcomingItems: [],
  nextMonthSen: 0,
  nextMonthItems: [],
  bufferSen: 30_000,
  safeSen: 6_000,
  deficit: false,
  dailyAllowanceSen: 200,
  breakdown: [
    { label: 'Available', amountSen: 300_000 },
    { label: 'Upcoming commitments', amountSen: -80_000 },
    { label: 'Remaining budget', amountSen: -184_000 },
    { label: 'Safety buffer', amountSen: -30_000 },
  ],
  categorySummary: [],
  budgetMetrics: { spent: 116_000, remaining: 184_000, pctUsed: 38.6, overBudget: false },
  accountCount: 1,
  ...overrides,
});

describe('toAllowanceSnapshot', () => {
  it('maps every CashFlowSnapshot field onto the allowance payload unchanged (no recomputation)', () => {
    // Reference date = 2026-08-02 → 30 days remaining incl. today (PRD §8.5).
    const mapped = toAllowanceSnapshot(base(), new Date(2026, 7, 2));
    expect(mapped).toEqual({
      availableSen: 300_000,
      upcomingSen: 80_000,
      remainingBudgetSen: 184_000,
      bufferSen: 30_000,
      safeSen: 6_000,
      dailyAllowanceSen: 200,
      daysRemaining: 30,
      hasBudget: true,
    });
  });

  it('derives daysRemaining from the snapshot reference date (last day → 1)', () => {
    expect(
      toAllowanceSnapshot(base(), new Date(2026, 7, 31)).daysRemaining,
    ).toBe(1);
  });

  it('flags hasBudget false with a zero remaining budget term when no budget is set (UI shows "—")', () => {
    const noBudget = base({
      budget: null,
      hasBudget: false,
      remainingSen: 0,
      budgetMetrics: { spent: 116_000, remaining: null, pctUsed: null, overBudget: false },
      breakdown: [
        { label: 'Available', amountSen: 300_000 },
        { label: 'Upcoming commitments', amountSen: -80_000 },
        { label: 'Remaining budget', amountSen: 0 },
        { label: 'Safety buffer', amountSen: -30_000 },
      ],
    });
    expect(toAllowanceSnapshot(noBudget, new Date(2026, 7, 2))).toEqual({
      availableSen: 300_000,
      upcomingSen: 80_000,
      remainingBudgetSen: 0,
      bufferSen: 30_000,
      safeSen: 6_000,
      dailyAllowanceSen: 200,
      daysRemaining: 30,
      hasBudget: false,
    });
  });

  it('passes a negative safeSen through untouched (deficit — the AI explains it, never fixes it)', () => {
    const deficit = base({
      safeSen: -10_000,
      deficit: true,
      dailyAllowanceSen: -334,
    });
    const mapped = toAllowanceSnapshot(deficit, new Date(2026, 7, 2));
    expect(mapped.safeSen).toBe(-10_000);
    expect(mapped.dailyAllowanceSen).toBe(-334);
    expect(mapped.hasBudget).toBe(true);
  });

  it('returns 0 days remaining when the reference date falls outside the snapshot month (stale caller)', () => {
    expect(
      toAllowanceSnapshot(base(), new Date(2026, 8, 1)).daysRemaining,
    ).toBe(0);
  });
});