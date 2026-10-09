/**
 * Plan 004 — Expenses feed screen test (Audit Ledger)
 *
 * Verifies:
 * - Preserved root testID="expenses-screen"
 * - Period summary strip with testID="period-summary-strip" & testID="expenses-totals-bar"
 * - Total amount with testID="expenses-total"
 * - Transaction count badge with testID="expenses-total-count"
 * - Grouped list with testID="expenses-list" & testID="expense-list"
 * - Individual row with testID="expense-row-{id}"
 * - Search bar with testID="expense-search-input"
 * - Filter bar with testID="expense-filter-bar"
 * - FAB with testID="add-expense-fab"
 * - Linked commitment status pill
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ExpensesScreen from '@/app/(tabs)/expenses';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { accounts, categories, commitments, commitmentPayments, expenses, users } from '@/db/schema';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { useUiStore } from '@/store/uiStore';

const mockReposRef: {
  current: {
    expenses: object;
    accounts: object;
    categories: object;
  } | null;
} = { current: null };

const mockAuthRef: { current: CurrentUserSource } = { current: { currentUser: async () => null } };

jest.mock('@/db', () => ({
  repositories: () => mockReposRef.current,
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ authService: mockAuthRef.current }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 10, bottom: 20, left: 0, right: 0 }),
}));

let testDb: TestDb;

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<ExpensesScreen />);
  });
  await act(async () => {}); // load
  await act(async () => {}); // promises
  await act(async () => {}); // virtualized list
  return tree;
}

describe('ExpensesScreen (Plan 004 — Audit Ledger)', () => {
  beforeEach(async () => {
    testDb = createMigratedTestDb();
    const db = testDb.db;

    const drizzleExpenses = new DrizzleExpenseRepository(db as never);
    const drizzleAccounts = new DrizzleAccountRepository(db as never);
    const drizzleCategories = new DrizzleCategoryRepository(db as never);

    mockReposRef.current = {
      expenses: drizzleExpenses,
      accounts: drizzleAccounts,
      categories: drizzleCategories,
    };

    // Reset UI Store filters
    act(() => {
      useUiStore.setState({
        expenseFilter: {
          search: '',
          categoryId: null,
          period: 'all',
          customFrom: '',
          customTo: '',
          offset: 0,
        },
      });
    });

    // Seed test user
    db.insert(users)
      .values({ id: 1, email: 'test@example.com', passwordHash: 'hash' })
      .run();

    mockAuthRef.current = {
      currentUser: async () => ({ id: 1, email: 'test@example.com', passwordHash: 'hash', createdAt: Date.now() }),
    };

    // Seed test categories
    db.insert(categories)
      .values([
        { id: 1, name: 'Food & Dining', icon: 'fast-food-outline', type: 'expense' },
        { id: 2, name: 'Transport', icon: 'car-outline', type: 'expense' },
      ])
      .run();

    // Seed test account
    db.insert(accounts)
      .values({
        id: 1,
        userId: 1,
        name: 'Maybank',
        type: 'bank',
        balanceSen: 500000,
      })
      .run();
    // Seed commitment and payment for linked expense FK constraint
    db.insert(commitments)
      .values({
        id: 1,
        userId: 1,
        name: 'Netflix Subscription',
        type: 'subscription',
        remainingSen: 4500,
        paymentSen: 4500,
        frequency: 'monthly',
        startDate: '2026-01-01',
        dueDate: '2026-10-06',
        status: 'active',
      })
      .run();

    db.insert(commitmentPayments)
      .values({
        id: 99,
        userId: 1,
        commitmentId: 1,
        amountSen: 4500,
        dueDate: '2026-10-06',
        paidDate: '2026-10-06',
      })
      .run();
  });

  it('renders preserved test contracts when expenses exist', async () => {
    const db = testDb.db;

    // Seed normal expense and linked commitment expense
    db.insert(expenses)
      .values([
        {
          id: 10,
          userId: 1,
          categoryId: 2,
          accountId: 1,
          amountSen: 2450,
          date: '2026-10-06',
          description: 'Grab Car',
          commitmentPaymentId: null,
        },
        {
          id: 11,
          userId: 1,
          categoryId: 1,
          accountId: 1,
          amountSen: 4500,
          date: '2026-10-06',
          description: 'Netflix',
          commitmentPaymentId: 99,
        },
      ])
      .run();

    const tree = await renderScreen();

    // 1. Root container
    expect(tree.root.findAllByProps({ testID: 'expenses-screen' }).length).toBeGreaterThan(0);

    // 2. Search input & filter bar
    expect(tree.root.findAllByProps({ testID: 'expense-filter-bar' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expense-search-input' }).length).toBeGreaterThan(0);

    // 3. Period summary strip
    expect(tree.root.findAllByProps({ testID: 'period-summary-strip' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expenses-totals-bar' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expenses-total' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expenses-total-count' }).length).toBeGreaterThan(0);

    // 4. Expenses list container & feed
    expect(tree.root.findAllByProps({ testID: 'expenses-list' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expense-list' }).length).toBeGreaterThan(0);

    // 5. Individual rows
    expect(tree.root.findAllByProps({ testID: 'expense-row-10' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'expense-row-11' }).length).toBeGreaterThan(0);

    // 6. Linked commitment status pill on id 11
    const linkedPill = tree.root.findAllByProps({ label: 'Linked Commitment' });
    expect(linkedPill.length).toBeGreaterThan(0);

    // 7. Add expense FAB
    expect(tree.root.findAllByProps({ testID: 'add-expense-fab' }).length).toBeGreaterThan(0);
  });

  it('renders empty state when there are no expenses', async () => {
    const tree = await renderScreen();

    expect(tree.root.findAllByProps({ testID: 'expenses-empty' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'add-expense-fab' }).length).toBeGreaterThan(0);
  });
});
