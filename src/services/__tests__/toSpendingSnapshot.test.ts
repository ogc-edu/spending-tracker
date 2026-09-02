/**
 * Plan 014 — toSpendingSnapshot mapping tests.
 * The Analytics screen renders AnalyticsService.SpendingSnapshot; this mapper
 * produces the EXACT AI payload sent to AIService.analyze('spending', …)
 * (validated against the 012 schema, extended 014). Hand-computed fixtures —
 * the arithmetic is written out and mirrors the analyticsService (011) main
 * fixture so the numbers stay cross-plan consistent.
 */
import { describe, expect, it } from '@jest/globals';
import type { SpendingSnapshot as AnalyticsSpendingSnapshot } from '@/services/AnalyticsService';
import { toSpendingSnapshot } from '@/services/toSpendingSnapshot';

/** The analytics snapshot for August 2026 (011 main fixture shape: 13550 sen total). */
const analyticsSnapshot: AnalyticsSpendingSnapshot = {
  month: { month: 8, year: 2026 },
  totalSen: 13_550,
  breakdown: [
    { categoryId: 1, categoryName: 'Food', amountSen: 12_750 },
    { categoryId: 3, categoryName: 'Transport', amountSen: 800 },
  ],
  previousMonth: { month: { month: 7, year: 2026 }, totalSen: 80_000 },
  changeSen: -66_450, // 13550 − 80000
  changePct: -83.1, // floor(−66450×1000/80000)/10 = floor(−830.625)/10 = −83.1
  avgDailySen: 437, // floor(13550/31) — August fully elapsed
  largest: [
    { id: 1, amountSen: 12_050, date: '2026-08-05', categoryId: 1, categoryName: 'Food' },
    { id: 3, amountSen: 800, date: '2026-08-08', categoryId: 3, categoryName: 'Transport' },
    { id: 2, amountSen: 700, date: '2026-08-10', categoryId: 1, categoryName: 'Food' },
  ],
  topCategories: [
    { categoryId: 1, categoryName: 'Food', amountSen: 12_750 },
    { categoryId: 3, categoryName: 'Transport', amountSen: 800 },
  ],
  utilization: null, // no OVERALL budget set
  projectionSen: 13_550, // past month → identity
  elapsedDays: 31,
  daysInMonth: 31,
  monthLabel: 'August 2026',
};

describe('toSpendingSnapshot', () => {
  it('maps every field onto the AI payload — the exact JSON the provider receives', () => {
    expect(toSpendingSnapshot(analyticsSnapshot)).toEqual({
      month: '2026-08',
      monthLabel: 'August 2026',
      totalSen: 13_550,
      previousTotalSen: 80_000,
      changeSen: -66_450,
      changePct: -83.1,
      avgDailySen: 437,
      projectionSen: 13_550,
      utilization: null,
      topCategories: [
        { name: 'Food', amountSen: 12_750 },
        { name: 'Transport', amountSen: 800 },
      ],
      largest: [
        { name: 'Food', amountSen: 12_050 },
        { name: 'Transport', amountSen: 800 },
        { name: 'Food', amountSen: 700 },
      ],
    });
  });

  it('maps an overall budget onto utilization, preserving overBudget', () => {
    const withBudget: AnalyticsSpendingSnapshot = {
      ...analyticsSnapshot,
      utilization: { pct: 45.2, overBudget: false },
    };
    expect(toSpendingSnapshot(withBudget).utilization).toEqual({
      pct: 45.2,
      overBudget: false,
    });

    const over: AnalyticsSpendingSnapshot = {
      ...analyticsSnapshot,
      utilization: { pct: 135.5, overBudget: true },
    };
    expect(toSpendingSnapshot(over).utilization).toEqual({
      pct: 135.5,
      overBudget: true,
    });
  });

  it('carries a null changePct through (zero baseline — "no comparison")', () => {
    const nullBaseline: AnalyticsSpendingSnapshot = {
      ...analyticsSnapshot,
      previousMonth: { month: { month: 7, year: 2026 }, totalSen: 0 },
      changeSen: 13_550,
      changePct: null,
    };
    const ai = toSpendingSnapshot(nullBaseline);
    expect(ai.previousTotalSen).toBe(0);
    expect(ai.changePct).toBeNull();
  });

  it('pads single-digit months to YYYY-MM and keeps full month labels', () => {
    const january: AnalyticsSpendingSnapshot = {
      ...analyticsSnapshot,
      month: { month: 1, year: 2026 },
      monthLabel: 'January 2026',
    };
    expect(toSpendingSnapshot(january).month).toBe('2026-01');
    expect(toSpendingSnapshot(january).monthLabel).toBe('January 2026');
  });

  it('never ships a free-text description anywhere (A6)', () => {
    expect(JSON.stringify(toSpendingSnapshot(analyticsSnapshot))).not.toContain(
      'description',
    );
  });

  it('keeps an empty month mapped (empty arrays, zero totals — not an error)', () => {
    const empty: AnalyticsSpendingSnapshot = {
      ...analyticsSnapshot,
      totalSen: 0,
      breakdown: [],
      largest: [],
      topCategories: [],
      previousMonth: { month: { month: 7, year: 2026 }, totalSen: 0 },
      changeSen: 0,
      changePct: null,
      avgDailySen: 0,
      projectionSen: 0,
    };
    expect(toSpendingSnapshot(empty)).toMatchObject({
      totalSen: 0,
      topCategories: [],
      largest: [],
      changePct: null,
    });
  });
});