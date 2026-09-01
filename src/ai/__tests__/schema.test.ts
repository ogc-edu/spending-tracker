/**
 * Plan 012 — Zod schema validation tests.
 * Covers: AIResult accept/reject fixtures; per-context snapshot schemas reject
 * wrong shapes. (The malformed-response -> invalidResponse mapping is tested
 * in service.test.ts; here we pin the schemas themselves.)
 */
import { describe, expect, it } from '@jest/globals';
import {
  AIResultSchema,
  AllowanceSnapshotSchema,
  DebtSnapshotSchema,
  SpendingSnapshotSchema,
} from '../schema';
import { MAX_POINTS, MAX_SUMMARY_CHARS } from '../types';

describe('AIResultSchema', () => {
  it('accepts a valid AIResult', () => {
    const res = AIResultSchema.safeParse({ summary: 'ok', points: ['a', 'b'] });
    expect(res.success).toBe(true);
  });

  it('accepts an empty points array', () => {
    expect(AIResultSchema.safeParse({ summary: 'ok', points: [] }).success).toBe(true);
  });

  it('rejects a missing summary', () => {
    expect(AIResultSchema.safeParse({ points: ['a'] }).success).toBe(false);
  });

  it('rejects a non-string summary', () => {
    expect(AIResultSchema.safeParse({ summary: 123, points: [] }).success).toBe(false);
  });

  it('rejects points that are not strings', () => {
    expect(
      AIResultSchema.safeParse({ summary: 'ok', points: ['a', 2] }).success,
    ).toBe(false);
  });

  it(`rejects more than ${MAX_POINTS} points`, () => {
    expect(
      AIResultSchema.safeParse({
        summary: 'ok',
        points: Array.from({ length: MAX_POINTS + 1 }, (_, i) => `p${i}`),
      }).success,
    ).toBe(false);
  });

  it(`rejects a summary longer than ${MAX_SUMMARY_CHARS} chars`, () => {
    expect(
      AIResultSchema.safeParse({
        summary: 'x'.repeat(MAX_SUMMARY_CHARS + 1),
        points: [],
      }).success,
    ).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(AIResultSchema.safeParse('nope').success).toBe(false);
    expect(AIResultSchema.safeParse(null).success).toBe(false);
  });
});

/** Hand-computed debt snapshot fixture. */
const debt = {
  commitments: [
    { name: 'Rent', type: 'monthly', remainingSen: 1_200_000, nextDue: '2026-09-01' },
    { name: 'Phone', type: 'monthly', remainingSen: 60_000, paidCount: 2, totalCount: 6 },
  ],
  upcomingBeforeNextMonthSen: 1_260_000,
  overdueSen: 0,
  totalRemainingSen: 1_260_000,
};

/** Hand-computed spending snapshot fixture (sen, changePct one decimal / null). */
const spending = {
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
  largest: [
    { name: 'Food', amountSen: 120_000 },
    { name: 'Transport', amountSen: 50_000 },
  ],
};

/** Hand-computed allowance snapshot fixture. */
const allowance = {
  availableSen: 500_000,
  upcomingSen: 200_000,
  remainingBudgetSen: 300_000,
  bufferSen: 50_000,
  safeSen: 250_000,
  dailyAllowanceSen: 8_333,
  daysRemaining: 30,
};

describe('DebtSnapshotSchema', () => {
  it('accepts the debt fixture', () => {
    expect(DebtSnapshotSchema.safeParse(debt).success).toBe(true);
  });

  it('rejects a missing field', () => {
    const { totalRemainingSen: _omit, ...rest } = debt;
    expect(DebtSnapshotSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a non-integer sen value', () => {
    expect(
      DebtSnapshotSchema.safeParse({ ...debt, overdueSen: 12.5 }).success,
    ).toBe(false);
  });

  it('rejects a commitment with an unknown type', () => {
    expect(
      DebtSnapshotSchema.safeParse({
        ...debt,
        commitments: [{ ...debt.commitments[0], type: 'weekly' }],
      }).success,
    ).toBe(false);
  });
});

describe('SpendingSnapshotSchema', () => {
  it('accepts the spending fixture (no free-text descriptions anywhere)', () => {
    expect(SpendingSnapshotSchema.safeParse(spending).success).toBe(true);
  });

  it('accepts a null changePct', () => {
    expect(
      SpendingSnapshotSchema.safeParse({ ...spending, changePct: null }).success,
    ).toBe(true);
  });

  it('rejects a non YYYY-MM month', () => {
    expect(SpendingSnapshotSchema.safeParse({ ...spending, month: 'Aug 2026' }).success).toBe(
      false,
    );
  });

  it('rejects non-integer sen', () => {
    expect(
      SpendingSnapshotSchema.safeParse({ ...spending, totalSen: 300_000.5 }).success,
    ).toBe(false);
  });

  it('has no description field on category items (A6 hygiene)', () => {
    const result = SpendingSnapshotSchema.safeParse(spending);
    expect(
      'description' in (result.success ? result.data.topCategories[0] : {}),
    ).toBe(false);
  });
});

describe('AllowanceSnapshotSchema', () => {
  it('accepts the allowance fixture — including a deficit safeSen', () => {
    expect(
      AllowanceSnapshotSchema.safeParse({ ...allowance, safeSen: -10_000 }).success,
    ).toBe(true);
  });

  it('rejects a missing daysRemaining', () => {
    const { daysRemaining: _omit, ...rest } = allowance;
    expect(AllowanceSnapshotSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a non-integer sen', () => {
    expect(
      AllowanceSnapshotSchema.safeParse({ ...allowance, bufferSen: 49.9 }).success,
    ).toBe(false);
  });
});
