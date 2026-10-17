/**
 * Pure spending series engine (plan 020 Phase C, ARCH §6).
 *
 * Invariants:
 * - Pure: NO Date.now(), NO I/O, no DB imports. endDate is always passed in.
 * - Money is integer sen everywhere.
 * - Dates are YYYY-MM-DD local strings.
 * - Granularities: Day (30 days default), Week (12 weeks, Monday start), Month (12 months).
 * - Zero-filled for all periods in the requested window.
 */
import { formatDayLabel, isSameLocalMonth } from '@/utils/dates';
import { formatSen } from '@/utils/money';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export type SeriesGranularity = 'day' | 'week' | 'month';

export interface SpendingSeriesOptions {
  granularity: SeriesGranularity;
  /** YYYY-MM-DD */
  endDate: string;
  count?: number;
  categoryId?: number;
}

export interface SpendingSeriesItem {
  periodStart: string; // YYYY-MM-DD
  label: string;
  totalSen: number;
  a11yLabel: string;
}

export interface SpendingSeriesResult {
  series: SpendingSeriesItem[];
  highestIndex: number;
  windowTotal: number;
  averagePerPeriod: number;
}

export interface SeriesExpenseLike {
  id?: number;
  amountSen: number;
  date: string;
  categoryId: number;
}

/** Pure UTC day arithmetic to prevent timezone drift. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y == null || m == null || d == null) {
    throw new Error(`invalid date: ${dateStr}`);
  }
  const date = new Date(Date.UTC(y, m - 1, d + days));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Get the Monday of the week containing the date (Monday-start). */
function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y == null || m == null || d == null) {
    throw new Error(`invalid date: ${dateStr}`);
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const diff = dow === 0 ? 6 : dow - 1;
  return addDays(dateStr, -diff);
}

/** Shift year and month by delta months. */
function monthShift(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

/**
 * spendingSeries(expenses, { granularity, endDate, count, categoryId? })
 * Returns series of { periodStart, label, totalSen, a11yLabel }, highestIndex, windowTotal, averagePerPeriod.
 */
export function spendingSeries(
  expenses: SeriesExpenseLike[],
  options: SpendingSeriesOptions,
): SpendingSeriesResult {
  const { granularity, endDate, categoryId } = options;

  const relevantExpenses =
    categoryId != null
      ? expenses.filter((e) => e.categoryId === categoryId)
      : expenses;

  let count: number;
  if (options.count != null && options.count > 0) {
    count = options.count;
  } else {
    count = granularity === 'day' ? 30 : 12;
  }

  const series: SpendingSeriesItem[] = [];

  if (granularity === 'day') {
    // count consecutive days ending at endDate
    for (let i = 0; i < count; i++) {
      const offset = -(count - 1 - i);
      const dayDate = addDays(endDate, offset);
      const dayTotalSen = relevantExpenses
        .filter((e) => {
          const d = e.date.includes('T') ? e.date.split('T')[0] : e.date;
          return d === dayDate;
        })
        .reduce((sum, e) => sum + e.amountSen, 0);

      const dayNum = String(Number(dayDate.split('-')[2]));
      series.push({
        periodStart: dayDate,
        label: dayNum,
        totalSen: dayTotalSen,
        a11yLabel: `${formatDayLabel(dayDate)}, ${formatSen(dayTotalSen)}`,
      });
    }
  } else if (granularity === 'week') {
    // count consecutive weeks, Monday-start, ending at week containing endDate
    const lastMonday = getMonday(endDate);
    for (let i = 0; i < count; i++) {
      const offsetWeeks = -(count - 1 - i);
      const monday = addDays(lastMonday, offsetWeeks * 7);
      const sunday = addDays(monday, 6);

      const weekTotalSen = relevantExpenses
        .filter((e) => {
          const d = e.date.includes('T') ? (e.date.split('T')[0] as string) : e.date;
          return d >= monday && d <= sunday;
        })
        .reduce((sum, e) => sum + e.amountSen, 0);

      const label = formatDayLabel(monday);
      series.push({
        periodStart: monday,
        label,
        totalSen: weekTotalSen,
        a11yLabel: `Week of ${label}, ${formatSen(weekTotalSen)}`,
      });
    }
  } else {
    // month: count consecutive calendar months ending at month of endDate
    const [ey, em] = endDate.split('-').map(Number);
    if (ey == null || em == null) {
      throw new Error(`invalid end date: ${endDate}`);
    }

    for (let i = 0; i < count; i++) {
      const offsetMonths = -(count - 1 - i);
      const { year, month } = monthShift(ey, em, offsetMonths);
      const monthStart = `${year}-${pad2(month)}-01`;

      const monthTotalSen = relevantExpenses
        .filter((e) => {
          const d = e.date.includes('T') ? (e.date.split('T')[0] as string) : e.date;
          return isSameLocalMonth(d, month, year);
        })
        .reduce((sum, e) => sum + e.amountSen, 0);

      const monthName = FULL_MONTH_NAMES[month - 1] ?? `Month ${month}`;
      const shortName = SHORT_MONTHS[month - 1] ?? `M${month}`;

      series.push({
        periodStart: monthStart,
        label: shortName,
        totalSen: monthTotalSen,
        a11yLabel: `${monthName} ${year}, ${formatSen(monthTotalSen)}`,
      });
    }
  }

  const windowTotal = series.reduce((sum, item) => sum + item.totalSen, 0);
  const averagePerPeriod = count > 0 ? Math.floor(windowTotal / count) : 0;

  // Highest index: find highest bar. If all are 0, index 0 (or first)
  let highestIndex = 0;
  let maxTotalSen = series[0]?.totalSen ?? 0;
  for (let i = 1; i < series.length; i++) {
    const item = series[i];
    if (item && item.totalSen > maxTotalSen) {
      maxTotalSen = item.totalSen;
      highestIndex = i;
    }
  }

  return {
    series,
    highestIndex,
    windowTotal,
    averagePerPeriod,
  };
}
