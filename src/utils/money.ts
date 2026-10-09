/**
 * Money utilities (plan 004 / ARCHITECTURE §1.3, §8.1) — the sen ↔ display
 * conversion seam. Money is integer sen everywhere; these two functions are the
 * only places a decimal string or a formatted string meets a sen integer.
 *
 * - `parseMoneyToSen("120.50") → 12050`  (rejects negatives, NaN, >2 decimals)
 * - `formatSen(190000) → "RM1,900.00"`   (thousands separated, always 2 decimals)
 *
 * Rounding policy: excess decimals are REJECTED (throw), never silently rounded
 * (plan 004 §Money util). Validation lives here AND in the Zod form regex; the
 * regex prevents an invalid string ever reaching this function.
 */

/** A money input string: whole ringgit, optionally ≤2 decimal sen. */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Parse a ringgit string (up to 2 decimal places) into integer sen.
 * Throws on: negatives, >2 decimals, empty, non-numeric, `"12."`, `.`.
 * Leading/trailing whitespace is tolerated (trimmed).
 */
export function parseMoneyToSen(input: string): number {
  const s = String(input).trim();
  if (!MONEY_RE.test(s)) {
    throw new Error(`invalid money amount: ${JSON.stringify(s)}`);
  }
  const [ringgit, senPart] = s.split('.');
  const ringgitValue = Number(ringgit);
  const senValue = senPart ? Number(senPart.padEnd(2, '0')) : 0;
  return ringgitValue * 100 + senValue;
}

/**
 * Format integer sen as a display string: `"RM1,900.00"`, `"RM0.50"`.
 * Always two decimal places; negative values render as `"-RM…"` (used for
 * deficits / negative available money). Thousands separated.
 * Cent-carry: formatSen(50) → "RM0.50"; formatSen(5) → "RM0.05".
 */
export function formatSen(sen: number): string {
  const sign = sen < 0 ? '-' : '';
  const abs = Math.abs(sen);
  const ringgit = Math.floor(abs / 100);
  const rem = abs % 100;
  const ringgitStr = ringgit.toLocaleString('en-US');
  return `${sign}RM${ringgitStr}.${String(rem).padStart(2, '0')}`;
}

/**
 * Inverse of parseMoneyToSen for form prefill (edit flow): `12050 → "120.50"`.
 * Plain digits + a dot — no "RM", no thousands separators — so the value
 * round-trips through the money input regex unchanged.
 */
export function formatSenInput(sen: number): string {
  const abs = Math.abs(sen);
  const ringgit = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${ringgit}.${String(rem).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * POS-style amount entry (MoneyInput seam)
 * The amount field is entered right-to-left as sen digits — "2", "0", "0"
 * reads as RM0.02 → RM0.20 → RM2.00 — so these helpers translate between the
 * raw TextInput text and integer sen. Pure and digit-only: no floats, no
 * decimal point to mistype, no second decimal separator possible.
 * ------------------------------------------------------------------ */

/** Digit cap for the POS input: 10 digits = RM99,999,999.99. */
export const MAX_MONEY_DIGITS = 10;

/**
 * Lenient sen reading of a form money string ("", "2.00" → 0, 200). Invalid
 * input yields 0 — for UI display only; parseMoneyToSen stays the strict
 * boundary used on submit.
 */
export function senFromMoneyString(value: string): number {
  try {
    return parseMoneyToSen(value);
  } catch {
    return 0;
  }
}

/**
 * Reduce a keystroke in the amount buffer to the next sen value, POS-style.
 *
 * The buffer holds plain digits, so the whole text is simply re-read: typing
 * appends a digit and shifts everything one place left (200 + "5" → "2005" →
 * RM20.05), backspace drops the last one (RM20.05 → RM2.00). Non-digits are
 * ignored (a paste, an IME stray) and typing past MAX_MONEY_DIGITS is refused
 * rather than silently truncated.
 */
export function senFromInputText(previousSen: number, rawText: string): number {
  const digits = rawText.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digits.length > MAX_MONEY_DIGITS) {
    return previousSen;
  }
  return digits === '' ? 0 : Number(digits);
}

/* ------------------------------------------------------------------ *
 * Spoken money label (plan 016 a11y) — the screen-reader-friendly
 * reading of a sen value, e.g. formatSen(190000) = "RM1,900.00" →
 * spokenMoneyLabel(190000) = "one thousand nine hundred ringgit".
 * Consumers prefix context ("Safe to spend, …"); lowercase by design.
 * ------------------------------------------------------------------ */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

/** Words for an integer 0..999 (e.g. 123 → "one hundred and twenty-three"). */
function wordsBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) {
    const word = rest < 20 ? ONES[rest] : `${TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${ONES[rest % 10]}` : ''}`;
    if (parts.length > 0) parts.push(`and ${word}`);
    else parts.push(word);
  }
  return parts.join(' ') || 'zero';
}

/** Words for an integer 0..999,999,999 (beyond that the digits are spoken individually). */
function wordsFor(n: number): string {
  if (n >= 1_000_000_000) {
    return String(n)
      .split('')
      .map((d) => ONES[Number(d)])
      .join(' ');
  }
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  if (millions > 0) parts.push(`${wordsBelowThousand(millions)} million`);
  if (thousands > 0) parts.push(`${wordsBelowThousand(thousands)} thousand`);
  if (rest > 0) parts.push(wordsBelowThousand(rest));
  return parts.join(' ') || 'zero';
}

/**
 * Spoken reading of a sen value for accessibilityLabel, e.g.:
 *   190000   → "one thousand nine hundred ringgit"
 *   190050   → "one thousand nine hundred ringgit and fifty sen"
 *   -300000  → "minus three thousand ringgit"
 *   0        → "zero ringgit"
 * Deterministic, integer-only (money is sen everywhere — no floats, PRD §8.1).
 */
export function spokenMoneyLabel(sen: number): string {
  const abs = Math.abs(sen);
  const ringgit = Math.floor(abs / 100);
  const senPart = abs % 100;
  const sign = sen < 0 ? 'minus ' : '';
  const ringgitWords = `${wordsFor(ringgit)} ringgit`;
  const senWords = senPart > 0 ? ` and ${wordsBelowThousand(senPart)} sen` : '';
  return `${sign}${ringgitWords}${senWords}`;
}