import { SHORT_MONTHS } from '@/utils/dates';
import type { CommitmentType, PaymentMethod } from '@/repositories/types';

export const STATEMENT_CUTOFF_DAY = 21;

export interface TargetStatementCycle {
  targetYear: number;
  targetMonth: number; // 1-12
  monthLabel: string; // e.g. 'Oct'
  commitmentName: string; // e.g. 'SPL-Oct' or 'MaybankCC-Oct'
  commitmentType: CommitmentType; // 'bnpl' or 'credit_card'
  dueDate: string; // e.g. '2026-11-10'
}

/**
 * Resolves the destination commitment statement cycle based on the expense date and payment method.
 * Statement cutoff is 21st:
 * - date day < 21: rolls into current month's commitment (e.g. 'SPL-Oct' / 'MaybankCC-Oct')
 * - date day >= 21: rolls into next month's commitment (e.g. 'SPL-Nov' / 'MaybankCC-Nov')
 * For 'Others', returns null (no commitment linking).
 */
export function resolvePaymentCommitment(
  dateStr: string,
  paymentMethod: PaymentMethod,
  cutoffDay: number = STATEMENT_CUTOFF_DAY,
): TargetStatementCycle | null {
  if (paymentMethod === 'Others') {
    return null;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  let targetYear = year;
  let targetMonth = month;

  if (day >= cutoffDay) {
    if (month === 12) {
      targetYear = year + 1;
      targetMonth = 1;
    } else {
      targetMonth = month + 1;
    }
  }

  const monthLabel = SHORT_MONTHS[targetMonth - 1] ?? '';
  const prefix = paymentMethod === 'SPL' ? 'SPL' : 'MaybankCC';
  const commitmentName = `${prefix}-${monthLabel}`;
  const commitmentType: CommitmentType = paymentMethod === 'SPL' ? 'bnpl' : 'credit_card';

  // Due date is next month after statement close (default 10th of next month)
  const dueYear = targetMonth === 12 ? targetYear + 1 : targetYear;
  const dueMonth = targetMonth === 12 ? 1 : targetMonth + 1;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const dueDate = `${dueYear}-${pad2(dueMonth)}-10`;

  return {
    targetYear,
    targetMonth,
    monthLabel,
    commitmentName,
    commitmentType,
    dueDate,
  };
}
