import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BudgetForm } from '../BudgetForm';
import { TextInput } from 'react-native';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

describe('Plan 005 — BudgetForm (Budget Limit Entry Sheet)', () => {
  it('renders with testID="budget-form", "category-limit-input", "budget-form-amount", "budget-form-submit", and "budget-form-cancel"', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(
      <BudgetForm
        title="Food & Dining budget"
        initialAmountSen={50000}
        submitLabel="Save budget"
        onSubmit={onSubmit}
        submitting={false}
        onCancel={onCancel}
      />
    );

    expect(tree.root.findByProps({ testID: 'budget-form' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'category-limit-input' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-form-amount' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-form-submit' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-form-cancel' })).toBeTruthy();
  });

  it('adjusts value via quick presets (+10%, +25%, Reset)', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(
      <BudgetForm
        title="Food & Dining budget"
        initialAmountSen={10000} // RM 100.00
        submitLabel="Save budget"
        onSubmit={onSubmit}
        submitting={false}
        onCancel={onCancel}
      />
    );

    const input = tree.root.findByType(TextInput);
    expect(input.props.value).toBe('100.00');

    // Click +10%
    const plus10 = tree.root.findByProps({ testID: 'budget-preset-10' });
    await act(async () => {
      plus10.props.onPress();
    });
    expect(input.props.value).toBe('110.00');

    // Click +25%
    const plus25 = tree.root.findByProps({ testID: 'budget-preset-25' });
    await act(async () => {
      plus25.props.onPress();
    });
    // 110.00 * 1.25 = 137.50
    expect(input.props.value).toBe('137.50');

    // Click Reset
    const reset = tree.root.findByProps({ testID: 'budget-preset-reset' });
    await act(async () => {
      reset.props.onPress();
    });
    expect(input.props.value).toBe('100.00');
  });

  it('calls onSubmit with integer sen when valid amount is submitted', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(
      <BudgetForm
        title="Monthly budget"
        initialAmountSen={25000}
        submitLabel="Save budget"
        onSubmit={onSubmit}
        submitting={false}
        onCancel={onCancel}
      />
    );

    const submitBtn = tree.root.findByProps({ testID: 'budget-form-submit' });
    await act(async () => {
      submitBtn.props.onPress();
    });

    expect(onSubmit).toHaveBeenCalledWith(25000);
  });

  it('calls onCancel when cancel button is pressed', async () => {
    const onSubmit = jest.fn();
    const onCancel = jest.fn();
    const tree = await render(
      <BudgetForm
        title="Monthly budget"
        submitLabel="Set budget"
        onSubmit={onSubmit}
        submitting={false}
        onCancel={onCancel}
      />
    );

    const cancelBtn = tree.root.findByProps({ testID: 'budget-form-cancel' });
    await act(async () => {
      cancelBtn.props.onPress();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
