/**
 * Plan 014 — Analytics screen "Analyze my spending" (react-test-renderer).
 *
 * Renders the REAL screen (real AnalyticsService over a better-sqlite3 test
 * DB, real AIService facade + FakeProvider) with only the seams mocked:
 *  - @/db repositories() → test-DB repos (same construction as 011 service tests);
 *  - expo-router useFocusEffect → a plain effect (focus-on-mount semantics);
 *  - @/auth/AuthProvider useAuth → a fake signed-in CurrentUserSource;
 *  - @/services/AiConfigService → aiServiceOptions() {} so the facade uses its
 *    in-memory `fake` active provider (no SecureStore / settings table);
 *  - @/ai/providers/fake FakeProvider → a ControlledProvider wrapping the real
 *    FakeProvider (same modes/results) plus a test-only hold for in-flight
 *    assertions.
 *
 * Covers: empty month hides the button; tap → analyze receives EXACTLY the
 * selected month's AI payload (hand-computed from the 011 fixture); null
 * MoM baseline → changePct null payload + prompt's "no comparison" coverage;
 * every error reason → card error state + Retry re-runs the same payload;
 * canned AIResult renders summary + points; a month change mid-flight keeps
 * the card labelled with the tap-time month.
 */
import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type {
  AIAnalyzeRequest,
  AIErrorReason,
  AIProvider,
  AIResult,
  ModelInfo,
  TestOptions,
  TestResult,
} from '@/ai/types';
import { SYSTEM_PROMPTS } from '@/ai/AIService';
import type { FakeFailure, FakeResult } from '@/ai/providers/fake';
import { useUiStore } from '@/store/uiStore';
import type { CurrentUserSource } from '@/services/AccountService';
import AnalyticsScreen from '@/app/(tabs)/analytics';
import { createMigratedTestDb, type TestDb } from '@/db/testing';
import { insertDefaultCategoriesIfEmpty } from '@/db/seed';
import { categories as categoriesTable, users } from '@/db/schema';
import type { Account, Category, User } from '@/db/schema';
import { DrizzleAccountRepository } from '@/repositories/drizzle/accountRepository';
import { DrizzleBudgetRepository } from '@/repositories/drizzle/budgetRepository';
import { DrizzleCategoryRepository } from '@/repositories/drizzle/categoryRepository';
import { DrizzleCommitmentRepository } from '@/repositories/drizzle/commitmentRepository';
import { DrizzleExpenseRepository } from '@/repositories/drizzle/expenseRepository';
import { DrizzleSettingsRepository } from '@/repositories/drizzle/settingsRepository';
import type { Repositories } from '@/db/repositories';
import { ExpenseService } from '@/services/ExpenseService';
import type { ExpenseInput } from '@/repositories/types';

/* ------------------------------------------------------------------ *
 * Live seams — shared instances the module mocks hand to the screen.
 * (Names must start with `mock` for jest.mock factories to close over them.)
 * ------------------------------------------------------------------ */

const mockReposRef: { current: Repositories | null } = { current: null };
const mockAuthRef: { current: CurrentUserSource } = {
  current: { currentUser: async () => null },
};
let mockProvider: ControlledProvider | null = null;

jest.mock('@/db', () => ({
  repositories: () => mockReposRef.current,
}));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect]);
    },
  };
});

jest.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ authService: mockAuthRef.current }),
}));

// The screen wires AIService to AiConfigService; tests bypass the config layer
// so the facade dispatches to its in-memory `fake` active provider directly.
jest.mock('@/services/AiConfigService', () => ({
  AiConfigService: class AiConfigService {
    /* no-op — config resolvers are stubbed out below */
  },
  aiServiceOptions: () => ({}),
}));

jest.mock('@/ai/providers/fake', () => {
  const real = jest.requireActual<typeof import('@/ai/providers/fake')>('@/ai/providers/fake');
  return {
    ...real,
    // Every `new FakeProvider()` (the facade default) returns the shared
    // test-controlled instance when one is staged.
    FakeProvider: function FakeProvider(): unknown {
      return mockProvider ?? new real.FakeProvider();
    },
  };
});

/* ------------------------------------------------------------------ *
 * ControlledProvider — the real FakeProvider plus a test-only "hold" that
 * keeps a request in flight until the test releases it (month-drift test).
 * ------------------------------------------------------------------ */

const RealFakeProvider = jest.requireActual<typeof import('@/ai/providers/fake')>(
  '@/ai/providers/fake',
).FakeProvider;

class ControlledProvider implements AIProvider {
  readonly name = 'fake' as const;
  lastRequest?: AIAnalyzeRequest;

  /** Hold the NEXT analyze request until release()/fail() (in-flight tests). */
  holdNext = false;
  private readonly inner = new RealFakeProvider();
  private held: { resolve: (value: string) => void; reject: (reason: unknown) => void } | null =
    null;

  setMode(mode: FakeFailure): void {
    this.inner.setMode(mode);
  }

  setResult(result: FakeResult): void {
    this.inner.setResult(result);
  }

