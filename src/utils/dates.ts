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

/** Last day of a year-month as `YYYY-MM-DD` (inclusive upper bound for SQL ranges). */
export function monthEndDate(year: number, month: number): string {
  // Day 0 of the FOLLOWING month = last day of this month (Date handles leap years).
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(lastDay)}`;
}

/**
 * Monday of the week containing the given local date (plan 006: weeks start
 * Monday). Sunday (getDay() === 0) walks back 6 days; Mon–Sat walk back dow−1.
 * The Date is normalized to local midnight first so time-of-day can't shift
 * the result across days.
 */
export function weekStartLocal(date: Date = new Date()): string {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = local.getDay() === 0 ? 6 : local.getDay() - 1;
  local.setDate(local.getDate() - daysSinceMonday);
  return toLocalDateString(local);
}

/** Period presets for the expense-history filter bar (plan 006 §UI). `custom` is a from/to pair. */
export const PERIOD_PRESETS = ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'all', 'custom'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

/**
 * Resolve a period preset to INCLUSIVE `{ from, to }` local-date bounds.
 * `all` → no bounds (no date predicate). `custom` is NOT resolvable here —
 * the picker supplies explicit from/to. Deterministic for a fixed `now`.
 * - today:      from = to = today
 * - thisWeek:   Monday of this week → today (plan: weeks start Monday)
 * - thisMonth:  1st → last day of the month (matches the dashboard view)
 * - lastMonth:  previous calendar month, 1st → last day
 */
export function periodRange(
  preset: Exclude<PeriodPreset, 'custom'>,
  now: Date = new Date(),
): { from?: string; to?: string } {
  switch (preset) {
    case 'today': {
      const day = toLocalDateString(now);
      return { from: day, to: day };
    }
    case 'thisWeek': {
      return { from: weekStartLocal(now), to: toLocalDateString(now) };
    }
    case 'thisMonth': {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      return { from: monthStartDate(year, month), to: monthEndDate(year, month) };
    }
    case 'lastMonth': {
      const month = now.getMonth(); // 0-based; 0 = December of the previous year
      const year = month === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const lastMonth = month === 0 ? 12 : month;
      return { from: monthStartDate(year, lastMonth), to: monthEndDate(year, lastMonth) };
    }
    case 'all':
      return {};
  }
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