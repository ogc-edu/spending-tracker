import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import BudgetsScreen from '@/app/(tabs)/budgets';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { categories, users } from '@/db/schema';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import { useUiStore } from '@/store/uiStore';

const mockReposRef: {
  current: {
    budgets: object;
    expenses: object;
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

jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

let testDb: TestDb;

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<BudgetsScreen />);
    await new Promise((r) => setTimeout(r, 10));
  });
  return tree;
}

describe('Plan 005 — Budgets Screen Redesign (Allocations Grid)', () => {
  beforeEach(() => {
    testDb = createMigratedTestDb();
    const db = testDb.db;

    // Seed test user
    db.insert(users)
      .values({ id: 1, email: 'test@example.com', passwordHash: 'hash', createdAt: Date.now() })
      .run();

    // Seed test categories
    db.insert(categories)
      .values([
        { id: 1, name: 'Food & Dining', icon: 'fast-food', type: 'expense', createdAt: Date.now() },
        { id: 2, name: 'Transport', icon: 'car', type: 'expense', createdAt: Date.now() },
        { id: 3, name: 'Entertainment', icon: 'film', type: 'expense', createdAt: Date.now() },
      ])
      .run();

    mockReposRef.current = {
      budgets: new DrizzleBudgetRepository(db as never),
      expenses: new DrizzleExpenseRepository(db as never),
      categories: new DrizzleCategoryRepository(db as never),
    };

    mockAuthRef.current = {
      currentUser: async () => ({ id: 1, email: 'test@example.com', passwordHash: 'hash', createdAt: Date.now() }),
    };

    act(() => {
      useUiStore.getState().setSelectedMonth({ month: 10, year: 2026 });
    });
  });

  it('renders root screen container with testID="budgets-screen"', async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: 'budgets-screen' })).toBeTruthy();
  });

  it('renders month cycle stepper with prev, next, and formatted label', async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: 'budgets-month-bar' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budgets-month-prev' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budgets-month-next' })).toBeTruthy();

    const label = tree.root.findByProps({ testID: 'budgets-month-label' });
    expect(label.props.children).toContain('October 2026');

    // Step to previous month (September 2026)
    const prevBtn = tree.root.findByProps({ testID: 'budgets-month-prev' });
    await act(async () => {
      prevBtn.props.onPress();
    });
    expect(useUiStore.getState().selectedMonth).toEqual({ month: 9, year: 2026 });

    // Step to next month
    const nextBtn = tree.root.findByProps({ testID: 'budgets-month-next' });
    await act(async () => {
      nextBtn.props.onPress();
    });
    expect(useUiStore.getState().selectedMonth).toEqual({ month: 10, year: 2026 });
  });

  it('renders overall monthly budget card and empty state when unset', async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: 'budget-overall-card' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budgets-empty' })).toBeTruthy();
  });

  it('renders two-column category allocations grid covering seeded categories', async () => {
    const tree = await renderScreen();
    expect(tree.root.findByProps({ testID: 'category-allocations-grid' })).toBeTruthy();
    // Category 1 is seeded by migration (Food & Dining)
    expect(tree.root.findByProps({ testID: 'category-card-1' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-row-1' })).toBeTruthy();
    // Category 2 is seeded by migration (Transport)
    expect(tree.root.findByProps({ testID: 'category-card-2' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budget-row-2' })).toBeTruthy();
  });

  it('retains add category budget action and picker modal controls', async () => {
    const tree = await renderScreen();
    const addBtn = tree.root.findByProps({ testID: 'budgets-add-category' });
    expect(addBtn).toBeTruthy();

    // Open category picker
    await act(async () => {
      addBtn.props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'budgets-category-picker' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budgets-pick-category-1' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'budgets-category-picker-cancel' })).toBeTruthy();

    // Cancel category picker
    const cancelBtn = tree.root.findByProps({ testID: 'budgets-category-picker-cancel' });
    await act(async () => {
      cancelBtn.props.onPress();
    });
  });
});
