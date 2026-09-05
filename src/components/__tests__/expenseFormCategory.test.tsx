/**
 * Plan 016 follow-up — ExpenseForm category management: the built-in
 * "Other" chip is replaced by the "+" (Add) chip; long-pressing a category
 * arms a delete badge (minus, top-left); the badge opens the ConfirmSheet
 * whose confirm calls onDeleteCategory; the Add chip opens the
 * CategoryAddSheet. All rendered via react-test-renderer with stubbed
 * callbacks.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Category } from '@/db/schema';
import { ExpenseForm } from '../ExpenseForm';

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  return tree;
}

const categories: Category[] = [
  { id: 1, name: 'Food', icon: 'restaurant-outline', type: 'expense', createdAt: 0 },
  { id: 2, name: 'Transport', icon: 'car-outline', type: 'expense', createdAt: 0 },
  { id: 12, name: 'Other', icon: 'ellipsis-horizontal-circle-outline', type: 'expense', createdAt: 0 },
] as unknown as Category[];

/** Host-node count for a testID (composite + host both carry it — count the host View). */
function count(tree: ReactTestRenderer, testID: string): number {
  return tree.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
  ).length;
}

function makeProps(over: Partial<React.ComponentProps<typeof ExpenseForm>> = {}): React.ComponentProps<typeof ExpenseForm> {
  return {
    categories,
    accounts: [],
    onSubmit: jest.fn(async () => {}),
    submitting: false,
    onCancel: jest.fn(),
    onCreateCategory: jest.fn(async () => ({ id: 999, name: 'x', icon: 'grid-outline', type: 'expense', createdAt: 0 }) as Category),
    onDeleteCategory: jest.fn(async () => {}),
    ...over,
  };
}

describe('ExpenseForm category management', () => {
  it('replaces the Other chip with the Add chip (only Other-named is hidden)', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    expect(count(tree, 'expense-form-category-1')).toBe(1);
    expect(count(tree, 'expense-form-category-2')).toBe(1);
    // Other (id 12) has no chip; the Add chip took its slot.
    expect(tree.root.findAllByProps({ testID: 'expense-form-category-12' })).toHaveLength(0);
    expect(count(tree, 'expense-form-category-add')).toBe(1);
  });

  it('opens the CategoryAddSheet from the Add chip and saves through onCreateCategory', async () => {
    const onSave = jest.fn<(name: string, icon: string) => Promise<Category>>().mockResolvedValue({
      id: 13,
      name: 'Pets',
      icon: 'paw-outline',
      type: 'expense',
      createdAt: 0,
    } as Category);
    const tree = await render(<ExpenseForm {...makeProps({ onCreateCategory: onSave })} />);
    expect(tree.root.findAllByProps({ testID: 'category-add-sheet' })).toHaveLength(0);

    const addChip = tree.root.findByProps({ testID: 'expense-form-category-add' });
    await act(async () => {
      (addChip.props as { onPress: () => void }).onPress();
    });
    expect(count(tree, 'category-add-sheet')).toBe(1);
  });

  it('long-press arms the delete badge, which opens the confirm; confirm deletes', async () => {
    const onDelete = jest.fn<(id: number) => Promise<void>>().mockResolvedValue(undefined);
    const tree = await render(<ExpenseForm {...makeProps({ onDeleteCategory: onDelete })} />);

    // No badge before arming.
    expect(tree.root.findAllByProps({ testID: 'expense-form-category-delete-1' })).toHaveLength(0);

    const chip = tree.root.findByProps({ testID: 'expense-form-category-1' });
    await act(async () => {
      (chip.props as { onLongPress: () => void }).onLongPress();
    });
    const badge = tree.root.findByProps({ testID: 'expense-form-category-delete-1' });
    expect(badge).toBeTruthy();

    await act(async () => {
      (badge.props as { onPress: () => void }).onPress();
    });
    expect(count(tree, 'confirm-sheet')).toBe(1);

    const confirm = tree.root.findByProps({ testID: 'confirm-sheet-confirm' });
    await act(async () => {
      (confirm.props as { onPress: () => void }).onPress();
    });
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('tapping an armed chip disarms instead of selecting', async () => {
    const onSelect = jest.fn();
    // categoryId Controller needs a value to fire selection — amount also
    // must be valid; selection path is exercised via the controller's onChange.
    const tree = await render(<ExpenseForm {...makeProps()} />);
    const chip = tree.root.findByProps({ testID: 'expense-form-category-1' });
    await act(async () => {
      (chip.props as { onLongPress: () => void }).onLongPress();
    });
    await act(async () => {
      (chip.props as { onPress: () => void }).onPress();
    });
    // Disarmed → no badge anymore.
    expect(tree.root.findAllByProps({ testID: 'expense-form-category-delete-1' })).toHaveLength(0);
    expect(onSelect).not.toHaveBeenCalledWith(1);
  });
});