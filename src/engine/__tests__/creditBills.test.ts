import { describe, expect, it } from '@jest/globals';
import {
  billCloseDate,
  billStartDate,
  billDueDate,
  billCycleForDate,
  splitInstallment,
  deriveCreditBills,
  formatBillLabel,
} from '../creditBills';

describe('creditBills — billing cycle calculation', () => {
  describe('S8: ShopeePayLater (SPL) specification example', () => {
    const statementDay = 20;
    const dueDay = 31; // end of month

    it('October bill covers 21 Sep – 20 Oct and is due 31 Oct', () => {
      expect(billStartDate(2026, 10, statementDay)).toBe('2026-09-21');
      expect(billCloseDate(2026, 10, statementDay)).toBe('2026-10-20');
      expect(billDueDate(2026, 10, statementDay, dueDay)).toBe('2026-10-31');
      expect(formatBillLabel(10)).toBe('October bill');
    });

    it('classifies purchase dates into the correct bill cycle', () => {
      // 20 Sep falls in the September bill
      expect(billCycleForDate('2026-09-20', statementDay)).toEqual({ year: 2026, month: 9 });
      // 21 Sep falls in the October bill
      expect(billCycleForDate('2026-09-21', statementDay)).toEqual({ year: 2026, month: 10 });
      // 20 Oct falls in the October bill
      expect(billCycleForDate('2026-10-20', statementDay)).toEqual({ year: 2026, month: 10 });
      // 21 Oct falls in the November bill
      expect(billCycleForDate('2026-10-21', statementDay)).toEqual({ year: 2026, month: 11 });
    });
  });

  describe('due_day relative to statement_day', () => {
    it('due_day > statement_day: due in the closing month', () => {
      // Statement 20, Due 28
      expect(billDueDate(2026, 5, 20, 28)).toBe('2026-05-28');
    });

    it('due_day <= statement_day: rolls to next month', () => {
      // Card with statement 25 / due 15: October bill due 15 Nov
      expect(billDueDate(2026, 10, 25, 15)).toBe('2026-11-15');
      // Statement 20, Due 20: rolls to next month
      expect(billDueDate(2026, 10, 20, 20)).toBe('2026-11-20');
    });

    it('December bill with due_day <= statement_day rolls to January of next year', () => {
      expect(billDueDate(2026, 12, 25, 10)).toBe('2027-01-10');
    });
  });

  describe('Month ends, February, and leap years', () => {
    it('clamps statement_day 31 in 30-day months and February', () => {
      expect(billCloseDate(2026, 4, 31)).toBe('2026-04-30'); // April
      expect(billCloseDate(2026, 2, 31)).toBe('2026-02-28'); // Non-leap Feb
      expect(billCloseDate(2024, 2, 31)).toBe('2024-02-29'); // Leap Feb
    });

    it('computes cycle start date correctly following a clamped month end', () => {
      // March bill with statement_day 31 follows Feb 28 in 2026
      expect(billStartDate(2026, 3, 31)).toBe('2026-03-01');
      // March bill with statement_day 31 follows Feb 29 in 2024 leap year
      expect(billStartDate(2024, 3, 31)).toBe('2024-03-01');
      // May bill (31 days) following April (30 days) with statement_day 31
      expect(billStartDate(2026, 5, 31)).toBe('2026-05-01');
    });

    it('clamps due_day 31 in February and 30-day months', () => {
      // Due in closing month: February non-leap
      expect(billDueDate(2026, 2, 10, 31)).toBe('2026-02-28');
      // Due in closing month: February leap
      expect(billDueDate(2024, 2, 10, 31)).toBe('2024-02-29');
      // Due rolled to February from January:
      expect(billDueDate(2026, 1, 31, 31)).toBe('2026-02-28');
      expect(billDueDate(2024, 1, 31, 31)).toBe('2024-02-29');
    });

    it('billCycleForDate correctly handles year boundary in December', () => {
      expect(billCycleForDate('2026-12-25', 20)).toEqual({ year: 2027, month: 1 });
      expect(billCycleForDate('2026-12-15', 20)).toEqual({ year: 2026, month: 12 });
    });
  });
});

