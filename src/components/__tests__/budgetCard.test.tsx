import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BudgetCard } from '../BudgetCard';
import type { Budget } from '@/db/schema';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const mockBudget: Budget = {
  id: 1,
  userId: 1,
  categoryId: null,
  month: 10,
  year: 2026,
  amountSen: 300000, // RM 3,000.00
  createdAt: 1727740800000,
  updatedAt: 1727740800000,
};

describe('Plan 005 — BudgetCard (Overall Monthly Budget Bento Card)', () => {
  it('renders empty state with testID="budget-overall-card" and "budget-overall-empty" when unset', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetCard
        spentSen={0}
        budget={null}
        onPress={onPress}
        onClear={onClear}
      />
    );

    expect(tree.root.findByProps({ testID: 'budget-overall-card' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-overall-empty' })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'budget-overall-progress' })).toHaveLength(0);
  });

  it('renders overall card with spent, cap, progress meter, and clear button when budget is set', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetCard
        spentSen={142000} // RM 1,420.00 (47.3%)
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
        year={2026}
        month={10}
      />
    );

    expect(tree.root.findByProps({ testID: 'budget-overall-card' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-overall-progress' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-overall-clear' })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'budget-overall-over' })).toHaveLength(0);
  });

  it('renders over-budget badge with excess amount when spent >= budget', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetCard
        spentSen={350000} // RM 3,500.00 (> RM 3,000.00)
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
        year={2026}
        month={10}
      />
    );

    const overBadge = tree.root.findByProps({ testID: 'budget-overall-over' });
    expect(overBadge).toBeTruthy();
    expect(overBadge.props.label).toContain('Over');
    expect(overBadge.props.label).toContain('500.00');
  });

  it('triggers onPress and onClear handlers', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetCard
        spentSen={100000}
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
      />
    );

    const card = tree.root.findByProps({ testID: 'budget-overall-card' });
    await act(async () => {
      card.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    const clearBtn = tree.root.findByProps({ testID: 'budget-overall-clear' });
    await act(async () => {
      clearBtn.props.onPress({ stopPropagation: jest.fn() });
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
