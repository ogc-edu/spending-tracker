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

/**
 * "01-09-2026" — DAY-MONTH-YEAR display for the calendar date fields
 * (user-facing format, plan 016 follow-up). Storage stays `YYYY-MM-DD`
 * (the engine/DB contract); this is display-only. Returns the input
 * unchanged when it isn't a valid date string.
 */
export function formatDDMMYYYY(dateStr: string): string {
  if (!DATE_RE.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

/**
 * ── Plan 008: pure calendar math for commitment schedules (ARCH §7) ──
 *
 * These three helpers use INTEGER arithmetic only — no Date objects, no
 * timezone, no `new Date()` — so the financial engine can derive schedules
 * deterministically (a Date-based implementation would make the engine
 * timezone-dependent, violating ARCH §6). Inputs/outputs are `YYYY-MM-DD`.
 */

/** True for leap years (divisible by 4, except centuries not divisible by 400). */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Number of days in a year-month (1–12), leap-aware. */
export function daysInMonth(year: number, month: number): number {
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  if (month === 2 && isLeapYear(year)) return 29;
  return DAYS[month - 1] ?? 31;
}

/**
 * Add `months` to a `YYYY-MM-DD` date, CLAMPING the day to the target month's
 * last valid day (Jan 31 → Feb 28 / Feb 29 on leap years — ARCH §7). The
 * anchor day is preserved wherever the target month has it. `months` may be
 * negative (subtract). Throws on malformed input.
 */
export function addMonthsClamped(dateStr: string, months: number): string {
  if (!isValidDateStr(dateStr)) throw new Error(`invalid date: ${JSON.stringify(dateStr)}`);
  const [year, month, day] = dateStr.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad2(targetMonth)}-${pad2(clampedDay)}`;
}

/**
 * Whole months from `startDate` to `endDate` INCLUSIVE — the installment
 * count when a fixed commitment's end_date bounds the series (ARCH §7):
 * Jan 15 → Mar 10 is 3 (Jan, Feb, Mar). Throws when endDate < startDate.
 * Day-of-month differences are ignored (the count is month-anchored).
 */
export function monthsBetweenInclusive(startDate: string, endDate: string): number {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) {
    throw new Error('invalid date');
  }
  const [sy, sm] = startDate.split('-').map(Number);
  const [ey, em] = endDate.split('-').map(Number);
  const months = ey * 12 + (em - 1) - (sy * 12 + (sm - 1)) + 1;
  if (months < 1) throw new Error('end date must not be before start date');
  return months;
}

/**
 * ── Plan 009: engine allowance math (ARCH §6 / PRD §8.4) ──
 *
 * Pure local-calendar arithmetic on `YYYY-MM-DD` strings — no Date, no
 * timezone, no clock — so the financial engine stays deterministic.
 *
 * Calendar days from `today` INCLUSIVE through `monthEnd` INCLUSIVE
 * (PRD §8.4: the daily-allowance denominator, "incl. today"). Only defined
 * for a `today` inside the month that `monthEnd` closes; any other input
 * (different year-month, malformed string, past month-end) yields 0 — the
 * engine's "no days left" reading (a stale caller gets a 0 allowance, never
 * NaN). Last day of the month → 1 (the full remaining safe is allowed).
 */
export function daysRemainingInMonthInclusive(today: string, monthEnd: string): number {
  if (!DATE_RE.test(today) || !DATE_RE.test(monthEnd)) return 0;
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  const [endYear, endMonth, endDay] = monthEnd.split('-').map(Number);
  if (todayYear !== endYear || todayMonth !== endMonth) return 0;
  const days = endDay - todayDay + 1;
  return days > 0 ? days : 0;
}