  testConnection(key: string, options?: TestOptions): Promise<TestResult> {
    return this.inner.testConnection(key, options);
  }

  listModels(key: string): Promise<ModelInfo[]> {
    return this.inner.listModels(key);
  }

  analyze(request: AIAnalyzeRequest): Promise<string> {
    this.lastRequest = request;
    if (this.holdNext) {
      this.holdNext = false;
      return new Promise((resolve, reject) => {
        this.held = { resolve, reject };
      });
    }
    return this.inner.analyze(request);
  }

  /** Settle a held request with the canned result (or an explicit payload). */
  release(payload?: string): void {
    const held = this.held;
    this.held = null;
    held?.resolve(
      payload ?? JSON.stringify({ summary: 'Late result.', points: ['Late point.'] }),
    );
  }
}

/* ------------------------------------------------------------------ *
 * Fixture — the 011 main fixture shape, shifted to past months so elapsed
 * days are deterministic regardless of the real clock (Aug analyzed,
 * Jul previous, Sep next-with-data; Jan for the null-baseline case).
 * ------------------------------------------------------------------ */

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
}: { seed?: 'standard' | 'augOnly' | 'januaryOnly' } = {}): Promise<Fixture> {
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
    budgets: new DrizzleBudgetRepository(test.db as unknown as never),
    commitments: new DrizzleCommitmentRepository(test.db as unknown as never),
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

  // Seed per scenario (all amounts in sen).
  if (seed === 'augOnly') {
    await f.expenses.create(expense(f, 12_050, f.categories[0]!.id, '2026-08-05'));
  } else if (seed === 'januaryOnly') {
    await f.expenses.create(expense(f, 5_000, f.categories[0]!.id, '2026-01-15'));
  } else {
    // July 2026 (previous): 50000 + 30000 = 80000.
    await f.expenses.create(expense(f, 50_000, f.categories[0]!.id, '2026-07-10'));
    await f.expenses.create(expense(f, 30_000, f.categories[2]!.id, '2026-07-20'));
    // August 2026 (analyzed): 12050 + 700 + 800 = 13550.
    await f.expenses.create(expense(f, 12_050, f.categories[0]!.id, '2026-08-05'));
    await f.expenses.create(expense(f, 700, f.categories[0]!.id, '2026-08-10'));
    await f.expenses.create(expense(f, 800, f.categories[2]!.id, '2026-08-08'));
    // September 2026 (the month switched TO mid-flight): 200000.
    await f.expenses.create(expense(f, 200_000, f.categories[0]!.id, '2026-09-12'));
  }

  mockReposRef.current = repos;
  mockAuthRef.current = { currentUser: async () => user };
  mockProvider = new ControlledProvider();
  return f;
}

/** Select the shared month BEFORE rendering (the screen loads it on focus). */
function selectMonth(month: number, year: number): void {
  useUiStore.getState().setSelectedMonth({ month, year });
}

