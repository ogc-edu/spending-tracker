/**
 * Plan 019 — CashFlowSnapshot → AskSnapshot mapping for the "Ask about your
 * money" box: pure field equality, next-month commitments, category-name
 * resolution (incl. a dangling id), and the daysRemaining derivation.
 */
import { describe, expect, it } from '@jest/globals';
import { toAskSnapshot } from '../toAskSnapshot';
import type { CashFlowSnapshot } from '../CashFlowService';
import type { Budget, Category } from '@/db/schema';

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

const CATEGORIES: Category[] = [
  { id: 1, name: 'Food', icon: 'fast-food', type: 'expense', createdAt: 0 },
  { id: 2, name: 'Transport', icon: 'car', type: 'expense', createdAt: 0 },
];

const SNAPSHOT: CashFlowSnapshot = {
  month: { month: 8, year: 2026 },
  availableSen: 300_000,
  spentSen: 116_000,
  budget: BUDGET,
  hasBudget: true,
  remainingSen: 184_000,
  upcomingSen: 80_000,
  upcomingItems: [
    { commitmentId: 3, name: 'Rent', dueDate: '2026-08-25', amountSen: 80_000, frequency: 'monthly' },
  ],
  nextMonthSen: 120_000,
  nextMonthItems: [
    { commitmentId: 7, name: 'Car loan', dueDate: '2026-09-05', amountSen: 120_000, frequency: 'monthly' },
  ],
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
  categorySummary: [
    { categoryId: 1, totalSen: 100_000 },
    { categoryId: 2, totalSen: 16_000 },
  ],
  budgetMetrics: { spent: 116_000, remaining: 184_000, pctUsed: 38.6, overBudget: false },
  accountCount: 1,
};

describe('toAskSnapshot', () => {
  it('maps the allowance aggregates, next-month slots and category names (no recomputation)', () => {
    const mapped = toAskSnapshot(SNAPSHOT, new Date(2026, 7, 2), CATEGORIES);

    expect(mapped).toEqual({
      month: '2026-08',
      monthLabel: 'August 2026',
      availableSen: 300_000,
      spentSen: 116_000,
      hasBudget: true,
      budgetSen: 300_000,
      remainingBudgetSen: 184_000,
      bufferSen: 30_000,
      safeSen: 6_000,
      dailyAllowanceSen: 200,
      daysRemaining: 30,
      deficit: false,
      upcomingThisMonthSen: 80_000,
      upcomingThisMonth: [{ name: 'Rent', dueDate: '2026-08-25', amountSen: 80_000 }],
      nextMonthSen: 120_000,
      nextMonth: [{ name: 'Car loan', dueDate: '2026-09-05', amountSen: 120_000 }],
      topCategories: [
        { name: 'Food', amountSen: 100_000 },
        { name: 'Transport', amountSen: 16_000 },
      ],
    });
  });

  it('carries no ids/frequency beyond the ask shape and never a description (A6)', () => {
    const mapped = toAskSnapshot(SNAPSHOT, new Date(2026, 7, 2), CATEGORIES);
    expect(mapped.nextMonth[0]).not.toHaveProperty('commitmentId');
    expect(mapped.nextMonth[0]).not.toHaveProperty('frequency');
    expect(JSON.stringify(mapped).toLowerCase()).not.toContain('description');
  });

  it('maps no budget to budgetSen null and hasBudget false (the AI must not invent one)', () => {
    const mapped = toAskSnapshot(
      { ...SNAPSHOT, budget: null, hasBudget: false, remainingSen: 0 },
      new Date(2026, 7, 2),
      CATEGORIES,
    );
    expect(mapped.budgetSen).toBeNull();
    expect(mapped.hasBudget).toBe(false);
    expect(mapped.remainingBudgetSen).toBe(0);
  });

  it('renders a dangling category id as "Uncategorized" rather than breaking the payload', () => {
    const mapped = toAskSnapshot(
      { ...SNAPSHOT, categorySummary: [{ categoryId: 999, totalSen: 5_000 }] },
      new Date(2026, 7, 2),
      CATEGORIES,
    );
    expect(mapped.topCategories).toEqual([{ name: 'Uncategorized', amountSen: 5_000 }]);
  });

  it('derives daysRemaining from the reference date (last day → 1) and 0 when stale', () => {
    expect(toAskSnapshot(SNAPSHOT, new Date(2026, 7, 31), CATEGORIES).daysRemaining).toBe(1);
    expect(toAskSnapshot(SNAPSHOT, new Date(2026, 8, 1), CATEGORIES).daysRemaining).toBe(0);
  });
});
