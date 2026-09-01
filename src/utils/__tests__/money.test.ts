/**
 * Plan 004 — money util matrix (parseMoneyToSen / formatSen).
 * Valid, 2-decimal edge, invalid inputs, large values, display formatting.
 */
import { describe, expect, it } from '@jest/globals';
import { formatSen, parseMoneyToSen } from '../money';

describe('parseMoneyToSen', () => {
  it('parses whole ringgit', () => {
    expect(parseMoneyToSen('0')).toBe(0);
    expect(parseMoneyToSen('1')).toBe(100);
    expect(parseMoneyToSen('1900')).toBe(190000);
  });

  it('parses two-decimal ringgit (plan: "120.50" → 12050)', () => {
    expect(parseMoneyToSen('120.50')).toBe(12050);
    expect(parseMoneyToSen('120.5')).toBe(12050); // trailing zero implied
    expect(parseMoneyToSen('0.50')).toBe(50);
    expect(parseMoneyToSen('0.05')).toBe(5);
    expect(parseMoneyToSen('1.00')).toBe(100);
    expect(parseMoneyToSen('1200.99')).toBe(120099);
  });

  it('tolerates leading/trailing whitespace (trimmed)', () => {
    expect(parseMoneyToSen('  120.50  ')).toBe(12050);
  });

  it('rejects more than 2 decimals (never silently rounds)', () => {
    expect(() => parseMoneyToSen('12.345')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('1.999')).toThrow(/invalid money/);
  });

  it('rejects malformed decimal forms', () => {
    expect(() => parseMoneyToSen('12.')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('.')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('1.2.3')).toThrow(/invalid money/);
  });

  it('rejects negatives', () => {
    expect(() => parseMoneyToSen('-5')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('-0.50')).toThrow(/invalid money/);
  });

  it('rejects non-numeric, empty, and NaN inputs', () => {
    expect(() => parseMoneyToSen('')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('abc')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('NaN')).toThrow(/invalid money/);
    expect(() => parseMoneyToSen('1,900')).toThrow(/invalid money/); // no commas on input
  });

  it('handles large balances (recommended < 9e15 sen)', () => {
    expect(parseMoneyToSen('9999999999999.99')).toBe(999999999999999); // ~1e15 sen
  });
});

describe('formatSen', () => {
  it('formats zero and small cent values', () => {
    expect(formatSen(0)).toBe('RM0.00');
    expect(formatSen(50)).toBe('RM0.50');
    expect(formatSen(5)).toBe('RM0.05');
  });

  it('formats whole ringgit with thousands separators and 2 decimals', () => {
    expect(formatSen(190000)).toBe('RM1,900.00');
    expect(formatSen(100)).toBe('RM1.00');
    expect(formatSen(1000000)).toBe('RM10,000.00');
    expect(formatSen(1900050)).toBe('RM19,000.50');
  });

  it('formats negative values (deficit/negative available)', () => {
    expect(formatSen(-12345)).toBe('-RM123.45');
    expect(formatSen(-50)).toBe('-RM0.50');
  });

  it('round-trips a parse', () => {
    expect(formatSen(parseMoneyToSen('120.50'))).toBe('RM120.50');
    expect(formatSen(parseMoneyToSen('0.05'))).toBe('RM0.05');
  });
});