describe('creditBills — instalment parts calculation', () => {
  it('splits principal evenly with remainder absorbed by the last part', () => {
    // 100.00 split 3 months, 0% interest
    const split = splitInstallment(10000, 3, 0);
    expect(split.parts).toHaveLength(3);
    expect(split.parts[0]?.principalSen).toBe(3333);
    expect(split.parts[0]?.interestSen).toBe(0);
    expect(split.parts[0]?.totalSen).toBe(3333);

    expect(split.parts[1]?.principalSen).toBe(3333);
    expect(split.parts[1]?.interestSen).toBe(0);
    expect(split.parts[1]?.totalSen).toBe(3333);

    expect(split.parts[2]?.principalSen).toBe(3334); // absorbs remainder
    expect(split.parts[2]?.interestSen).toBe(0);
    expect(split.parts[2]?.totalSen).toBe(3334);

    expect(split.totalPayableSen).toBe(10000);
    expect(split.totalInterestSen).toBe(0);
  });

  it('calculates interest per part: floor(principal * monthly_rate_bp / 10000)', () => {
    // 1,000.00 split 3 months at 1.50% monthly (150 bp)
    // 100000 * 150 / 10000 = 1500 sen interest per part
    const split = splitInstallment(100000, 3, 150);
    expect(split.parts[0]?.principalSen).toBe(33333);
    expect(split.parts[0]?.interestSen).toBe(1500);
    expect(split.parts[0]?.totalSen).toBe(34833);

    expect(split.parts[1]?.principalSen).toBe(33333);
    expect(split.parts[1]?.interestSen).toBe(1500);
    expect(split.parts[1]?.totalSen).toBe(34833);

    expect(split.parts[2]?.principalSen).toBe(33334);
    expect(split.parts[2]?.interestSen).toBe(1500);
    expect(split.parts[2]?.totalSen).toBe(34834);

    expect(split.totalInterestSen).toBe(4500);
    expect(split.totalPayableSen).toBe(104500);
  });

  it('floors interest to sen', () => {
    // 33.33 (3333 sen) at 1.25% (125 bp)
    // 3333 * 125 / 10000 = 41.6625 -> 41 sen per part
    const split = splitInstallment(3333, 2, 125);
    expect(split.parts[0]?.interestSen).toBe(41);
    expect(split.parts[1]?.interestSen).toBe(41);
    expect(split.totalInterestSen).toBe(82);
  });
});

