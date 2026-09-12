/**
 * Plan 004 — money util matrix (parseMoneyToSen / formatSen).
 * Valid, 2-decimal edge, invalid inputs, large values, display formatting.
 */
import { describe, expect, it } from '@jest/globals';
import {
  MAX_MONEY_DIGITS,
  formatSen,
  parseMoneyToSen,
  senFromInputText,
  senFromMoneyString,
  spokenMoneyLabel,
} from '../money';

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

/**
 * Plan 016 — spoken screen-reader labels for money figures. The fixture:
 * formatSen(190000) = "RM1,900.00" → "one thousand nine hundred ringgit"
 * (PRD §8.5's safe-to-spend example reads exactly this way for TalkBack).
 */
describe('spokenMoneyLabel (plan 016 a11y)', () => {
  it("reads the plan's fixture (190000 → one thousand nine hundred ringgit)", () => {
    expect(spokenMoneyLabel(190000)).toBe('one thousand nine hundred ringgit');
  });

  it('includes a sen part when present', () => {
    expect(spokenMoneyLabel(190050)).toBe('one thousand nine hundred ringgit and fifty sen');
    expect(spokenMoneyLabel(5)).toBe('zero ringgit and five sen');
  });

  it('handles zero, small values, and negatives', () => {
    expect(spokenMoneyLabel(0)).toBe('zero ringgit');
    expect(spokenMoneyLabel(100)).toBe('one ringgit');
    expect(spokenMoneyLabel(-300000)).toBe('minus three thousand ringgit');
    expect(spokenMoneyLabel(-50)).toBe('minus zero ringgit and fifty sen');
  });

  it('speaks hundreds and composites', () => {
    expect(spokenMoneyLabel(12300)).toBe('one hundred and twenty-three ringgit');
    expect(spokenMoneyLabel(1000000)).toBe('ten thousand ringgit');
    expect(spokenMoneyLabel(91234500)).toBe('nine hundred and twelve thousand three hundred and forty-five ringgit');
  });
});

/**
 * POS-style entry reducer (MoneyInput): the whole field is re-read as sen
 * digits, so a keypress shifts the number one place left and a backspace one
 * place right. Pure — the component only formats what comes out of here.
 */
describe('senFromInputText (POS amount entry)', () => {
  it('appends a digit from the sen place: 2, 0, 0 → 2 → 20 → 200 sen', () => {
    expect(senFromInputText(0, '02')).toBe(2);
    expect(senFromInputText(2, '20')).toBe(20);
    expect(senFromInputText(20, '200')).toBe(200);
  });

  it('backspace (one digit shorter) drops the last digit', () => {
    expect(senFromInputText(2500, '250')).toBe(250);
    expect(senFromInputText(250, '25')).toBe(25);
    expect(senFromInputText(25, '2')).toBe(2);
    expect(senFromInputText(2, '')).toBe(0);
    expect(senFromInputText(0, '')).toBe(0); // already empty — stays 0
  });

  it('ignores every non-digit — no sign, no decimal point is reachable', () => {
    expect(senFromInputText(0, '-1.2.3abc')).toBe(123);
    expect(senFromInputText(0, '')).toBe(0);
  });

  it('strips leading zeros instead of filling the cap with them', () => {
    expect(senFromInputText(0, '0000000000005')).toBe(5);
  });

  it(`rejects growth past ${MAX_MONEY_DIGITS} digits (keeps the previous value)`, () => {
    const capped = 9_999_999_999; // RM99,999,999.99
    expect(senFromInputText(capped, `${capped}9`)).toBe(capped);
    expect(senFromInputText(999_999_999, '9999999999')).toBe(9_999_999_999);
  });
});

describe('senFromMoneyString (lenient UI reading)', () => {
  it('parses canonical form strings and treats anything else as 0', () => {
    expect(senFromMoneyString('120.50')).toBe(12050);
    expect(senFromMoneyString('0.00')).toBe(0);
    expect(senFromMoneyString('')).toBe(0);
    expect(senFromMoneyString('RM12')).toBe(0);
  });

  it('round-trips with formatSen for display', () => {
    expect(formatSen(senFromMoneyString('1000.00'))).toBe('RM1,000.00');
  });
});
