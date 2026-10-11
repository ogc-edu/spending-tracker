/**
 * Wave 2D — Analytics screen tests (react-test-renderer).
 *
 * Covers:
 *  - ScreenTitleBlock: large title 'Analytics';
 *  - Horizontal-scroll category chips: 'All' + every category;
 *  - SegmentedControl: Day / Week / Month (default Month);
 *  - Selected period header: caption title over amountL + right-aligned Average per [unit];
 *  - BarChart: svg-powered chart with bars for Day / Week / Month;
 *  - Footnote: 'Highest: [period] · RMx' + ' · tap a bar to compare';
 *  - BreakdownRows: categories and percentage shares with progress bar;
 *  - Category selection: chip tap filters series and shows selected category breakdown;
 *  - Bar tap: selects period and updates header, amount, and breakdown rows.
 */
import React from 'react';
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { CurrentUserSource } from '@/services/AccountService';
import AnalyticsScreen from '@/app/(tabs)/analytics';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { categories as categoriesTable, users } from '@/db/schema';
import type { Account, Category, User } from '@/db/schema';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzlePayrollRepository } from '@/repositories/drizzle/payrollRepository';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import type { Repositories } from '@/db/repositories';
import { ExpenseService } from '@/services/ExpenseService';
import type { ExpenseInput } from '@/repositories/types';
import { todayLocal } from '@/utils/dates';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockReposRef: { current: Repositories | null } = { current: null };
const mockAuthRef: { current: CurrentUserSource } = {
  current: { currentUser: async () => null },
};

jest.mock('@/db', () => ({
  repositories: () => mockReposRef.current,
}));

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(effect, [effect]);
    },
    useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), back: jest.fn() }),
  };
});

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ authService: mockAuthRef.current }),
}));

interface Fixture {
  test: TestDb;
  user: User;
  categories: Category[];
  cash: Account;
  expenses: ExpenseService;
}

function expense(f: Fixture, amountSen: number, categoryId: number, date: string): ExpenseInput {
  return { amountSen, categoryId, accountId: f.cash.id, date };
}

async function makeFixture({
  seed = 'standard',
}: { seed?: 'standard' | 'empty' } = {}): Promise<Fixture> {
  const test = createMigratedTestDb();
  test.db
    .insert(users)
    .values([
      { email: 'owner@example.com', passwordHash: 'hash' },
      { email: 'other@example.com', passwordHash: 'hash' },
    ])
    .run();
  const all = test.db.select().from(users).all() as User[];
  const user = all.find((u) => u.email === 'owner@example.com') as User;
  await insertDefaultCategoriesIfEmpty(test.db);
  const categories = test.db.select().from(categoriesTable).all() as Category[];

  const accountRepo = new DrizzleAccountRepository(test.db as unknown as never);
  const cash = await accountRepo.create({
    userId: user.id,
    name: 'Cash',
    type: 'cash',
    initialBalanceSen: 1_000_000,
  });

  const repos: Repositories = {
    accounts: accountRepo,
    categories: new DrizzleCategoryRepository(test.db as unknown as never),
    expenses: new DrizzleExpenseRepository(test.db as unknown as never),
    commitments: new DrizzleCommitmentRepository(test.db as unknown as never),
    payroll: new DrizzlePayrollRepository(test.db as unknown as never),
    settings: new DrizzleSettingsRepository(test.db as unknown as never),
  };

  const f: Fixture = {
    test,
    user,
    categories,
    cash,
    expenses: new ExpenseService(repos.expenses, repos.categories, {
      currentUser: async () => user,
    }),
  };

  if (seed === 'standard') {
    const today = todayLocal();
    const foodId = categories.find((c) => c.name === 'Food')?.id ?? categories[0]!.id;
    const transportId = categories.find((c) => c.name === 'Transport')?.id ?? categories[1]!.id;

    // Expenses on today
    await f.expenses.create(expense(f, 5_000, foodId, today));
    await f.expenses.create(expense(f, 3_000, transportId, today));
  }

  mockReposRef.current = repos;
  mockAuthRef.current = { currentUser: async () => user };
  return f;
}

/* ------------------------------------------------------------------ *
 * Render + interaction helpers
 * ------------------------------------------------------------------ */

function byTestID(root: ReactTestInstance, testID: string): ReactTestInstance {
  const matches = root.findAllByProps({ testID });
  const el = matches[matches.length - 1];
  if (!el) throw new Error(`no element with testID ${testID}`);
  return el;
}

function hasTestID(root: ReactTestInstance, testID: string): boolean {
  return root.findAllByProps({ testID }).length > 0;
}

