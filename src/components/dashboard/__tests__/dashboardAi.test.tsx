/**
 * Plan 019 — Dashboard "Ask about your money" integration:
 *   - typing a question → analyze() receives the REAL mapped AskSnapshot
 *     (exact payload, incl. next-month commitments) with the fixed 'ask'
 *     prompt and the question as a distinct field;
 *   - tapping a suggestion submits it in one tap;
 *   - plan 020: no budget / buffer / safe-to-spend / allowance terms in the payload;
 *   - offline / invalidKey → typed error + Retry (same question) → recovers;
 *   - rapid double-submit → exactly ONE analyze call (pending guard);
 *   - idle → input + suggestions visible, result card absent.
 *
 * Module-mock stack: DB/auth/router/repos are inert doubles; CashFlowService
 * returns a fixture snapshot; the real createAIService + real facade run with
 * a FakeProvider injected (source of canned output + lastRequest assertions).
 * The mapper is the REAL toAskSnapshot — the payload asserted is production.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { FakeProvider } from '@/ai/providers/fake';
import { SYSTEM_PROMPTS } from '@/ai/AIService';
import { AI_ERROR_LABELS } from '@/components/AIAnalysisCard';
import { toAskSnapshot } from '@/services/toAskSnapshot';
import type { CashFlowSnapshot } from '@/services/CashFlowService';
import type { AIErrorReason } from '@/ai/types';
import DashboardScreen from '@/app/(tabs)/index';

/* ------------------------------------------------------------------ *
 * Module mocks — inert doubles for the screen's non-AI dependencies.
 * ------------------------------------------------------------------ */

jest.mock('@/db', () => ({
  repositories: () => ({
    accounts: {},
    expenses: {},
    commitments: {},
    settings: {},
    categories: {},
  }),
}));

jest.mock('@/services/CashFlowService', () => {
  const snapshot = jest.fn();
  return {
    __testSnapshot: snapshot,
    CashFlowService: class {
      snapshot = snapshot;
    },
  };
});

jest.mock('@/services/CategoryService', () => ({
  CategoryService: class {
    list = async () => [];
  },
}));

jest.mock('@/auth/AuthProvider', () => {
  // STABLE identity across renders — a fresh authService per render would
  // churn the screen's useMemo/useCallback deps, re-run the focus-load, and
  // loop forever.
  const authService = { currentUser: async () => ({ id: 1 }) };
  return {
    __testAuthService: authService,
    useAuth: () => ({ authService }),
  };
});

// The config layer reports 'fake' as the active provider, so the facade
// dispatches to the injected FakeProvider with no key/model resolution.
jest.mock('@/services/AiConfigService', () => ({
  AiConfigService: class {},
  aiServiceOptions: () => ({
    getActiveProvider: async () => 'fake',
    getKey: async () => null,
    getModelId: async () => null,
  }),
}));

jest.mock('expo-router', () => {
  // Real useFocusEffect semantics: run the callback once per mount and on
  // callback-identity change — NOT on every render, or the load's
  // re-render would loop forever.
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (cb: () => void) => {
      useEffect(() => {
        cb();
      }, [cb]);
    },
    useRouter: () => ({ navigate: jest.fn(), push: jest.fn() }),
  };
});

// The real facade runs; only the fake provider slot is injected.
jest.mock('@/ai/AIService', () => {
  const actual = jest.requireActual<typeof import('@/ai/AIService')>('@/ai/AIService');
  const { FakeProvider: RealFakeProvider } =
    jest.requireActual<typeof import('@/ai/providers/fake')>('@/ai/providers/fake');
  const fakeProvider = new RealFakeProvider();
  return {
    ...actual,
    __testFakeProvider: fakeProvider,
    createAIService: (
      name: Parameters<typeof actual.createAIService>[0],
      overrides: Parameters<typeof actual.createAIService>[1] = {},
      options: Parameters<typeof actual.createAIService>[2] = {},
    ) => actual.createAIService(name, { ...overrides, fake: fakeProvider }, options),
  };
});

