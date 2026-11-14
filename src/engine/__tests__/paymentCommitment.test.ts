import { describe, expect, it } from '@jest/globals';
import {
  resolvePaymentCommitment,
  STATEMENT_CUTOFF_DAY,
} from '../paymentCommitment';

describe('paymentCommitment engine', () => {
  it('returns null for Others', () => {
    expect(resolvePaymentCommitment('2026-10-15', 'Others')).toBeNull();
    expect(resolvePaymentCommitment('2026-10-25', 'Others')).toBeNull();
  });

  describe('SPL cutoff (21st)', () => {
    it('rolls into current month when day < 21', () => {
      const target = resolvePaymentCommitment('2026-10-20', 'SPL');
      expect(target).toEqual({
        targetYear: 2026,
        targetMonth: 10,
        monthLabel: 'Oct',
        commitmentName: 'SPL-Oct',
        commitmentType: 'bnpl',
        dueDate: '2026-11-10',
      });
    });

    it('rolls into next month on or after cutoff (day >= 21)', () => {
      const target = resolvePaymentCommitment('2026-10-21', 'SPL');
      expect(target).toEqual({
        targetYear: 2026,
        targetMonth: 11,
        monthLabel: 'Nov',
        commitmentName: 'SPL-Nov',
        commitmentType: 'bnpl',
        dueDate: '2026-12-10',
      });
    });

    it('rolls across year boundary in December after cutoff', () => {
      const target = resolvePaymentCommitment('2026-12-25', 'SPL');
      expect(target).toEqual({
        targetYear: 2027,
        targetMonth: 1,
        monthLabel: 'Jan',
        commitmentName: 'SPL-Jan',
        commitmentType: 'bnpl',
        dueDate: '2027-02-10',
      });
    });
  });

  describe('Maybank CC cutoff (21st)', () => {
    it('rolls into current month when day < 21', () => {
      const target = resolvePaymentCommitment('2026-05-10', 'Maybank CC');
      expect(target).toEqual({
        targetYear: 2026,
        targetMonth: 5,
        monthLabel: 'May',
        commitmentName: 'MaybankCC-May',
        commitmentType: 'credit_card',
        dueDate: '2026-06-10',
      });
    });

    it('rolls into next month on or after cutoff (day >= 21)', () => {
      const target = resolvePaymentCommitment('2026-05-21', 'Maybank CC');
      expect(target).toEqual({
        targetYear: 2026,
        targetMonth: 6,
        monthLabel: 'Jun',
        commitmentName: 'MaybankCC-Jun',
        commitmentType: 'credit_card',
        dueDate: '2026-07-10',
      });
    });

    it('handles year rollover for due date when targetMonth is December', () => {
      // Day < 21 in December -> targetMonth is 12, dueDate is next month Jan 2027
      const target = resolvePaymentCommitment('2026-12-15', 'Maybank CC');
      expect(target).toEqual({
        targetYear: 2026,
        targetMonth: 12,
        monthLabel: 'Dec',
        commitmentName: 'MaybankCC-Dec',
        commitmentType: 'credit_card',
        dueDate: '2027-01-10',
      });
    });
  });
});
