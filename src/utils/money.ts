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