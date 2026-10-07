import { describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ExpenseForm } from '@/components/ExpenseForm';
import EditExpenseScreen from '@/app/expenses/[id]/edit';
import type { Account, Category, Expense } from '@/db/schema';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: '123' }),
  useFocusEffect: (fn: () => void) => fn(),
}));

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ authService: { currentUser: async () => ({ id: 'user-1' }) } }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ToastProvider', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

const mockExpense: Expense = {
  id: 123,
  userId: 1,
  amountSen: 2500,
  categoryId: 1,
  accountId: 10,
  date: '2026-10-06',
  description: 'Netflix subscription',
  commitmentPaymentId: 456,
  createdAt: 1000,
  updatedAt: 1000,
};

const mockAccounts: Account[] = [
  { id: 10, userId: 1, name: 'Maybank', type: 'checking', balanceSen: 345000, createdAt: 1000, updatedAt: 1000 },
  { id: 20, userId: 1, name: 'Cash', type: 'cash', balanceSen: 5000, createdAt: 1000, updatedAt: 1000 },
];

const mockCategories: Category[] = [
  { id: 1, name: 'Food', icon: 'fast-food', type: 'expense', createdAt: 1000 },
  { id: 2, name: 'Transport', icon: 'car', type: 'expense', createdAt: 1000 },
];

jest.mock('@/db', () => ({
  repositories: () => ({
    expenses: {
      byId: jest.fn(async () => mockExpense),
      edit: jest.fn(async () => {}),
      delete: jest.fn(async () => {}),
    },
    accounts: {
      list: jest.fn(async () => mockAccounts),
    },
    categories: {
      list: jest.fn(async () => mockCategories),
    },
  }),
}));

describe('Plan 009: Fast Expense Entry & Edit Contracts', () => {
  it('ExpenseForm renders money-input, category-matrix, and account-pill contracts', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ExpenseForm
          categories={mockCategories}
          accounts={mockAccounts}
          onSubmit={jest.fn(async () => {})}
          submitting={false}
          onCancel={jest.fn()}
          onCreateCategory={jest.fn(async () => mockCategories[0])}
          onDeleteCategory={jest.fn(async () => {})}
        />
      );
    });

    // Check POS money input contract
    const moneyInput = tree.root.findAllByProps({ testID: 'money-input' });
    expect(moneyInput.length).toBeGreaterThanOrEqual(1);

    const expenseFormAmount = tree.root.findAllByProps({ testID: 'expense-form-amount' });
    expect(expenseFormAmount.length).toBeGreaterThanOrEqual(1);

    // Check category matrix contract
    const categoryMatrix = tree.root.findAllByProps({ testID: 'category-matrix' });
    expect(categoryMatrix.length).toBeGreaterThanOrEqual(1);

    // Check account-pill contracts
    const accountPill10 = tree.root.findAllByProps({ testID: 'account-pill-10' });
    expect(accountPill10.length).toBeGreaterThanOrEqual(1);

    const accountPill20 = tree.root.findAllByProps({ testID: 'account-pill-20' });
    expect(accountPill20.length).toBeGreaterThanOrEqual(1);
  });

  it('EditExpenseScreen renders linked-commitment-lock badge for commitment-generated expense', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<EditExpenseScreen />);
    });

    // Wait for async load effect
    await act(async () => {});

    const lockBadge = tree.root.findAllByProps({ testID: 'linked-commitment-lock' });
    expect(lockBadge.length).toBeGreaterThanOrEqual(1);

    const linkedView = tree.root.findAllByProps({ testID: 'linked-expense-view' });
    expect(linkedView.length).toBeGreaterThanOrEqual(1);

    const backButton = tree.root.findAllByProps({ testID: 'linked-expense-back' });
    expect(backButton.length).toBeGreaterThanOrEqual(1);
  });
});
