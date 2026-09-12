/**
 * ExpenseForm date field — picked, never typed. The row is a Pressable that
 * opens the shared CalendarSheet (the CommitmentForm pattern): it shows the
 * selected date as DD-MM-YYYY, a pick writes it back, Cancel/scrim leave it
 * untouched, and what reaches onSubmit is still the ISO `YYYY-MM-DD` the
 * service and DB expect.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
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

function textOf(root: ReactTestInstance, testID: string): string {
  const el = root.findByProps({ testID });
  const texts: string[] = [];
  const collect = (node: ReactTestInstance): void => {
    for (const child of node.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(el);
  return texts.join('');
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const el = tree.root.findByProps({ testID });
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

const categories = [
  { id: 1, name: 'Food', icon: 'restaurant-outline', type: 'expense', createdAt: 0 },
] as unknown as Category[];
const accounts = [
  { id: 1, name: 'Cash', type: 'cash', balanceSen: 100000, createdAt: 0, updatedAt: 0, userId: 1 },
] as unknown as Account[];

function makeProps(
  over: Partial<React.ComponentProps<typeof ExpenseForm>> = {},
): React.ComponentProps<typeof ExpenseForm> {
  return {
    categories,
    accounts,
    defaults: { date: '2026-09-12', categoryId: 1, accountId: 1, amount: '12.00' },
    onSubmit: jest.fn(async () => {}),
    submitting: false,
    onCancel: jest.fn(),
    onCreateCategory: jest.fn(async () => categories[0]),
    onDeleteCategory: jest.fn(async () => {}),
    ...over,
  };
}

const isOpen = (tree: ReactTestRenderer): boolean =>
  tree.root.findAllByProps({ testID: 'calendar-sheet' }).length > 0;

describe('ExpenseForm date field — picker, not a text input', () => {
  it('renders the default date as DD-MM-YYYY on a pressable row (no TextInput)', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    const field = tree.root.findByProps({ testID: 'expense-form-date' });
    expect(textOf(tree.root, 'expense-form-date')).toContain('12-09-2026');
    expect(field.props.accessibilityRole).toBe('button');
    expect(field.props.onChangeText).toBeUndefined(); // not editable text
    expect(field.props.accessibilityLabel).toBe('Date, 12-09-2026, picked');
  });

  it('tapping the field opens the calendar; it is closed until then', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    expect(isOpen(tree)).toBe(false);
    await press(tree, 'expense-form-date');
    expect(isOpen(tree)).toBe(true);
    expect(textOf(tree.root, 'calendar-sheet-title')).toBe('Select date');
    // Opens anchored on the selected date's month, with month AND year navigation.
    expect(textOf(tree.root, 'calendar-month-label')).toBe('September 2026');
    for (const nav of ['calendar-prev-month', 'calendar-next-month', 'calendar-prev-year', 'calendar-next-year']) {
      expect(tree.root.findAllByProps({ testID: nav }).length).toBeGreaterThan(0);
    }
  });

  it('picking a day closes the sheet and shows the new date', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    await press(tree, 'expense-form-date');
    await press(tree, 'calendar-next-month');
    expect(textOf(tree.root, 'calendar-month-label')).toBe('October 2026');
    await press(tree, 'calendar-day-2026-10-05');
    expect(isOpen(tree)).toBe(false);
    expect(textOf(tree.root, 'expense-form-date')).toContain('05-10-2026');
  });

  it('a year jump reaches the same day a year out', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    await press(tree, 'expense-form-date');
    await press(tree, 'calendar-prev-year');
    expect(textOf(tree.root, 'calendar-month-label')).toBe('September 2025');
    await press(tree, 'calendar-day-2025-09-12');
    expect(textOf(tree.root, 'expense-form-date')).toContain('12-09-2025');
  });

  it('Cancel dismisses without changing the date', async () => {
    const tree = await render(<ExpenseForm {...makeProps()} />);
    await press(tree, 'expense-form-date');
    await press(tree, 'calendar-cancel');
    expect(isOpen(tree)).toBe(false);
    expect(textOf(tree.root, 'expense-form-date')).toContain('12-09-2026');

    // …and so does the close button (the scrim tap shares its handler).
    await press(tree, 'expense-form-date');
    await press(tree, 'calendar-sheet-close');
    expect(isOpen(tree)).toBe(false);
    expect(textOf(tree.root, 'expense-form-date')).toContain('12-09-2026');
  });

  it('submits the picked date as ISO YYYY-MM-DD (storage contract unchanged)', async () => {
    const onSubmit = jest.fn<(input: ExpenseInput) => Promise<void>>().mockResolvedValue(undefined);
    const tree = await render(<ExpenseForm {...makeProps({ onSubmit })} />);
    await press(tree, 'expense-form-date');
    await press(tree, 'calendar-day-2026-09-30');
    await press(tree, 'expense-form-submit');
    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      amountSen: 1200,
      categoryId: 1,
      accountId: 1,
      date: '2026-09-30',
      description: '',
    });
  });

  it('while submitting the field is disabled (no picker mid-save)', async () => {
    const tree = await render(<ExpenseForm {...makeProps({ submitting: true })} />);
    expect(tree.root.findByProps({ testID: 'expense-form-date' }).props.disabled).toBe(true);
  });
});
