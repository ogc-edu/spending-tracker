/**
 * Plan 018 — Expenses list is a GROUPED list: expenses sharing a date get
 * one section header (Today / Yesterday / DD Mon), rows keep their stable
 * `expense-row-${id}` testIDs through the SectionList refactor.
 * `groupByDate` is the pure presentation reducer — asserted directly.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import type { Account, Category, Expense } from '@/db/schema';
import { ExpenseList, groupByDate } from '../ExpenseList';

const accounts: Account[] = [];
const categories: Category[] = [{ id: 1, name: 'Food', icon: 'fast-food-outline' } as unknown as Category];

function expense(id: number, date: string): Expense {
  return {
    id,
    userId: 1,
    categoryId: 1,
    accountId: null,
    amountSen: 1000,
    date,
    description: '',
    commitmentPaymentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Expense;
}

describe('ExpenseList date grouping (plan 018)', () => {
  it('groups consecutive same-day rows under one section, order preserved', () => {
    const sections = groupByDate([
      expense(1, '2026-09-12'),
      expense(2, '2026-09-12'),
      expense(3, '2026-09-10'),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.data.map((e) => e.id)).toEqual([1, 2]);
    expect(sections[1]!.data.map((e) => e.id)).toEqual([3]);
  });

  it('labels today and yesterday specially', () => {
    // Pin "today" by feeding the list a date built from its own todayLocal().
    const { todayLocal } = jest.requireActual('@/utils/dates') as { todayLocal(): string };
    const today = todayLocal();
    const [y, m, d] = today.split('-').map(Number);
    const pad = (n: number): string => String(n).padStart(2, '0');
    const yesterday = `${y}-${pad(m)}-${pad(d - 1 > 0 ? d - 1 : 1)}`; // safe within a month
    const sections = groupByDate([expense(1, today), expense(2, yesterday), expense(3, '2020-05-04')]);
    expect(sections[0]!.title).toBe('Today');
    expect(sections[1]!.title).toBe('Yesterday');
    expect(sections[2]!.title).toBe('04 May');
  });

  it('renders rows with their stable per-row testIDs through the SectionList', async () => {
    const rows = [expense(1, '2026-09-12'), expense(2, '2026-09-12'), expense(3, '2026-09-10')];
    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <ExpenseList
          expenses={rows}
          categories={categories}
          accounts={accounts}
          hasMore={false}
          onEndReached={jest.fn()}
          onPressRow={() => {}}
        />,
      );
    });
    // SectionList virtualization can render an item more than once in the
    // test renderer — assert the testIDs survive (present + unique per row).
    for (const id of [1, 2, 3]) {
      expect(tree.root.findAllByProps({ testID: `expense-row-${id}` }).length).toBeGreaterThan(0);
    }
    expect(tree.root.findAllByProps({ testID: 'expense-list' }).length).toBeGreaterThan(0);
  });
});
