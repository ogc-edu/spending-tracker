/**
 * Plan 016 — Settings screen: SET-2 AI status line, against the real screen
 * with the analytics-screen harness seams:
 *  - @/db repositories() → real Drizzle repos over a better-sqlite3 test DB;
 *  - expo-router useFocusEffect → plain effect, useRouter → stubs;
 *  - @/auth/AuthProvider useAuth → fake signed-in user + CurrentUserSource;
 *  - @/services/AiConfigService → controllable key map, so "configured vs
 *    not configured" is deterministic.
 *
 * Covers: AI status reflects key presence. Plan 020: the safety-buffer
 * editor and the payroll section are gone (payroll is hidden, not deleted —
 * PayrollService keeps its own tests), while accounts, categories, AI and
 * logout still render.
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
        commitments: object;
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
    commitments: new DrizzleCommitmentRepository(test.db as unknown as never),
  };
  return test;
}

const has = (tree: ReactTestRenderer, testID: string): boolean =>
  tree.root.findAllByProps({ testID }).length > 0;

describe('Settings screen (plan 016 — SET-2 AI status)', () => {
  beforeEach(async () => {
    mockKeys.gemini = null;
    mockKeys.deepseek = null;
    await setup();
  });

  it('shows the AI status lines from key presence', async () => {
    const tree = await renderScreen();
    expect(textOf(tree.root, 'settings-ai-status-gemini')).toBe('Gemini · key not configured');
    expect(textOf(tree.root, 'settings-ai-status-deepseek')).toBe('DeepSeek · key not configured');
  });

  it('flips the Gemini status line when a key is present', async () => {
    mockKeys.gemini = 'AIzaSy-test';
    const tree = await renderScreen();
    expect(textOf(tree.root, 'settings-ai-status-gemini')).toBe('Gemini · key configured');
    expect(textOf(tree.root, 'settings-ai-status-deepseek')).toBe('DeepSeek · key not configured');
  });
});

describe('Settings screen — plan 020 scope', () => {
  beforeEach(async () => {
    mockKeys.gemini = null;
    mockKeys.deepseek = null;
    const test = await setup();
    const accounts = new DrizzleAccountRepository(test.db as unknown as never);
    await accounts.create({ userId: 1, name: 'Savings', type: 'bank', initialBalanceSen: 20_000 });
  });

  it('no longer renders the safety-buffer editor', async () => {
    const tree = await renderScreen();
    for (const id of [
      'settings-buffer-current',
      'settings-buffer-input',
      'settings-buffer-save',
      'settings-buffer-error',
    ]) {
      expect(has(tree, id)).toBe(false);
    }
  });

  it('no longer renders the payroll section', async () => {
    const tree = await renderScreen();
    for (const id of [
      'trigger-payroll-btn',
      'payroll-in-button',
      'payroll-add-allocation',
      'payroll-empty',
      'payroll-total',
      'payroll-last-run',
    ]) {
      expect(has(tree, id)).toBe(false);
    }
    expect(tree.root.findAll((n) => typeof n.props?.testID === 'string' && n.props.testID.startsWith('payroll-'))).toHaveLength(0);
  });

  it('still renders accounts, categories, AI config and logout', async () => {
    const tree = await renderScreen();
    expect(has(tree, 'accounts-stack')).toBe(true);
    expect(has(tree, 'settings-accounts-list')).toBe(true);
    expect(has(tree, 'account-row-1')).toBe(true);
    expect(has(tree, 'settings-categories-add')).toBe(true);
    expect(has(tree, 'ai-config-section')).toBe(true);
    expect(has(tree, 'settings-logout')).toBe(true);
  });
});
