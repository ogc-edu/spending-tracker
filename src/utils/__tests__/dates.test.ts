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
  monthStartDate,
  nextMonthStartDate,
  toLocalDateString,
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