/**
 * Plan 009 — month-boundary suite (PRD §11 test priorities). The calendar
 * seams: last day of the month (Sept 30 → 1-day allowance), rollover (Oct 1
 * fresh window, previous month's window fully isolated), leap February
 * (2028-02-29 vs non-leap 2026-02-28), and the Dec → Jan year edge. Every
 * fixture hand-computed on the local calendar (NFR-6): YYYY-MM-DD strings,
 * no Date objects, no timezone.
 */
import { describe, expect, it } from '@jest/globals';
import { cashFlowBreakdown, dailyAllowance, safeToSpend } from '@/engine/cashflow';
import { daysInMonth, daysRemainingInMonthInclusive, monthEndDate } from '@/utils/dates';

/** PRD §8.5 example inputs — the engine's inputs are month-resolved numbers, so the
 *  same inputs are valid in any month window (rollover isolation lives in the window). */
const PRD_INPUT = {
  availableSen: 300000,
  upcomingSen: 80000,
  remainingBudgetSen: 184000,
  bufferSen: 30000,
};

describe('daysRemainingInMonthInclusive — today through month-end, both inclusive', () => {
  it('September (30-day month): 1st → 30 days, 15th → 16, 30th → 1', () => {
    expect(daysRemainingInMonthInclusive('2026-09-01', '2026-09-30')).toBe(30);
    expect(daysRemainingInMonthInclusive('2026-09-15', '2026-09-30')).toBe(16);
    expect(daysRemainingInMonthInclusive('2026-09-30', '2026-09-30')).toBe(1);
  });

  it('rollover: Oct 1 opens a fresh 31-day window; September\'s window is gone', () => {
    expect(daysRemainingInMonthInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysRemainingInMonthInclusive('2026-10-05', '2026-10-31')).toBe(27);
  });

  it('leap February 2028 = 29 days; non-leap 2026 = 28; Feb 29 → 1 day', () => {
    expect(daysRemainingInMonthInclusive('2028-02-01', '2028-02-29')).toBe(29);
    expect(daysRemainingInMonthInclusive('2028-02-29', '2028-02-29')).toBe(1);
    expect(daysRemainingInMonthInclusive('2026-02-01', '2026-02-28')).toBe(28);
  });

  it('year edge: December stays in December, January wraps to a new year', () => {
    expect(daysRemainingInMonthInclusive('2026-12-01', '2026-12-31')).toBe(31);
    expect(daysRemainingInMonthInclusive('2026-12-31', '2026-12-31')).toBe(1);
    expect(daysRemainingInMonthInclusive('2027-01-01', '2027-01-31')).toBe(31);
  });

  it('out-of-window inputs → 0 (stale today, cross-month, malformed — never NaN)', () => {
    expect(daysRemainingInMonthInclusive('2026-10-01', '2026-09-30')).toBe(0); // today past monthEnd
    expect(daysRemainingInMonthInclusive('2026-09-30', '2026-10-31')).toBe(0); // different month
    expect(daysRemainingInMonthInclusive('2026-13-01', '2026-09-30')).toBe(0); // malformed today
    expect(daysRemainingInMonthInclusive('2026-09-30', '2026-9-30')).toBe(0); // non-padded monthEnd
  });
});

describe('monthEndDate / daysInMonth coherence (leap-aware local calendar)', () => {
  it('monthEndDate matches daysInMonth for the same year-month', () => {
    expect(monthEndDate(2026, 9)).toBe('2026-09-30');
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(monthEndDate(2028, 2)).toBe('2028-02-29');
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(monthEndDate(2026, 2)).toBe('2026-02-28');
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(monthEndDate(2026, 12)).toBe('2026-12-31');
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(monthEndDate(2027, 1)).toBe('2027-01-31');
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('dailyAllowance across boundaries (PRD §11)', () => {
  it('Sept 30 → 1-day allowance: the ENTIRE safe is allowed that day', () => {
    expect(dailyAllowance(6000, '2026-09-30', '2026-09-30')).toBe(6000);
  });

  it('Sept 1 → floor(6000/30) = 200 sen/day (the PRD 30-day example)', () => {
    expect(dailyAllowance(6000, '2026-09-01', '2026-09-30')).toBe(200);
  });

  it('Oct 1 rollover → floor(6000/31) = 193 sen/day in a fresh 31-day window', () => {
    expect(dailyAllowance(6000, '2026-10-01', '2026-10-31')).toBe(193);
  });

  it('leap February: 29-day window vs 28-day window', () => {
    expect(dailyAllowance(2900, '2028-02-01', '2028-02-29')).toBe(100); // 2900/29 exact
    expect(dailyAllowance(2900, '2028-02-29', '2028-02-29')).toBe(2900); // last day → all of it
    expect(dailyAllowance(2900, '2026-02-01', '2026-02-28')).toBe(103); // 103.57 → 103
  });

  it('Dec 31 keeps the ENTIRE safe in one day; Jan 1 starts a fresh 31-day year', () => {
    expect(dailyAllowance(90000, '2026-12-31', '2026-12-31')).toBe(90000);
    expect(dailyAllowance(310000, '2027-01-01', '2027-01-31')).toBe(10000); // 310000/31 exact
  });

  it('rounding fixture across a 31-day window: floor(1900000/31) = 61290', () => {
    expect(dailyAllowance(1900000, '2026-10-01', '2026-10-31')).toBe(61290); // 61290.32… → 61290
  });
});

describe('rollover isolation — the formula never leaks the previous month', () => {
  it('safeToSpend is month-pure: identical inputs, any window context, identical safe', () => {
    // The engine receives month-resolved numbers; Sept vs Oct windows change only
    // the denominator (covered above) — safe itself must be window-independent.
    expect(safeToSpend(PRD_INPUT).safeSen).toBe(6000);
    // (sanity: the two window ends used above really are different months)
    expect(monthEndDate(2026, 9)).not.toBe(monthEndDate(2026, 10));
  });

  it('breakdown Σ matches safe inside a rollover window', () => {
    const items = cashFlowBreakdown(PRD_INPUT);
    expect(items.reduce((s, i) => s + i.amountSen, 0)).toBe(safeToSpend(PRD_INPUT).safeSen);
  });
});