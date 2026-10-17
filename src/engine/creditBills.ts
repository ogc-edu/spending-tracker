/**
 * Pure credit bills engine (plan 020 Phase B, ARCH §6).
 *
 * Invariants:
 * - Pure: NO Date.now(), NO I/O, no DB imports. referenceDate and dates are always passed in.
 * - Money is integer sen everywhere.
 * - Dates are YYYY-MM-DD local strings.
 * - Bills are derived on the fly, never stored.
 */
import { daysInMonth } from '@/utils/dates';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const MONTH_NAMES = [
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

/** Bill status: 'open' (today <= close date), 'unpaid' (closed, outstanding > 0), 'paid'. */
export type CreditBillStatus = 'open' | 'unpaid' | 'paid';

export interface InstallmentPart {
  partIndex: number;
  principalSen: number;
  interestSen: number;
  totalSen: number;
}

export interface InstallmentSplit {
  parts: InstallmentPart[];
  totalPayableSen: number;
  totalInterestSen: number;
  monthlyPaymentSen: number;
  lastPaymentSen: number;
}

export interface CreditAccountLike {
  id: number;
  statementDay: number | null;
  dueDay: number | null;
  openingOwedSen: number;
  createdAt?: number | string;
}

export interface CreditExpenseLike {
  id: number;
  amountSen: number;
  date: string;
  accountId?: number | null;
  installment?: {
    months: number;
    monthlyRateBp: number;
    principalSen: number;
  } | null;
}

export interface CreditPaymentLike {
  id: string;
  accountId: number | string;
  billYear: number;
  billMonth: number;
  amountSen: number;
  paidDate: string;
}

export interface CreditBill {
  accountId: number;
  year: number;
  month: number;
  label: string;
  monthLabel: string;
  startDate: string;
  closeDate: string;
  dueDate: string;
  amountSen: number;
  originalAmountSen: number;
  paidSen: number;
  outstandingSen: number;
  carryOverInSen: number;
  carryOverOutSen: number;
  status: CreditBillStatus;
  chargesCount: number;
}

export interface DeriveCreditBillsOptions {
  account: CreditAccountLike;
  expenses: CreditExpenseLike[];
  payments: CreditPaymentLike[];
  referenceDate: string;
}

/** Human label for a bill, e.g. "October bill". */
export function formatBillLabel(month: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Month ${month}`;
  return `${name} bill`;
}

/** Name of the month, e.g. "October". */
export function formatMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`;
}

/** Shift year/month by delta months. */
export function monthShift(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

/**
 * Cycle closing date for a given (year, month).
 * Statement day is clamped to the month's maximum length.
 */
export function billCloseDate(year: number, month: number, statementDay: number): string {
  const clampedDay = Math.min(statementDay, daysInMonth(year, month));
  return `${year}-${pad2(month)}-${pad2(clampedDay)}`;
}

/**
 * Cycle starting date for a given (year, month).
 * The cycle begins the day after the previous month's statement close date.
 */
export function billStartDate(year: number, month: number, statementDay: number): string {
  const prev = monthShift(year, month, -1);
  const prevCloseDay = Math.min(statementDay, daysInMonth(prev.year, prev.month));
  if (prevCloseDay < daysInMonth(prev.year, prev.month)) {
    return `${prev.year}-${pad2(prev.month)}-${pad2(prevCloseDay + 1)}`;
  }
  return `${year}-${pad2(month)}-01`;
}

/**
 * Due date for a bill (year, month).
 * If due_day > statement_day: due in the closing month;
 * otherwise: due in the following month (M+1).
 * Clamped to target month length.
 */
export function billDueDate(year: number, month: number, statementDay: number, dueDay: number): string {
  const target = dueDay > statementDay ? { year, month } : monthShift(year, month, 1);
  const clampedDueDay = Math.min(dueDay, daysInMonth(target.year, target.month));
  return `${target.year}-${pad2(target.month)}-${pad2(clampedDueDay)}`;
}

/**
 * Which bill cycle contains a given purchase date YYYY-MM-DD.
 * If day <= statementDay of this month: lands in this month's bill.
 * If day > statementDay of this month: lands in next month's bill.
 */
export function billCycleForDate(dateStr: string, statementDay: number): { year: number; month: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y == null || m == null || d == null) {
    throw new Error(`invalid date: ${dateStr}`);
  }
  const clampedDay = Math.min(statementDay, daysInMonth(y, m));
  if (d <= clampedDay) {
    return { year: y, month: m };
  }
  return monthShift(y, m, 1);
}

/**
 * Calculate instalment parts:
 * floor(principal / N) per part, last part absorbs principal remainder;
 * plus floor(principal * monthly_rate_bp / 10000) interest per part.
 */
export function splitInstallment(
  principalSen: number,
  months: number,
  monthlyRateBp: number,
): InstallmentSplit {
  if (months <= 0) throw new Error('months must be >= 1');
  if (principalSen < 0) throw new Error('principal cannot be negative');

  const basePrincipal = Math.floor(principalSen / months);
  const remainder = principalSen - basePrincipal * months;
  const interestPerPart = Math.floor((principalSen * monthlyRateBp) / 10000);

  const parts: InstallmentPart[] = [];
  for (let k = 0; k < months; k++) {
    const principalPart = k === months - 1 ? basePrincipal + remainder : basePrincipal;
    parts.push({
      partIndex: k,
      principalSen: principalPart,
      interestSen: interestPerPart,
      totalSen: principalPart + interestPerPart,
    });
  }

  const totalInterestSen = interestPerPart * months;
  const totalPayableSen = principalSen + totalInterestSen;
  const monthlyPaymentSen = parts[0]?.totalSen ?? 0;
  const lastPaymentSen = parts[parts.length - 1]?.totalSen ?? 0;

  return {
    parts,
    totalPayableSen,
    totalInterestSen,
    monthlyPaymentSen,
    lastPaymentSen,
  };
}

/** Compare two (year, month) pairs. */
function compareYearMonth(a: { year: number; month: number }, b: { year: number; month: number }): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

/** Format YYYY-MM-DD from number timestamp or string date. */
function normalizeDateStr(value: number | string | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (value.includes('T')) return value.split('T')[0] ?? null;
    return value;
  }
  const d = new Date(value);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Derive all credit bills for an account.
 * Accounts without billing cycle (statementDay == null || dueDay == null) return [].
 */
export function deriveCreditBills(options: DeriveCreditBillsOptions): CreditBill[] {
  const { account, expenses, payments, referenceDate } = options;
  if (account.statementDay == null || account.dueDay == null) {
    return [];
  }

  const statementDay = account.statementDay;
  const dueDay = account.dueDay;

  // 1. Gather all activity mapped by (year, month) key
  const chargesByCycle = new Map<string, { totalSen: number; count: number }>();

  function addCharge(year: number, month: number, amountSen: number): void {
    if (amountSen === 0) return;
    const key = `${year}-${pad2(month)}`;
    const current = chargesByCycle.get(key) ?? { totalSen: 0, count: 0 };
    chargesByCycle.set(key, {
      totalSen: current.totalSen + amountSen,
      count: current.count + 1,
    });
  }

  // Opening owed balance: assigned to cycle of account creation
  if (account.openingOwedSen > 0) {
    const createdDate = normalizeDateStr(account.createdAt) ?? referenceDate;
    const openingCycle = billCycleForDate(createdDate, statementDay);
    addCharge(openingCycle.year, openingCycle.month, account.openingOwedSen);
  }

  // Expenses & instalments
  for (const exp of expenses) {
    const expDate = exp.date.includes('T') ? (exp.date.split('T')[0] as string) : exp.date;
    const startCycle = billCycleForDate(expDate, statementDay);

    if (exp.installment && exp.installment.months > 1) {
      const split = splitInstallment(
        exp.installment.principalSen,
        exp.installment.months,
        exp.installment.monthlyRateBp,
      );
      for (const part of split.parts) {
        const cycle = monthShift(startCycle.year, startCycle.month, part.partIndex);
        addCharge(cycle.year, cycle.month, part.totalSen);
      }
    } else {
      addCharge(startCycle.year, startCycle.month, exp.amountSen);
    }
  }

  // 2. Identify the cycle range: [minCycle, maxCycle]
  const refCycle = billCycleForDate(referenceDate, statementDay);
  let minCycle = { ...refCycle };
  let maxCycle = { ...refCycle };

  function expandRange(c: { year: number; month: number }) {
    if (compareYearMonth(c, minCycle) < 0) minCycle = { ...c };
    if (compareYearMonth(c, maxCycle) > 0) maxCycle = { ...c };
  }

  for (const key of chargesByCycle.keys()) {
    const [y, m] = key.split('-').map(Number);
    if (y != null && m != null) expandRange({ year: y, month: m });
  }

  for (const payment of payments) {
    expandRange({ year: payment.billYear, month: payment.billMonth });
  }

  // 3. Process every cycle from minCycle to maxCycle in chronological order
  const bills: CreditBill[] = [];
  let currentCycle = { ...minCycle };
  let carryOverSen = 0;

  while (compareYearMonth(currentCycle, maxCycle) <= 0) {
    const y = currentCycle.year;
    const m = currentCycle.month;
    const key = `${y}-${pad2(m)}`;

    const charges = chargesByCycle.get(key) ?? { totalSen: 0, count: 0 };
    const originalAmountSen = charges.totalSen;

    // Apply overpayment carried forward from previous cycle
    const carryOverInSen = carryOverSen;
    const effectiveAmountSen = Math.max(0, originalAmountSen - carryOverInSen);
    const absorbedCarryOver = originalAmountSen - effectiveAmountSen;
    const remainingCarryOver = carryOverInSen - absorbedCarryOver;

    // Sum payments for this cycle
    const cyclePayments = payments.filter((p) => p.billYear === y && p.billMonth === m);
    const paidSen = cyclePayments.reduce((sum, p) => sum + p.amountSen, 0);

    let outstandingSen = 0;
    let carryOverOutSen = 0;

    if (paidSen > effectiveAmountSen) {
      outstandingSen = 0;
      carryOverOutSen = remainingCarryOver + (paidSen - effectiveAmountSen);
    } else {
      outstandingSen = effectiveAmountSen - paidSen;
      carryOverOutSen = remainingCarryOver;
    }

    // Set carryover for next cycle
    carryOverSen = carryOverOutSen;

    const startDate = billStartDate(y, m, statementDay);
    const closeDate = billCloseDate(y, m, statementDay);
    const dueDate = billDueDate(y, m, statementDay, dueDay);

    let status: CreditBillStatus;
    if (referenceDate <= closeDate) {
      status = 'open';
    } else if (outstandingSen > 0) {
      status = 'unpaid';
    } else {
      status = 'paid';
    }

    bills.push({
      accountId: account.id,
      year: y,
      month: m,
      label: formatBillLabel(m),
      monthLabel: formatMonthName(m),
      startDate,
      closeDate,
      dueDate,
      amountSen: effectiveAmountSen,
      originalAmountSen,
      paidSen,
      outstandingSen,
      carryOverInSen,
      carryOverOutSen,
      status,
      chargesCount: charges.count,
    });

    currentCycle = monthShift(y, m, 1);
  }

  return bills;
}
