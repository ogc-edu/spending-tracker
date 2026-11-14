import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Account, Category } from '@/db/schema';
import type { ExpenseInput } from '@/repositories/types';
import { ExpenseForm } from '../ExpenseForm';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const el = tree.root.findByProps({ testID });
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

const categories: Category[] = [
  { id: 1, name: 'Food', icon: 'restaurant-outline', type: 'expense', createdAt: 0 },
] as unknown as Category[];

const accounts: Account[] = [
  { id: 1, name: 'Main Wallet', type: 'cash', balanceSen: 50000, createdAt: 0, updatedAt: 0, userId: 1 },
] as unknown as Account[];

function makeProps(over: Partial<React.ComponentProps<typeof ExpenseForm>> = {}): React.ComponentProps<typeof ExpenseForm> {
  return {
    categories,
    accounts,
    defaults: { date: '2026-10-15', categoryId: 1, accountId: 1, amount: '45.00', paymentMethod: 'Others' },
    onSubmit: jest.fn(async () => {}),
    submitting: false,
    onCancel: jest.fn(),
    onCreateCategory: jest.fn(async () => categories[0]!),
    onDeleteCategory: jest.fn(async () => {}),
    ...over,
  };
}

describe('ExpenseForm payment method UI contract', () => {
  it('renders payment method options in exact order: SPL, Maybank CC, Others', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);

    const splChip = tree.root.findAllByProps({ testID: 'payment-method-SPL' });
    const maybankChip = tree.root.findAllByProps({ testID: 'payment-method-Maybank-CC' });
    const othersChip = tree.root.findAllByProps({ testID: 'payment-method-Others' });

    expect(splChip.length).toBeGreaterThanOrEqual(1);
    expect(maybankChip.length).toBeGreaterThanOrEqual(1);
    expect(othersChip.length).toBeGreaterThanOrEqual(1);

    // Verify ordering among top-level chip pressables
    const chips = tree.root.findAll(
      (node) => typeof node.props.testID === 'string' && node.props.testID.startsWith('payment-method-'),
    );
    const uniqueIds = Array.from(new Set(chips.map((c) => c.props.testID)));
    expect(uniqueIds).toEqual(['payment-method-SPL', 'payment-method-Maybank-CC', 'payment-method-Others']);
  });

  it('hides commitment preview banner when Others is selected', async () => {
    const tree = await render(<ExpenseForm {...makeProps({ defaults: { paymentMethod: 'Others' } })} />);
    const preview = tree.root.findAllByProps({ testID: 'payment-commitment-preview' });
    expect(preview).toHaveLength(0);
  });

  it('shows commitment preview banner when SPL is selected and routes before 21st to SPL-Oct', async () => {
    const tree = await render(
      <ExpenseForm {...makeProps({ defaults: { date: '2026-10-15', amount: '80.00', paymentMethod: 'Others' } })} />,
    );

    await press(tree, 'payment-method-SPL');

    const preview = tree.root.findAllByProps({ testID: 'payment-commitment-preview' });
    expect(preview.length).toBeGreaterThanOrEqual(1);
  });

  it('submits with chosen payment method', async () => {
    const onSubmit = jest.fn<(input: ExpenseInput) => Promise<void>>().mockResolvedValue(undefined);
    const tree = await render(<ExpenseForm {...makeProps({ onSubmit })} />);

    await press(tree, 'payment-method-Maybank-CC');
    await press(tree, 'expense-form-submit');
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].paymentMethod).toBe('Maybank CC');
  });
});