/* ------------------------------------------------------------------ *
 * Test helpers
 * ------------------------------------------------------------------ */

function testFake(): FakeProvider {
  return (
    jest.requireMock('@/ai/AIService') as {
      __testFakeProvider: FakeProvider;
    }
  ).__testFakeProvider;
}

type SnapshotMock = jest.Mock<(now: Date) => Promise<CashFlowSnapshot>>;

const mockSnapshot = () =>
  (jest.requireMock('@/services/CashFlowService') as { __testSnapshot: SnapshotMock })
    .__testSnapshot;

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

async function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const matches = tree.root.findAllByProps({ testID });
  const el =
    matches.find((m) => typeof (m.props as { onPress?: unknown }).onPress === 'function') ??
    matches[matches.length - 1]!;
  await act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

async function renderDashboard(fixture: CashFlowSnapshot): Promise<ReactTestRenderer> {
  mockSnapshot().mockResolvedValue(fixture);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<DashboardScreen />);
  });
  await act(async () => {}); // run the focus-load effect (mount)
  await act(async () => {}); // flush load's promise continuations + re-render
  return tree;
}

/** Type a question into the ask box (controlled TextInput). */
async function typeQuestion(tree: ReactTestRenderer, question: string): Promise<void> {
  const input = byTestID(tree.root, 'ask-ai-input');
  await act(async () => {
    (input.props as { onChangeText: (t: string) => void }).onChangeText(question);
  });
}

/** Type a question and press send, then flush the analyze promise. */
async function askViaInput(tree: ReactTestRenderer, question: string): Promise<void> {
  await typeQuestion(tree, question);
  await press(tree, 'ask-ai-send');
  await act(async () => {}); // flush analyze + setState
}

/* ------------------------------------------------------------------ *
 * Fixtures — month derived from the run date (the screen's reference `now`).
 * ------------------------------------------------------------------ */

function buildFixture(overrides: Partial<CashFlowSnapshot> = {}): CashFlowSnapshot {
  const now = new Date();
  const base: CashFlowSnapshot = {
    month: { month: now.getMonth() + 1, year: now.getFullYear() },
    availableSen: 300_000,
    spentSen: 116_000,
    upcomingSen: 80_000,
    upcomingItems: [],
    nextMonthSen: 0,
    nextMonthItems: [],
    categorySummary: [],
    accountCount: 1,
  };
  return { ...base, ...overrides };
}

/** Next month has a real commitment — the user's "total commitment next month". */
function nextMonthFixture(): CashFlowSnapshot {
  const now = new Date();
  const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  return buildFixture({
    nextMonthSen: 120_000,
    nextMonthItems: [
      {
        commitmentId: 7,
        name: 'Car loan',
        dueDate: `${nextYear}-${String(nextMonth).padStart(2, '0')}-05`,
        amountSen: 120_000,
        frequency: 'monthly',
      },
    ],
  });
}

