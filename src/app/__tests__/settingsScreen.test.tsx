/**
 * Plan 016 — Settings screen: SET-1 safety-buffer editor + SET-2 AI status
 * line, against the real screen with the analytics-screen harness seams:
 *  - @/db repositories() → real Drizzle repos over a better-sqlite3 test DB;
 *  - expo-router useFocusEffect → plain effect, useRouter → stubs;
 *  - @/auth/AuthProvider useAuth → fake signed-in user + CurrentUserSource;
 *  - @/services/AiConfigService → controllable key map, so "configured vs
 *    not configured" is deterministic.
 *
 * Covers (plan §Tests): buffer save/load round-trip incl. 0 allowed and
 * negative rejected; AI status reflects key presence. Plus the payroll-in
 * section: setting the split, the total, and the deposit that credits every
 * allocated account.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import SettingsScreen from '@/app/(tabs)/settings';
import { ToastProvider } from '@/components/ToastProvider';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { users } from '@/db/schema';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzlePayrollRepository } from '@/repositories/drizzle/payrollRepository';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import type { CurrentUserSource } from '@/services/AccountService';
import type { AIProviderName } from '@/ai/types';
import type { ConfigurableAIProvider } from '@/services/AiConfigService';

const mockReposRef: {
  current:
    | {
        accounts: object;
        categories: object;
        settings: object;
        expenses: object;
        budgets: object;
        commitments: object;
        payroll: object;
      }
    | null;
} = { current: null };
const mockAuthRef: { current: CurrentUserSource } = { current: { currentUser: async () => null } };
const mockKeys: Partial<Record<ConfigurableAIProvider, string | null>> = {};

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
  useAuth: () => ({
    user: { id: 1, email: 'seed@example.com' },
    logout: jest.fn(),
    authService: mockAuthRef.current,
  }),
}));

jest.mock('@/services/AiConfigService', () => ({
  AiConfigService: class AiConfigService {
    async getKey(provider: AIProviderName): Promise<string | null> {
      return mockKeys[provider as ConfigurableAIProvider] ?? null;
    }
    async getActiveProvider(): Promise<AIProviderName | null> {
      return null;
    }
  },
}));

// The app root provides a real SafeAreaProvider; the native provider
// renders nothing under the test renderer, so stub it here.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

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

async function renderScreen(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ToastProvider>
        <SettingsScreen />
      </ToastProvider>,
    );
  });
  return tree;
}

async function setup(): Promise<TestDb> {
  const test = createMigratedTestDb();
  const [user] = await test.db.insert(users).values({ email: 'seed@example.com', passwordHash: 'test' }).returning();
  mockAuthRef.current = { currentUser: async () => user ?? null };
  mockReposRef.current = {
    accounts: new DrizzleAccountRepository(test.db as unknown as never),
    categories: new DrizzleCategoryRepository(test.db as unknown as never),
    settings: new DrizzleSettingsRepository(test.db as unknown as never),
    expenses: new DrizzleExpenseRepository(test.db as unknown as never),
    budgets: new DrizzleBudgetRepository(test.db as unknown as never),
    commitments: new DrizzleCommitmentRepository(test.db as unknown as never),
    payroll: new DrizzlePayrollRepository(test.db as unknown as never),
  };
  return test;
}

describe('Settings screen (plan 016 — SET-1 buffer editor, SET-2 AI status)', () => {
  beforeEach(async () => {
    mockKeys.gemini = null;
    mockKeys.deepseek = null;
    await setup();
  });

  it('shows the default RM300 buffer and the AI status lines from key presence', async () => {
    const tree = await renderScreen();
    expect(textOf(tree.root, 'settings-buffer-current')).toBe('RM300.00');
    expect(textOf(tree.root, 'settings-ai-status-gemini')).toBe('Gemini · key not configured');
    expect(textOf(tree.root, 'settings-ai-status-deepseek')).toBe('DeepSeek · key not configured');
  });

  it('flips the Gemini status line when a key is present', async () => {
    mockKeys.gemini = 'AIzaSy-test';
    const tree = await renderScreen();
    expect(textOf(tree.root, 'settings-ai-status-gemini')).toBe('Gemini · key configured');
    expect(textOf(tree.root, 'settings-ai-status-deepseek')).toBe('DeepSeek · key not configured');
  });

  it('round-trips the buffer: save 0 (allowed) and reload shows RM0.00', async () => {
    const tree = await renderScreen();
    const input = tree.root.findByProps({ testID: 'settings-buffer-input' });
    await act(async () => {
      input.props.onChangeText('0');
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'settings-buffer-save' }).props.onPress();
    });
    expect(textOf(tree.root, 'settings-buffer-current')).toBe('RM0.00');
  });

  it('rejects a negative buffer with an inline error and keeps the current value', async () => {
    const tree = await renderScreen();
    const input = tree.root.findByProps({ testID: 'settings-buffer-input' });
    await act(async () => {
      input.props.onChangeText('-5');
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'settings-buffer-save' }).props.onPress();
    });
    expect(textOf(tree.root, 'settings-buffer-error')).toBe('Enter a valid amount (up to 2 decimal places)');
    expect(textOf(tree.root, 'settings-buffer-current')).toBe('RM300.00');
  });
});
/* ------------------------------------------------------------------ *
 * Payroll in — the standing split and the deposit it applies.
 * ------------------------------------------------------------------ */

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const node = tree.root.findByProps({ testID });
  await act(async () => {
    (node.props as { onPress(): void }).onPress();
  });
  await act(async () => {}); // flush the service call + reload
}

