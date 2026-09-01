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
  totalSen: 300_000,
  previousTotalSen: 320_000,
  changeSen: -20_000,
  changePct: -6.25,
  avgDailySen: 9_677,
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
    const svc = createAIService('fake', { fake });
    svc.setActiveProvider('gemini');
    expect(svc.activeProvider).toBe('gemini');
    // Gemini is a stub in plan 012 — typed, clear error.
    await expect(svc.analyze('debt', debtSnapshot)).rejects.toMatchObject({
      reason: 'unknown',
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
  it('testConnection resolves on the fake in success mode', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });
    await expect(svc.testConnection('fake', 'test-key')).resolves.toBeUndefined();
  });

  it('testConnection rejects with the configured reason', async () => {
    const fake = new FakeProvider();
    fake.setMode({ kind: 'fail', reason: 'invalidKey' });
    const svc = createAIService('fake', { fake });
    await expect(svc.testConnection('fake', 'bad-key')).rejects.toMatchObject({
      reason: 'invalidKey',
    });
  });

  it('listModels returns the canned model list', async () => {
    const fake = new FakeProvider();
    const svc = createAIService('fake', { fake });
    await expect(svc.listModels('fake', 'test-key')).resolves.toEqual([
      'fake-text-model',
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