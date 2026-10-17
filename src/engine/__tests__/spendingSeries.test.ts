import { describe, expect, it } from '@jest/globals';
import { spendingSeries } from '../spendingSeries';

describe('spendingSeries engine', () => {
  const baseExpenses = [
    { id: 1, amountSen: 2500, date: '2026-10-10', categoryId: 1 }, // RM25.00 Food
    { id: 2, amountSen: 5000, date: '2026-10-10', categoryId: 2 }, // RM50.00 Transport
    { id: 3, amountSen: 12000, date: '2026-10-09', categoryId: 1 }, // RM120.00 Food
    { id: 4, amountSen: 30000, date: '2026-09-15', categoryId: 1 }, // RM300.00 Food (last month)
  ];

  describe('Day granularity (30 days default)', () => {
    it('returns 30 zero-filled days ending at endDate', () => {
      const result = spendingSeries(baseExpenses, {
        granularity: 'day',
        endDate: '2026-10-10',
      });

      expect(result.series).toHaveLength(30);
      expect(result.series[29]?.periodStart).toBe('2026-10-10');
      expect(result.series[28]?.periodStart).toBe('2026-10-09');
      expect(result.series[0]?.periodStart).toBe('2026-09-11');

      // 10 Oct has 2500 + 5000 = 7500 sen
      expect(result.series[29]?.totalSen).toBe(7500);
      expect(result.series[29]?.a11yLabel).toContain('RM75.00');

      // 09 Oct has 12000 sen
      expect(result.series[28]?.totalSen).toBe(12000);

      // Other days in between are zero-filled
      expect(result.series[27]?.totalSen).toBe(0);

      // Window total and average
      expect(result.windowTotal).toBe(7500 + 12000 + 30000); // 30000 on 15 Sep is within the 30-day window
      expect(result.averagePerPeriod).toBe(Math.floor(result.windowTotal / 30));

      // Highest index points to 15 Sep (30000 sen)
      // 15 Sep index: from 11 Sep (idx 0), 15 Sep is idx 4
      expect(result.highestIndex).toBe(4);
      expect(result.series[result.highestIndex]?.totalSen).toBe(30000);
    });

    it('filters by categoryId when provided', () => {
      const result = spendingSeries(baseExpenses, {
        granularity: 'day',
        endDate: '2026-10-10',
        categoryId: 1, // Food only
      });

      // 10 Oct Food is 2500 only (Transport excluded)
      expect(result.series[29]?.totalSen).toBe(2500);
      expect(result.windowTotal).toBe(2500 + 12000 + 30000);
    });
  });

  describe('Week granularity (12 weeks, Monday start)', () => {
    it('returns 12 weeks with Monday start date', () => {
      // 2026-10-10 is a Saturday; Monday of that week is 2026-10-05
      const result = spendingSeries(baseExpenses, {
        granularity: 'week',
        endDate: '2026-10-10',
        count: 12,
      });

      expect(result.series).toHaveLength(12);
      expect(result.series[11]?.periodStart).toBe('2026-10-05');
      // Week of 2026-10-05 includes 2026-10-09 (12000) and 2026-10-10 (7500)
      expect(result.series[11]?.totalSen).toBe(19500);
      expect(result.series[11]?.a11yLabel).toContain('Week of');

      // Previous weeks are zero-filled except the week containing 2026-09-15 (Monday 2026-09-14)
      const sepWeek = result.series.find((w) => w.periodStart === '2026-09-14');
      expect(sepWeek).toBeDefined();
      expect(sepWeek?.totalSen).toBe(30000);

      expect(result.windowTotal).toBe(19500 + 30000);
      expect(result.averagePerPeriod).toBe(Math.floor((19500 + 30000) / 12));
    });
  });

  describe('Month granularity (12 months)', () => {
    it('returns 12 months ending at the month of endDate', () => {
      const result = spendingSeries(baseExpenses, {
        granularity: 'month',
        endDate: '2026-10-10',
      });

      expect(result.series).toHaveLength(12);
      expect(result.series[11]?.periodStart).toBe('2026-10-01');
      expect(result.series[11]?.label).toBe('Oct');
      expect(result.series[11]?.totalSen).toBe(19500);

      expect(result.series[10]?.periodStart).toBe('2026-09-01');
      expect(result.series[10]?.label).toBe('Sep');
      expect(result.series[10]?.totalSen).toBe(30000);

      // First month in 12-month window is November 2025
      expect(result.series[0]?.periodStart).toBe('2025-11-01');
      expect(result.series[0]?.label).toBe('Nov');
      expect(result.series[0]?.totalSen).toBe(0);

      expect(result.highestIndex).toBe(10); // Sep (30000)
    });

    it('correctly handles all zeroes with highestIndex 0', () => {
      const result = spendingSeries([], {
        granularity: 'month',
        endDate: '2026-10-10',
      });

      expect(result.series).toHaveLength(12);
      expect(result.windowTotal).toBe(0);
      expect(result.averagePerPeriod).toBe(0);
      expect(result.highestIndex).toBe(0);
    });
  });
});
