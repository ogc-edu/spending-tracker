/**
 * Plan 012 — AIService facade + factory + prompt registry tests.
 * Covers: factory returns the fake (DI point); analyze dispatches to the active
 * provider with the fixed prompt + serialized snapshot; every FakeProvider
 * failure mode maps to the right AIError reason; provider output validation
 * (malformed -> invalidResponse); provider config capabilities.
 */
import { describe, expect, it } from '@jest/globals';
import { createAIService, SYSTEM_PROMPTS } from '../AIService';
import { FakeProvider } from '../providers/fake';
import { AIUnavailableError } from '../errors';
import type {
  AIErrorReason,
  AIProviderName,
  AllowanceSnapshot,
  AIContext,
  DebtSnapshot,
  SpendingSnapshot,
} from '../types';

const debtSnapshot: DebtSnapshot = {
  commitments: [
    { name: 'Rent', type: 'monthly', remainingSen: 1_200_000 },
    { name: 'Phone', type: 'monthly', remainingSen: 60_000, paidCount: 2, totalCount: 6 },
  ],
  upcomingBeforeNextMonthSen: 1_260_000,
  overdueSen: 0,
  totalRemainingSen: 1_260_000,
};

const spendingSnapshot: SpendingSnapshot = {
  month: '2026-08',
  monthLabel: 'August 2026',
  totalSen: 300_000,
  previousTotalSen: 320_000,
  changeSen: -20_000,
  changePct: -6.25,
  avgDailySen: 9_677,
  projectionSen: 300_000,
  utilization: { pct: 10.0, overBudget: false },
  topCategories: [
    { name: 'Food', amountSen: 120_000 },
    { name: 'Transport', amountSen: 50_000 },
  ],
};

const allowanceSnapshot: AllowanceSnapshot = {
  availableSen: 500_000,
  upcomingSen: 200_000,
  remainingBudgetSen: 300_000,
  bufferSen: 50_000,
  safeSen: 250_000,
  dailyAllowanceSen: 8_333,
  daysRemaining: 30,
  // Plan 015 — the no-budget signal is part of the allowance payload.
  hasBudget: true,
};

const SNAPSHOTS: Record<AIContext, unknown> = {
  debt: debtSnapshot,
  spending: spendingSnapshot,
  allowance: allowanceSnapshot,
};

/** Every snapshot is a pure, JSON-serializable DTO (plan §Requirements). */
describe('snapshot serialization', () => {
  it.each(['debt', 'spending', 'allowance'] as const)(
    '%s snapshot round-trips through JSON without loss',
    (context) => {
      const snapshot = SNAPSHOTS[context];
      expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    },
  );
});

describe('prompt registry', () => {
  it('has a fixed template for every context', () => {
    expect(Object.keys(SYSTEM_PROMPTS).sort()).toEqual([
      'allowance',
      'debt',
      'spending',
    ]);
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    }
  });

  it('never interpolates user free text (fixed strings only)', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });

    await svc.analyze('debt', debtSnapshot);
    await svc.analyze('spending', spendingSnapshot);
    await svc.analyze('allowance', allowanceSnapshot);

    const sent = [0, 1, 2].map((i) => fake.lastRequest).filter(Boolean);
    for (const req of sent) {
      expect(req?.systemPrompt).toBe(SYSTEM_PROMPTS[req!.context]);
    }
  });
});

describe('createAIService factory', () => {
  it('defaults to the fake provider', () => {
    expect(createAIService().activeProvider).toBe('fake');
  });

  it('returns the requested provider as active', () => {
    expect(createAIService('fake').activeProvider).toBe('fake');
  });

  it('accepts an injected fake provider (DI point for 013-015)', () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });
    expect(svc.activeProvider).toBe('fake');
    return expect(svc.analyze('debt', debtSnapshot)).resolves.toEqual({
      summary: 'Fake analysis summary.',
      points: ['Fake point one.'],
    });
  });

  it('throws a typed error for an unknown provider name', () => {
    expect(() => createAIService('bogus' as never)).toThrow(AIUnavailableError);
  });

  it('setActiveProvider rejects unknown names', () => {
    const svc = createAIService();
    expect(() => svc.setActiveProvider('bogus' as never)).toThrow(AIUnavailableError);
  });

  it('setActiveProvider switches the dispatch target', async () => {
    const fake = new FakeProvider();
    const other = new FakeProvider();
    other.setResult({ summary: 'From gemini slot.', points: [] });
    const svc = createAIService('fake', { fake, gemini: other });
    svc.setActiveProvider('gemini');
    expect(svc.activeProvider).toBe('gemini');
    // With no config layer wired, the facade refuses to dispatch a real
    // provider without a key (plan 013 — BYOK enforcement).
    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'invalidKey',
    });
  });
});