/* ------------------------------------------------------------------ *
 * Render + interaction helpers (same conventions as aiConfigUI.test).
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
  await act(async () => {}); // flush focus-effect load continuations
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
}

async function flush(): Promise<void> {
  await act(async () => {});
}

/** The hand-computed AI payload for August 2026 (see makeFixture addends). */
function expectedAugustPayload(): Record<string, unknown> {
  return {
    month: '2026-08',
    monthLabel: 'August 2026',
    totalSen: 13_550,
    previousTotalSen: 80_000,
    changeSen: -66_450, // 13550 − 80000
    changePct: -83.1, // floor(−66450×1000/80000)/10 = −83.1
    avgDailySen: 437, // floor(13550/31): past month, fully elapsed
    projectionSen: 13_550, // identity for a completed month
    utilization: null, // no OVERALL budget row
    topCategories: [
      { name: 'Food', amountSen: 12_750 },
      { name: 'Transport', amountSen: 800 },
    ],
    largest: [
      { name: 'Food', amountSen: 12_050 },
      { name: 'Transport', amountSen: 800 },
      { name: 'Food', amountSen: 700 },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('Analytics — "Analyze my spending" (plan 014)', () => {
  beforeEach(() => {
    // uiStore persists between tests — start from a clean selection.
    useUiStore.setState({ selectedMonth: { month: 9, year: 2026 } });
  });

  it('hides the action button on an empty month (not an error)', async () => {
    await makeFixture({ seed: 'augOnly' });
    // Default selection = the real current month (Sep 2026) — seeded empty.
    const tree = await render(<AnalyticsScreen />);
    expect(hasTestID(tree.root, 'analytics-empty')).toBe(true);
    expect(hasTestID(tree.root, 'analytics-analyze-button')).toBe(false);
    expect(hasTestID(tree.root, 'ai-analysis-card')).toBe(false);
  });

  it('shows the button on a month with data and analyzes it on tap', async () => {
    await makeFixture();
    selectMonth(8, 2026);
    const tree = await render(<AnalyticsScreen />);

    expect(hasTestID(tree.root, 'analytics-analyze-button')).toBe(true);
    await press(tree, 'analytics-analyze-button');

    // The provider received EXACTLY the selected month's AI payload.
    expect(mockProvider?.lastRequest?.context).toBe('spending');
    expect(mockProvider?.lastRequest?.systemPrompt).toBe(SYSTEM_PROMPTS.spending);
    expect(JSON.parse(mockProvider!.lastRequest!.snapshot)).toEqual(expectedAugustPayload());

    // And the card renders the (canned) result under the chip.
    expect(textOf(tree.root, 'ai-analysis-summary')).toContain('Fake analysis summary.');
  });

  it('null MoM baseline (previous month empty) → changePct null + prompt covers "no comparison"', async () => {
    await makeFixture({ seed: 'januaryOnly' });
    selectMonth(1, 2026);
    const tree = await render(<AnalyticsScreen />);

    // The MoM chip renders the no-comparison dash (AN-1)…
    expect(textOf(tree.root, 'analytics-mom-label')).toBe('—');
    // …and the prompt tells the model there is no comparison available —
    // it must never invent a trend (AI-3).
    expect(SYSTEM_PROMPTS.spending).toContain('comparison available');

    await press(tree, 'analytics-analyze-button');
    const payload = JSON.parse(mockProvider!.lastRequest!.snapshot) as {
      previousTotalSen: number;
      changePct: number | null;
      changeSen: number;
    };
    expect(payload.previousTotalSen).toBe(0);
    expect(payload.changePct).toBeNull();
    expect(payload.changeSen).toBe(5_000);
  });

  it.each(['offline', 'timeout', 'invalidKey', 'invalidResponse'] as AIErrorReason[])(
    'failure "%s" → typed error card, and Retry re-runs the same payload to success',
    async (reason) => {
      await makeFixture();
      selectMonth(8, 2026);
      mockProvider!.setMode({ kind: 'fail', reason });
      const tree = await render(<AnalyticsScreen />);

      await press(tree, 'analytics-analyze-button');
      expect(hasTestID(tree.root, 'ai-analysis-error')).toBe(true);
      expect(hasTestID(tree.root, 'ai-analysis-retry')).toBe(true);
      expect(hasTestID(tree.root, 'ai-analysis-result')).toBe(false);

      // Retry resends the SAME tap-time payload and lands on success.
      mockProvider!.setMode({ kind: 'success' });
      await press(tree, 'ai-analysis-retry');
      expect(JSON.parse(mockProvider!.lastRequest!.snapshot)).toEqual(expectedAugustPayload());
      expect(textOf(tree.root, 'ai-analysis-summary')).toContain('Fake analysis summary.');
      expect(hasTestID(tree.root, 'ai-analysis-error')).toBe(false);
    },
  );

  it('renders a canned AIResult: summary + every point, ≤5', async () => {
    await makeFixture();
    selectMonth(8, 2026);
    const canned: AIResult = {
      summary: 'Food dominated August.',
      points: ['Food was RM127.50 of RM135.50.', 'Transport was RM8.00.', 'Pace is stable.'],
    };
    mockProvider!.setResult(canned);
    const tree = await render(<AnalyticsScreen />);

    await press(tree, 'analytics-analyze-button');

    expect(textOf(tree.root, 'ai-analysis-label')).toBe('August 2026');
    expect(textOf(tree.root, 'ai-analysis-summary')).toBe('Food dominated August.');
    expect(textOf(tree.root, 'ai-analysis-point-0')).toContain('RM127.50');
    expect(textOf(tree.root, 'ai-analysis-point-1')).toContain('RM8.00');
    expect(textOf(tree.root, 'ai-analysis-point-2')).toContain('Pace is stable.');
    expect(hasTestID(tree.root, 'ai-analysis-point-3')).toBe(false);
  });

  it('a month change mid-flight labels the card with the TAP-TIME month (no drift)', async () => {
    await makeFixture();
    selectMonth(8, 2026);
    mockProvider!.holdNext = true;
    const tree = await render(<AnalyticsScreen />);

    // Tap on August → request held in flight; card shows pending.
    await press(tree, 'analytics-analyze-button');
    expect(hasTestID(tree.root, 'ai-analysis-pending')).toBe(true);
    expect(textOf(tree.root, 'ai-analysis-label')).toBe('August 2026');

    // User navigates to September while the August analysis is in flight.
    await press(tree, 'analytics-month-next');
    await flush();
    expect(textOf(tree.root, 'analytics-total')).toBe('RM2,000.00'); // September renders
    expect(textOf(tree.root, 'ai-analysis-label')).toBe('August 2026'); // still labelled Aug

    // The held request resolves with the tap-time snapshot → card keeps Aug label.
    mockProvider!.release();
    await flush();
    expect(hasTestID(tree.root, 'ai-analysis-pending')).toBe(false);
    expect(textOf(tree.root, 'ai-analysis-label')).toBe('August 2026');
    expect(textOf(tree.root, 'ai-analysis-summary')).toContain('Late result');
  });
});