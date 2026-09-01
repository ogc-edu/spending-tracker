/**
 * Plan 005 — local-date utilities. The month boundary helpers feed both the
 * repository's SQL range (listForMonth) and the engine's pure matcher; the
 * date validators are shared by the form and service schemas.
 */
import { describe, expect, it } from '@jest/globals';
import {
  formatDayLabel,
  formatMonthLabel,
  isSameLocalMonth,
  isValidDateStr,
  monthEndDate,
  monthStartDate,
  nextMonthStartDate,
  periodRange,
  toLocalDateString,
  weekStartLocal,
} from '@/utils/dates';

describe('toLocalDateString', () => {
  it('formats a Date as local YYYY-MM-DD (zero-padded)', () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(toLocalDateString(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('isValidDateStr', () => {
  it('accepts real calendar days', () => {
    expect(isValidDateStr('2026-09-01')).toBe(true);
    expect(isValidDateStr('2026-09-30')).toBe(true);
    expect(isValidDateStr('2024-02-29')).toBe(true); // leap year
    expect(isValidDateStr('2026-12-31')).toBe(true);
  });

  it('rejects malformed and impossible dates', () => {
    expect(isValidDateStr('2026-13-01')).toBe(false); // month 13
    expect(isValidDateStr('2026-02-30')).toBe(false); // not a real day
    expect(isValidDateStr('2025-02-29')).toBe(false); // non-leap Feb 29
    expect(isValidDateStr('2026-9-1')).toBe(false); // not zero-padded
    expect(isValidDateStr('20260901')).toBe(false); // wrong shape
    expect(isValidDateStr('2026-09-01T00:00')).toBe(false);
  });
});

describe('month boundaries', () => {
  it('builds half-open range bounds (inclusive start, exclusive next-month first)', () => {
    expect(monthStartDate(2026, 9)).toBe('2026-09-01');
    expect(nextMonthStartDate(2026, 9)).toBe('2026-10-01');
    // December wraps into the next year
    expect(monthStartDate(2026, 12)).toBe('2026-12-01');
    expect(nextMonthStartDate(2026, 12)).toBe('2027-01-01');
    expect(nextMonthStartDate(2025, 1)).toBe('2025-02-01');
  });

  it('isSameLocalMonth matches the string prefix (no Date/tz involved)', () => {
    expect(isSameLocalMonth('2026-09-01', 9, 2026)).toBe(true);
    expect(isSameLocalMonth('2026-09-30', 9, 2026)).toBe(true);
    expect(isSameLocalMonth('2026-08-31', 9, 2026)).toBe(false);
    expect(isSameLocalMonth('2026-10-01', 9, 2026)).toBe(false);
    expect(isSameLocalMonth('2025-09-15', 9, 2026)).toBe(false);
  });
});

describe('labels', () => {
  it('renders month and day labels', () => {
    expect(formatMonthLabel(2026, 9)).toBe('September 2026');
    expect(formatMonthLabel(2026, 12)).toMatch(/2026$/);
    expect(formatDayLabel('2026-09-01')).toBe('01 Sep');
    expect(formatDayLabel('2026-12-25')).toContain('25');
  });
});

describe('monthEndDate', () => {
  it('returns the last day of the month (leap-year aware)', () => {
    expect(monthEndDate(2026, 9)).toBe('2026-09-30');
    expect(monthEndDate(2026, 2)).toBe('2026-02-28');
    expect(monthEndDate(2024, 2)).toBe('2024-02-29'); // leap year
    expect(monthEndDate(2026, 12)).toBe('2026-12-31');
    expect(monthEndDate(2026, 1)).toBe('2026-01-31');
  });
});

describe('weekStartLocal (weeks start Monday, plan 006)', () => {
  it('returns Monday for every day of the week', () => {
    // 2026-09-07 is a Monday; the week is 07..13.
    expect(weekStartLocal(new Date(2026, 8, 7))).toBe('2026-09-07'); // Monday
    expect(weekStartLocal(new Date(2026, 8, 8))).toBe('2026-09-07'); // Tuesday
    expect(weekStartLocal(new Date(2026, 8, 9))).toBe('2026-09-07'); // Wednesday
    expect(weekStartLocal(new Date(2026, 8, 13))).toBe('2026-09-07'); // Sunday
  });

  it('a Sunday walks back to the PREVIOUS week', () => {
    // 2026-09-06 is a Sunday → its Monday is 2026-08-31.
    expect(weekStartLocal(new Date(2026, 8, 6))).toBe('2026-08-31');
  });

  it('ignores time-of-day (normalized to local midnight)', () => {
    expect(weekStartLocal(new Date(2026, 8, 9, 23, 59))).toBe('2026-09-07');
  });
});

describe('periodRange (plan 006 presets)', () => {
  const now = new Date(2026, 8, 9); // Wednesday 2026-09-09

  it('resolves each preset to inclusive from/to bounds', () => {
    expect(periodRange('today', now)).toEqual({ from: '2026-09-09', to: '2026-09-09' });
    expect(periodRange('thisWeek', now)).toEqual({ from: '2026-09-07', to: '2026-09-09' });
    expect(periodRange('thisMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('lastMonth', now)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(periodRange('all', now)).toEqual({});
  });

  it('lastMonth wraps December to the previous year', () => {
    expect(periodRange('lastMonth', new Date(2026, 0, 15))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(periodRange('lastMonth', new Date(2024, 2, 1))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('thisMonth covers the whole calendar month, not just till today', () => {
    expect(periodRange('thisMonth', new Date(2026, 8, 1))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('thisMonth', new Date(2026, 8, 30))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
});