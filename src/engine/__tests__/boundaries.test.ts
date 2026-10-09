/**
 * Plan 009 — month-boundary suite (PRD §11 test priorities). The calendar
 * seams: last day of the month, rollover (Oct 1 fresh window), leap February
 * (2028-02-29 vs non-leap 2026-02-28), and the Dec → Jan year edge. Plan 020
 * removed the allowance/safe-to-spend math; the date utilities remain. Every
 * fixture hand-computed on the local calendar (NFR-6): YYYY-MM-DD strings,
 * no Date objects, no timezone.
 */
import { describe, expect, it } from '@jest/globals';
import { daysInMonth, daysRemainingInMonthInclusive, monthEndDate } from '@/utils/dates';

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