const DEFAULT_RESULT = {
  summary: 'You have RM800.00 of commitments due by the end of the month.',
  points: ['Rent is the largest item.', 'You have spent RM1,160.00 so far.'],
};

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('Dashboard — Ask about your money (plan 019)', () => {
  beforeEach(() => {
    const fake = testFake();
    fake.setMode({ kind: 'success' });
    fake.setResult(DEFAULT_RESULT);
  });

  // Spies wrap the shared fake across tests — restore between them so call
  // counts are per-test.
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the mapped AskSnapshot with the typed question and the fixed ask prompt', async () => {
    const fake = testFake();
    const fixture = buildFixture();
    const tree = await renderDashboard(fixture);

    await askViaInput(tree, 'What do I need to pay by the end of this month?');

    const request = fake.lastRequest;
    expect(request?.context).toBe('ask');
    expect(request?.systemPrompt).toBe(SYSTEM_PROMPTS.ask);
    expect(request?.question).toBe('What do I need to pay by the end of this month?');

    const sent = JSON.parse(request!.snapshot) as ReturnType<typeof toAskSnapshot>;
    // The production mapping, run with the same reference date — plus literal
    // pins so a silently-broken mapper cannot compound.
    expect(sent).toEqual(toAskSnapshot(fixture, []));
    expect(sent.spentSen).toBe(116_000);
    expect(sent.upcomingThisMonthSen).toBe(80_000);

    // The canned explanation renders inside the ask card, labelled with the
    // submitted question.
    expect(hasTestID(tree.root, 'ai-analysis-result')).toBe(true);
    expect(textOf(tree.root, 'ai-analysis-result')).toContain(DEFAULT_RESULT.summary);
    expect(textOf(tree.root, 'ai-analysis-label')).toContain(
      'What do I need to pay by the end of this month?',
    );
  });

  it('includes next month’s commitment total so "next month" questions are answerable', async () => {
    const fake = testFake();
    const tree = await renderDashboard(nextMonthFixture());

    await askViaInput(tree, 'Tell me what is my total commitment next month');

    const sent = JSON.parse(fake.lastRequest!.snapshot) as ReturnType<typeof toAskSnapshot>;
    expect(sent.nextMonthSen).toBe(120_000);
    expect(sent.nextMonth).toEqual([
      expect.objectContaining({ name: 'Car loan', amountSen: 120_000 }),
    ]);
  });

  it('submits a prebuilt suggestion in one tap', async () => {
    const fake = testFake();
    const spy = jest.spyOn(fake, 'analyze');
    const tree = await renderDashboard(buildFixture());

    // ASK_SUGGESTIONS[1] = "Explain my next month commitment".
    await press(tree, 'ask-ai-suggestion-1');
    await act(async () => {});

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fake.lastRequest?.question).toBe('Explain my next month commitment');
    expect(textOf(tree.root, 'ai-analysis-result')).toContain(DEFAULT_RESULT.summary);
  });

  it('sends no budget / buffer / safe-to-spend / allowance terms (plan 020)', async () => {
    const fake = testFake();
    const tree = await renderDashboard(buildFixture());

    await askViaInput(tree, 'Where is most of my money going?');

    const sent = JSON.parse(fake.lastRequest!.snapshot) as Record<string, unknown>;
    for (const key of [
      'hasBudget',
      'budgetSen',
      'remainingBudgetSen',
      'bufferSen',
      'safeSen',
      'dailyAllowanceSen',
      'daysRemaining',
      'deficit',
    ]) {
      expect(sent).not.toHaveProperty(key);
    }
  });

  it.each(['offline', 'invalidKey'] as AIErrorReason[])(
    'shows a typed %s error + Retry, and Retry resends the same question then recovers',
    async (reason) => {
      const fake = testFake();
      fake.setMode({ kind: 'fail', reason });
      const tree = await renderDashboard(buildFixture());

      await askViaInput(tree, 'Am I on track this month?');

      // Non-blocking inline error (AI-4): the shared fixed label for the typed
      // reason, never raw provider text.
      expect(hasTestID(tree.root, 'ai-analysis-error')).toBe(true);
      expect(textOf(tree.root, 'ai-analysis-error')).toContain(AI_ERROR_LABELS[reason]);
      expect(textOf(tree.root, 'ai-analysis-error')).not.toContain('FakeProvider failure');
      expect(hasTestID(tree.root, 'ai-analysis-pending')).toBe(false);

      // Retry succeeds once the provider recovers — with the SAME question.
      fake.setMode({ kind: 'success' });
      fake.setResult(DEFAULT_RESULT);
      await press(tree, 'ai-analysis-retry');
      await act(async () => {});

      expect(fake.lastRequest?.question).toBe('Am I on track this month?');
      expect(hasTestID(tree.root, 'ai-analysis-error')).toBe(false);
      expect(textOf(tree.root, 'ai-analysis-result')).toContain(DEFAULT_RESULT.summary);
    },
  );

  it('drops a rapid double-submit — exactly one analyze call while pending', async () => {
    const fake = testFake();
    const spy = jest.spyOn(fake, 'analyze');
    let release!: (raw: string) => void;
    spy.mockImplementation(
      (_request: Parameters<typeof fake.analyze>[0]) =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const tree = await renderDashboard(buildFixture());

    await typeQuestion(tree, 'Where is most of my money going?');
    await press(tree, 'ask-ai-send');
    await press(tree, 'ask-ai-send');

    // The first request is still in flight — the second submit is ignored.
    expect(spy).toHaveBeenCalledTimes(1);
    expect(hasTestID(tree.root, 'ai-analysis-pending')).toBe(true);

    await act(async () => {
      release(JSON.stringify(DEFAULT_RESULT));
    });
    expect(textOf(tree.root, 'ai-analysis-result')).toContain(DEFAULT_RESULT.summary);
  });

  it('shows the input + suggestions while idle, with no result card', async () => {
    const tree = await renderDashboard(buildFixture());
    expect(hasTestID(tree.root, 'ask-ai-card')).toBe(true);
    expect(hasTestID(tree.root, 'ask-ai-input')).toBe(true);
    expect(hasTestID(tree.root, 'ask-ai-suggestion-0')).toBe(true);
    expect(hasTestID(tree.root, 'ai-analysis-card')).toBe(false);
  });

  it('disables send until the input has non-whitespace text', async () => {
    const tree = await renderDashboard(buildFixture());
    const sendOf = (): { disabled?: boolean } =>
      (byTestID(tree.root, 'ask-ai-send').props as {
        accessibilityState?: { disabled?: boolean };
      }).accessibilityState ?? {};

    expect(sendOf().disabled).toBe(true);
    await typeQuestion(tree, '   ');
    expect(sendOf().disabled).toBe(true);
    await typeQuestion(tree, 'Why is my spending high?');
    expect(sendOf().disabled).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * Home layout (plan 020) — month summary → commitments due → category
 * summary → ask AI, with the Add-expense FAB and no Transfer/Scan dock.
 * ------------------------------------------------------------------ */

describe('Dashboard layout (plan 020)', () => {
  it('renders month summary → upcoming → category → ask ai, in that order', async () => {
    const tree = await renderDashboard(
      buildFixture({
        categorySummary: [
          { categoryId: 1, totalSen: 50_000 },
          { categoryId: 2, totalSen: 30_000 },
        ],
      }),
    );

    const cardIds = ['month-summary-card', 'upcoming-card', 'category-summary', 'ask-ai-card'];
    const rendered = tree.root
      .findAll((node) => typeof node.type === 'string' && cardIds.includes(node.props.testID))
      .map((node) => node.props.testID as string);

    expect(rendered).toEqual(cardIds);
  });

  it('shows spent this month and due by end of month from the snapshot', async () => {
    const tree = await renderDashboard(buildFixture({ spentSen: 116_050, upcomingSen: 80_000 }));

    expect(textOf(tree.root, 'summary-spent')).toBe('RM1,160.50');
    expect(textOf(tree.root, 'summary-due')).toBe('RM800.00');
  });

  it('removes the budget, allowance and safe-to-spend surfaces', async () => {
    const tree = await renderDashboard(buildFixture());
    for (const gone of ['hero-card', 'safe-to-spend', 'formula-card', 'budget-bar']) {
      expect(hasTestID(tree.root, gone)).toBe(false);
    }
  });

  it('has the Add-expense FAB and no Transfer / Scan buttons', async () => {
    const tree = await renderDashboard(buildFixture());
    expect(hasTestID(tree.root, 'add-expense-fab')).toBe(true);
    expect(hasTestID(tree.root, 'dashboard-action-transfer')).toBe(false);
    expect(hasTestID(tree.root, 'dashboard-action-scan')).toBe(false);
  });
});
