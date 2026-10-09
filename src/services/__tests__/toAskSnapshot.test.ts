/**
 * Plan 019 — CashFlowSnapshot → AskSnapshot mapping for the "Ask about your
 * money" box: pure field equality, next-month commitments, category-name
 * resolution (incl. a dangling id). Plan 020: no budget / buffer / safe /
 * allowance terms reach the payload.
 */
import { describe, expect, it } from '@jest/globals';
import { toAskSnapshot } from '../toAskSnapshot';
import type { CashFlowSnapshot } from '../CashFlowService';
import type { Category } from '@/db/schema';

const CATEGORIES: Category[] = [
  { id: 1, name: 'Food', icon: 'fast-food', type: 'expense', createdAt: 0 },
  { id: 2, name: 'Transport', icon: 'car', type: 'expense', createdAt: 0 },
];

const SNAPSHOT: CashFlowSnapshot = {
  month: { month: 8, year: 2026 },
  availableSen: 300_000,
  spentSen: 116_000,
  upcomingSen: 80_000,
  upcomingItems: [
    { commitmentId: 3, name: 'Rent', dueDate: '2026-08-25', amountSen: 80_000, frequency: 'monthly' },
  ],
  nextMonthSen: 120_000,
  nextMonthItems: [
    { commitmentId: 7, name: 'Car loan', dueDate: '2026-09-05', amountSen: 120_000, frequency: 'monthly' },
  ],
  categorySummary: [
    { categoryId: 1, totalSen: 100_000 },
    { categoryId: 2, totalSen: 16_000 },
  ],
  accountCount: 1,
};

describe('toAskSnapshot', () => {
  it('maps the month aggregates, due slots, next-month slots and category names (no recomputation)', () => {
    const mapped = toAskSnapshot(SNAPSHOT, CATEGORIES);

    expect(mapped).toEqual({
      month: '2026-08',
      monthLabel: 'August 2026',
      availableSen: 300_000,
      spentSen: 116_000,
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
    const mapped = toAskSnapshot(SNAPSHOT, CATEGORIES);
    expect(mapped.nextMonth[0]).not.toHaveProperty('commitmentId');
    expect(mapped.nextMonth[0]).not.toHaveProperty('frequency');
    expect(JSON.stringify(mapped).toLowerCase()).not.toContain('description');
  });

  it('renders a dangling category id as "Uncategorized" rather than breaking the payload', () => {
    const mapped = toAskSnapshot(
      { ...SNAPSHOT, categorySummary: [{ categoryId: 999, totalSen: 5_000 }] },
      CATEGORIES,
    );
    expect(mapped.topCategories).toEqual([{ name: 'Uncategorized', amountSen: 5_000 }]);
  });
});