/** Enter an amount in the allocation sheet's POS money field. */
async function typeAllocation(tree: ReactTestRenderer, digits: string): Promise<void> {
  const matches = tree.root.findAll((n) => n.props?.testID === 'payroll-allocation-amount');
  const input = matches[matches.length - 1];
  await act(async () => {
    (input.props as { onChangeText(text: string): void }).onChangeText(digits);
  });
}

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  tree.root.findAllByProps({ testID }).length > 0;

describe('Settings screen — payroll in', () => {
  let db: TestDb;

  beforeEach(async () => {
    mockKeys.gemini = null;
    mockKeys.deepseek = null;
    db = await setup();
    const accounts = new DrizzleAccountRepository(db.db as unknown as never);
    await accounts.create({ userId: 1, name: 'Savings', type: 'bank', initialBalanceSen: 20_000 });
    await accounts.create({ userId: 1, name: 'Spending', type: 'cash', initialBalanceSen: 5_000 });
    await accounts.create({ userId: 1, name: 'Citi', type: 'credit_card', initialBalanceSen: 50_000 });
  });

  it('starts empty, with the deposit button disabled', async () => {
    const tree = await renderScreen();
    expect(has(tree, 'payroll-empty')).toBe(true);
    expect(tree.root.findByProps({ testID: 'payroll-in-button' }).props.disabled).toBe(true);
  });

  it('adds a slice per account and totals the split', async () => {
    const tree = await renderScreen();

    await press(tree, 'payroll-add-allocation');
    // Credit cards are not offered as payroll targets.
    expect(has(tree, 'payroll-allocation-account-1')).toBe(true);
    expect(has(tree, 'payroll-allocation-account-3')).toBe(false);

    await press(tree, 'payroll-allocation-account-1');
    await typeAllocation(tree, '150000'); // RM1,500.00
    await press(tree, 'payroll-allocation-save');

    await press(tree, 'payroll-add-allocation');
    await press(tree, 'payroll-allocation-account-2');
    await typeAllocation(tree, '50000'); // RM500.00
    await press(tree, 'payroll-allocation-save');

    expect(textOf(tree.root, 'payroll-line-1')).toContain('Savings');
    expect(textOf(tree.root, 'payroll-line-1')).toContain('RM1,500.00');
    expect(textOf(tree.root, 'payroll-total')).toBe('RM2,000.00');
    expect(tree.root.findByProps({ testID: 'payroll-in-button' }).props.disabled).toBe(false);
  });

  it('deposits the split into the accounts on confirm', async () => {
    const tree = await renderScreen();
    await press(tree, 'payroll-add-allocation');
    await press(tree, 'payroll-allocation-account-1');
    await typeAllocation(tree, '150000');
    await press(tree, 'payroll-allocation-save');

    await press(tree, 'payroll-in-button'); // opens the confirm
    await press(tree, 'confirm-sheet-confirm');

    // The account row reflects the credited balance: 200.00 + 1,500.00.
    expect(textOf(tree.root, 'account-balance-1')).toBe('RM1,700.00');
    expect(has(tree, 'payroll-last-run')).toBe(true);
  });

  it('removes a slice', async () => {
    const tree = await renderScreen();
    await press(tree, 'payroll-add-allocation');
    await press(tree, 'payroll-allocation-account-1');
    await typeAllocation(tree, '150000');
    await press(tree, 'payroll-allocation-save');
    expect(has(tree, 'payroll-line-1')).toBe(true);

    await press(tree, 'payroll-line-remove-1');
    expect(has(tree, 'payroll-line-1')).toBe(false);
    expect(has(tree, 'payroll-empty')).toBe(true);
  });
});