describe('creditBills — deriveCreditBills', () => {
  const account = {
    id: 1,
    statementDay: 20,
    dueDay: 31,
    openingOwedSen: 0,
    createdAt: '2026-09-01',
  };

  it('returns empty array when account billing cycle is not configured', () => {
    const unconfigured = { ...account, statementDay: null, dueDay: null };
    const bills = deriveCreditBills({
      account: unconfigured,
      expenses: [{ id: 1, amountSen: 5000, date: '2026-10-05' }],
      payments: [],
      referenceDate: '2026-10-10',
    });
    expect(bills).toEqual([]);
  });

  it('aggregates expenses into their respective bill cycles', () => {
    const expenses = [
      { id: 1, amountSen: 3000, date: '2026-09-20' }, // Sept bill
      { id: 2, amountSen: 5000, date: '2026-09-21' }, // Oct bill
      { id: 3, amountSen: 2000, date: '2026-10-15' }, // Oct bill
    ];
    const bills = deriveCreditBills({
      account,
      expenses,
      payments: [],
      referenceDate: '2026-10-25', // Today is after Oct close
    });

    const sepBill = bills.find((b) => b.month === 9 && b.year === 2026);
    expect(sepBill).toBeDefined();
    expect(sepBill?.amountSen).toBe(3000);
    expect(sepBill?.chargesCount).toBe(1);
    expect(sepBill?.status).toBe('unpaid');

    const octBill = bills.find((b) => b.month === 10 && b.year === 2026);
    expect(octBill).toBeDefined();
    expect(octBill?.amountSen).toBe(7000); // 5000 + 2000
    expect(octBill?.chargesCount).toBe(2);
    expect(octBill?.status).toBe('unpaid');
  });

  it('assigns instalment parts to k bills after purchase bill', () => {
    // Purchase of 300.00 on 25 Sep (Oct bill), 3 months, 0% interest
    const expenses = [
      {
        id: 10,
        amountSen: 30000,
        date: '2026-09-25', // in Oct bill
        installment: {
          months: 3,
          monthlyRateBp: 0,
          principalSen: 30000,
        },
      },
    ];

    const bills = deriveCreditBills({
      account,
      expenses,
      payments: [],
      referenceDate: '2026-10-10',
    });

    const octBill = bills.find((b) => b.month === 10 && b.year === 2026);
    expect(octBill?.amountSen).toBe(10000);

    const novBill = bills.find((b) => b.month === 11 && b.year === 2026);
    expect(novBill?.amountSen).toBe(10000);

    const decBill = bills.find((b) => b.month === 12 && b.year === 2026);
    expect(decBill?.amountSen).toBe(10000);
  });

  it('assigns opening balance to creation bill', () => {
    const accWithOpening = {
      ...account,
      openingOwedSen: 12500,
      createdAt: '2026-09-10', // Sep bill
    };

    const bills = deriveCreditBills({
      account: accWithOpening,
      expenses: [],
      payments: [],
      referenceDate: '2026-10-10',
    });

    const sepBill = bills.find((b) => b.month === 9 && b.year === 2026);
    expect(sepBill?.amountSen).toBe(12500);
  });

  it('determines status: open (today <= close date), unpaid (closed, outstanding > 0), paid', () => {
    const expenses = [
      { id: 1, amountSen: 5000, date: '2026-09-21' }, // Oct bill (closes 20 Oct)
    ];
    const payments = [
      {
        id: 'p1',
        accountId: 1,
        billYear: 2026,
        billMonth: 10,
        amountSen: 5000,
        paidDate: '2026-10-22',
      },
    ];

    // Case 1: Today is 15 Oct <= 20 Oct (close date) -> 'open'
    const billsWhileOpen = deriveCreditBills({
      account,
      expenses,
      payments: [],
      referenceDate: '2026-10-15',
    });
    expect(billsWhileOpen.find((b) => b.month === 10)?.status).toBe('open');

    // Case 2: Today is 25 Oct > 20 Oct, no payment -> 'unpaid'
    const billsClosedUnpaid = deriveCreditBills({
      account,
      expenses,
      payments: [],
      referenceDate: '2026-10-25',
    });
    expect(billsClosedUnpaid.find((b) => b.month === 10)?.status).toBe('unpaid');

    // Case 3: Today is 25 Oct > 20 Oct, fully paid -> 'paid'
    const billsClosedPaid = deriveCreditBills({
      account,
      expenses,
      payments,
      referenceDate: '2026-10-25',
    });
    expect(billsClosedPaid.find((b) => b.month === 10)?.status).toBe('paid');
  });

  it('carries forward overpayment to the next bill', () => {
    const expenses = [
      { id: 1, amountSen: 4000, date: '2026-09-15' }, // Sep bill: 40.00
      { id: 2, amountSen: 3000, date: '2026-09-25' }, // Oct bill: 30.00
    ];
    // Overpaid Sep bill by 20.00 (paid 60.00)
    const payments = [
      {
        id: 'p1',
        accountId: 1,
        billYear: 2026,
        billMonth: 9,
        amountSen: 6000,
        paidDate: '2026-09-28',
      },
    ];

    const bills = deriveCreditBills({
      account,
      expenses,
      payments,
      referenceDate: '2026-10-25',
    });

    const sepBill = bills.find((b) => b.month === 9);
    expect(sepBill?.paidSen).toBe(6000);
    expect(sepBill?.outstandingSen).toBe(0);
    expect(sepBill?.carryOverOutSen).toBe(2000);
    expect(sepBill?.status).toBe('paid');

    const octBill = bills.find((b) => b.month === 10);
    // Original 30.00, carryOverIn 20.00 -> net amount is 10.00
    expect(octBill?.originalAmountSen).toBe(3000);
    expect(octBill?.carryOverInSen).toBe(2000);
    expect(octBill?.amountSen).toBe(1000);
    expect(octBill?.outstandingSen).toBe(1000);
    expect(octBill?.status).toBe('unpaid');
  });
});
