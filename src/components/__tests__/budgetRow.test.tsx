import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BudgetRow } from '../BudgetRow';
import type { Budget, Category } from '@/db/schema';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const mockCategory: Category = {
  id: 2,
  name: 'Food & Dining',
  icon: 'fast-food',
  type: 'expense',
  createdAt: 1727740800000,
};

const mockBudget: Budget = {
  id: 10,
  userId: 1,
  categoryId: 2,
  month: 10,
  year: 2026,
  amountSen: 60000, // RM 600.00
  createdAt: 1727740800000,
  updatedAt: 1727740800000,
};

describe('Plan 005 — BudgetRow (Category Allocation Tile)', () => {
  it('renders dual testIDs: category-card-{id} and budget-row-{id}', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetRow
        category={mockCategory}
        spentSen={45000}
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
      />
    );

    expect(tree.root.findByProps({ testID: 'category-card-2' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-row-2' })).toBeTruthy();
  });

  it('renders spend, amount cap, progress meter, and clear button when budget is set', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetRow
        category={mockCategory}
        spentSen={45000}
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
      />
    );

    const spent = tree.root.findByProps({ testID: 'budget-row-2-spent' });
    expect(spent).toBeTruthy();

    const amount = tree.root.findByProps({ testID: 'budget-row-2-amount' });
    expect(amount).toBeTruthy();

    const progress = tree.root.findByProps({ testID: 'budget-row-2-progress' });
    expect(progress).toBeTruthy();

    const clear = tree.root.findByProps({ testID: 'budget-row-2-clear' });
    expect(clear).toBeTruthy();
  });

  it('renders "No limit set" and omits progress meter when unset', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetRow
        category={mockCategory}
        spentSen={0}
        budget={null}
        onPress={onPress}
        onClear={onClear}
      />
    );

    expect(tree.root.findByProps({ testID: 'category-card-2' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-row-2' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-row-2-amount' })).toBeTruthy();
    expect(tree.root.findAllByProps({ testID: 'budget-row-2-progress' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'budget-row-2-clear' })).toHaveLength(0);
  });

  it('renders crimson alert pill with excess when over budget', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetRow
        category={mockCategory}
        spentSen={75000} // RM 750.00 (> RM 600.00)
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
      />
    );

    const over = tree.root.findByProps({ testID: 'budget-row-2-over' });
    expect(over).toBeTruthy();
    expect(over.props.label).toContain('Over');
    expect(over.props.label).toContain('150.00');
  });

  it('triggers onPress on card tap and onClear on clear tap', async () => {
    const onPress = jest.fn();
    const onClear = jest.fn();
    const tree = await render(
      <BudgetRow
        category={mockCategory}
        spentSen={45000}
        budget={mockBudget}
        onPress={onPress}
        onClear={onClear}
      />
    );

    const row = tree.root.findByProps({ testID: 'budget-row-2' });
    await act(async () => {
      row.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);

    const clear = tree.root.findByProps({ testID: 'budget-row-2-clear' });
    await act(async () => {
      clear.props.onPress({ stopPropagation: jest.fn() });
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