function textOf(root: ReactTestInstance, testID: string): string {
  const el = byTestID(root, testID);
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

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  await act(async () => {}); // flush promises
  return tree;
}

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const matches = tree.root.findAllByProps({ testID });
  const el =
    matches.find((m) => typeof (m.props as { onPress?: unknown }).onPress === 'function') ??
    matches[matches.length - 1]!;
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
  await act(async () => {}); // flush updates
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('AnalyticsScreen — Wave 2D UI redesign', () => {
  beforeEach(() => {
    mockReposRef.current = null;
  });

  it('renders largeTitle "Analytics" and root screen testID', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-screen')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-title')).toBe(true);
    expect(textOf(tree.root, 'analytics-title')).toContain('Analytics');
  });

  it('renders category chips including All and every category', async () => {
    const f = await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-category-chips')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-category-all')).toBe(true);

    const firstCat = f.categories[0]!;
    expect(hasTestID(tree.root, `analytics-category-${firstCat.id}`)).toBe(true);
    expect(textOf(tree.root, `analytics-category-${firstCat.id}`)).toBe(firstCat.name);
  });

  it('renders SegmentedControl with Day / Week / Month options (default Month)', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-grain-segmented')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-grain-segmented-day')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-grain-segmented-week')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-grain-segmented-month')).toBe(true);
  });

  it('renders BarChart with bars, period header, and average per month', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-barchart')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-period-title')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-selected-amount')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-avg-label')).toBe(true);
    expect(textOf(tree.root, 'analytics-avg-label')).toBe('Average per month');
    expect(hasTestID(tree.root, 'analytics-avg-amount')).toBe(true);
  });

  it('renders highest period footnote with tap a bar to compare hint', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-highest-footnote')).toBe(true);
    const footnote = textOf(tree.root, 'analytics-highest-footnote');
    expect(footnote).toContain('Highest:');
    expect(footnote).toContain('tap a bar to compare');
  });

  it('renders BreakdownRows for categories with spending in the period', async () => {
    const f = await makeFixture({ seed: 'standard' });
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-breakdown-section')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-breakdown-title')).toBe(true);

    const foodCat = f.categories.find((c) => c.name === 'Food')!;
    const transportCat = f.categories.find((c) => c.name === 'Transport')!;

    expect(hasTestID(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toBe(true);
    expect(hasTestID(tree.root, `analytics-breakdown-row-${transportCat.id}`)).toBe(true);

    // Food was 5000 / 8000 = 63%
    expect(textOf(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toContain('Food');
    expect(textOf(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toContain('RM50.00');

    // Transport was 3000 / 8000 = 38%
    expect(textOf(tree.root, `analytics-breakdown-row-${transportCat.id}`)).toContain('Transport');
    expect(textOf(tree.root, `analytics-breakdown-row-${transportCat.id}`)).toContain('RM30.00');
  });

  it('filters by category on chip press, updating header and breakdown', async () => {
    const f = await makeFixture({ seed: 'standard' });
    const tree = await render(<AnalyticsScreen />);

    const foodCat = f.categories.find((c) => c.name === 'Food')!;
    await press(tree, `analytics-category-${foodCat.id}`);

    // Header now reflects "· Food"
    expect(textOf(tree.root, 'analytics-period-title')).toContain('Food');
    expect(textOf(tree.root, 'analytics-selected-amount')).toBe('RM50.00');

    // Breakdown shows only Food at 100%
    expect(hasTestID(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toBe(true);
    expect(textOf(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toContain('100%');
    expect(textOf(tree.root, `analytics-breakdown-row-${foodCat.id}`)).toContain('RM50.00');

    // Transport row is not shown in Food breakdown
    const transportCat = f.categories.find((c) => c.name === 'Transport')!;
    expect(hasTestID(tree.root, `analytics-breakdown-row-${transportCat.id}`)).toBe(false);

    // Pressing 'All' restores both rows
    await press(tree, 'analytics-category-all');
    expect(hasTestID(tree.root, `analytics-breakdown-row-${transportCat.id}`)).toBe(true);
  });

  it('switches between Day, Week, and Month granularities', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    // Switch to Day
    await press(tree, 'analytics-grain-segmented-day');
    expect(textOf(tree.root, 'analytics-avg-label')).toBe('Average per day');

    // Switch to Week
    await press(tree, 'analytics-grain-segmented-week');
    expect(textOf(tree.root, 'analytics-avg-label')).toBe('Average per week');

    // Switch back to Month
    await press(tree, 'analytics-grain-segmented-month');
    expect(textOf(tree.root, 'analytics-avg-label')).toBe('Average per month');
  });

  it('tapping a bar updates the selected period', async () => {
    await makeFixture();
    const tree = await render(<AnalyticsScreen />);

    // Tap first bar (bar index 0)
    await press(tree, 'analytics-barchart-bar-0');
    expect(hasTestID(tree.root, 'analytics-period-title')).toBe(true);
  });
});