describe('AIService.analyze — happy path', () => {
  it('returns the provider result validated by AIResultSchema', async () => {
    const fake = new FakeProvider();
    fake.setResult({ summary: 'Your rent is due.', points: ['Point A', 'Point B'] });
    const svc = createAIService('fake', { fake });

    const result = await svc.analyze('debt', debtSnapshot);
    expect(result).toEqual({ summary: 'Your rent is due.', points: ['Point A', 'Point B'] });
  });

  it('sends the fixed system prompt + JSON-serialized snapshot to the provider', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });

    await svc.analyze('spending', spendingSnapshot);

    expect(fake.lastRequest).toBeDefined();
    expect(fake.lastRequest?.context).toBe('spending');
    expect(fake.lastRequest?.systemPrompt).toBe(SYSTEM_PROMPTS.spending);
    expect(JSON.parse(fake.lastRequest!.snapshot)).toEqual(spendingSnapshot);
  });

  it('rejects an invalid snapshot before calling the provider', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });

    await expect(
      svc.analyze('debt', { ...debtSnapshot, totalRemainingSen: 'oops' } as never),
    ).rejects.toThrow(TypeError);
    expect(fake.lastRequest).toBeUndefined();
  });
});

describe('AIService.analyze — FakeProvider failure modes', () => {
  it.each(
    ['offline', 'timeout', 'http', 'invalidKey', 'invalidResponse', 'unknown'] as AIErrorReason[],
  )('maps fail(%s) to the same typed reason', async (reason) => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'fail', reason });
    const svc = createAIService('fake', { fake });

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason,
    });
  });

  it('maps unparseable JSON output to invalidResponse', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'invalid-json' });
    const svc = createAIService('fake', { fake });

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'invalidResponse',
    });
  });

  it('maps JSON with the wrong shape to invalidResponse (never rendered)', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'invalid-shape' });
    const svc = createAIService('fake', { fake });

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'invalidResponse',
    });
  });

  it('surfaces every failure as AIUnavailableError (typed, UI-able)', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'fail', reason: 'http' });
    const svc = createAIService('fake', { fake });

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toBeInstanceOf(
      AIUnavailableError,
    );
  });
});

describe('provider-config capabilities (AI-7/AI-8)', () => {
  it('testConnection resolves ok on the fake in success mode', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });
    await expect(svc.testConnection('fake', 'test-key')).resolves.toEqual({ ok: true });
  });

  it('testConnection maps the configured failure to a TestResult reason', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'fail', reason: 'invalidKey' });
    const svc = createAIService('fake', { fake });
    await expect(svc.testConnection('fake', 'bad-key')).resolves.toEqual({
      ok: false,
      reason: 'invalidKey',
    });
  });

  it('listModels returns the canned ModelInfo list', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });
    await expect(svc.listModels('fake', 'test-key')).resolves.toEqual([
      { id: 'fake-text-model' },
    ]);
  });

  it('listModels rejects when the provider fails', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'fail', reason: 'offline' });
    const svc = createAIService('fake', { fake });
    await expect(svc.listModels('fake', 'test-key')).rejects.toMatchObject({
      reason: 'offline',
    });
  });
});

describe('AIService config resolvers (plan 013 BYOK wiring)', () => {
  it('analyze dispatches to the persisted active provider with its key + model', async () => {
    const fake = new FakeProvider(); // injected into the gemini slot
    const svc = createAIService(
      'fake',
      { gemini: fake },
      {
        getActiveProvider: async (): Promise<AIProviderName | null> => 'gemini',
        getKey: async (p) => (p === 'gemini' ? 'sk-gemini-1234' : null),
        getModelId: async (p) => (p === 'gemini' ? 'gemini-3.6-flash' : null),
      },
    );

    const result = await svc.analyze('debt', debtSnapshot);
    expect(fake.lastRequest?.key).toBe('sk-gemini-1234');
    expect(fake.lastRequest?.modelId).toBe('gemini-3.6-flash');
    expect(result.summary).toBe('Fake analysis summary.');
  });

  it('throws a typed error instead of dispatching when no provider is configured', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake }, {
      getActiveProvider: async (): Promise<AIProviderName | null> => null,
    });

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'unknown',
      message: 'No AI provider configured',
    });
    expect(fake.lastRequest).toBeUndefined();
  });

  it('rejects with invalidKey when the active provider has no stored key', async () => {
    const fake = new FakeProvider();
    const svc = createAIService(
      'fake',
      { gemini: fake },
      {
        getActiveProvider: async (): Promise<AIProviderName | null> => 'gemini',
        getKey: async () => null,
        getModelId: async () => 'gemini-3.6-flash',
      },
    );

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'invalidKey',
    });
    expect(fake.lastRequest).toBeUndefined();
  });

  it('rejects with modelUnavailable when the active provider has no selected model', async () => {
    const fake = new FakeProvider();
    const svc = createAIService(
      'fake',
      { gemini: fake },
      {
        getActiveProvider: async (): Promise<AIProviderName | null> => 'deepseek',
        getKey: async () => 'sk-ds-1',
        getModelId: async () => null,
      },
    );

    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'modelUnavailable',
    });
    expect(fake.lastRequest).toBeUndefined();
  });

  it('getActiveProvider surfaces the persisted choice when a resolver is wired', async () => {
    const svc = createAIService('fake', {}, {
      getActiveProvider: async (): Promise<AIProviderName | null> => 'deepseek',
    });
    await expect(svc.getActiveProvider()).resolves.toBe('deepseek');
  });
});