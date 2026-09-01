/**
 * Local-date utilities (plan 005 / ARCHITECTURE §2 utils) — the seam where
 * a calendar day becomes a `YYYY-MM-DD` string and back.
 *
 * `expenses.date` is TEXT `YYYY-MM-DD` in the DEVICE-LOCAL calendar (never
 * UTC — `toISOString()` would shift dates for +08 users after midnight).
 * Month boundaries are derived here and shared by the repository's SQL range
 * (listForMonth) and the engine's pure month matcher (totals).
 */

/** Strict `YYYY-MM-DD` shape (zero-padded). Use isValidDateStr for real dates. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Format a Date as a local `YYYY-MM-DD` string. Defaults to now.
 * Uses getFullYear/getMonth/getDate (local), never toISOString (UTC).
 */
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today, device-local, as `YYYY-MM-DD` — the expense form's default date. */
export function todayLocal(): string {
  return toLocalDateString(new Date());
}

/** True when the string is `YYYY-MM-DD` AND a real calendar day (rejects 2026-02-30, 2026-13-01). */
export function isValidDateStr(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}

/**
 * Pure month matcher used by the engine: does a `YYYY-MM-DD` string fall in
 * the given local calendar month? (String prefix compare — no Date involved,
 * so the engine stays deterministic and timezone-free.)
 */
export function isSameLocalMonth(dateStr: string, month: number, year: number): boolean {
  return dateStr.slice(0, 7) === `${year}-${pad2(month)}`;
}

/** First day of a year-month as `YYYY-MM-01` (inclusive lower bound for SQL ranges). */
export function monthStartDate(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

/** First day of the FOLLOWING month (exclusive upper bound: `date < next`). Wraps December. */
export function nextMonthStartDate(year: number, month: number): string {
  return month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
}

/** "September 2026" — month header for the expenses list. */
export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** "01 Sep" — compact date for expense list rows (deterministic, no locale dependence). */
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDayLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${String(day).padStart(2, '0')} ${SHORT_MONTHS[month - 1] ?? ''}`.trim();
}