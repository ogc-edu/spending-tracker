/**
 * Plan 009 — engine analytics math (pure). Fixture matrix per plan §Tests:
 * MoM absolute + floored-one-decimal percentage (positive, negative, zero,
 * baseline-zero → null), avgDaily floors, largest/top ordering with ties,
 * projection floor-correct, and pureness
 * (Date.now mocked to throw — this module has zero imports by construction).
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  avgDaily,
  largestExpenses,
  monthOverMonth,
  projectMonthEnd,
  topCategories,
} from '@/engine/analytics';

describe('monthOverMonth (PRD AN-1, AN-4)', () => {
  it('increase: changeSen + pct at one decimal', () => {
    // 130000 vs 100000 → +30000 sen, +30.0% (30000×1000/100000 = 300 → 30.0)
    expect(monthOverMonth(130000, 100000)).toEqual({ changeSen: 30000, changePct: 30.0 });
  });

  it('decrease: negative change, negative pct, floored', () => {
    expect(monthOverMonth(80000, 100000)).toEqual({ changeSen: -20000, changePct: -20.0 });
  });

  it('flat: zero change, 0.0%', () => {
    expect(monthOverMonth(100000, 100000)).toEqual({ changeSen: 0, changePct: 0.0 });
  });

  it('pct is null when the baseline is 0 — the UI "—" (undefined change)', () => {
    expect(monthOverMonth(12345, 0)).toEqual({ changeSen: 12345, changePct: null });
    expect(monthOverMonth(0, 0)).toEqual({ changeSen: 0, changePct: null });
  });

  it('floors the percentage at one decimal — never rounds up', () => {
    // +124 sen on 10000 = +1.24% → 12.4 tenths → floor 12 → 1.2 (not 1.3)
    expect(monthOverMonth(10124, 10000).changePct).toBe(1.2);
    // 1.25% and 1.29% also floor to 1.2; 1.30% crosses to 1.3
    expect(monthOverMonth(10125, 10000).changePct).toBe(1.2);
    expect(monthOverMonth(10129, 10000).changePct).toBe(1.2);
    expect(monthOverMonth(10130, 10000).changePct).toBe(1.3);
  });

  it('negative percentages floor toward −∞ (conservative: −1.24% → −1.3, not −1.2)', () => {
    // −124 sen on 10000 = −1.24% → −12.4 tenths → floor −13 → −1.3 (ARCH §6: floor, never round)
    expect(monthOverMonth(9876, 10000).changePct).toBe(-1.3);
  });

  it('large swings: 150% increase and a total collapse to zero (−100%)', () => {
    expect(monthOverMonth(2500000, 1000000)).toEqual({ changeSen: 1500000, changePct: 150.0 });
    expect(monthOverMonth(0, 100000)).toEqual({ changeSen: -100000, changePct: -100.0 });
  });
});

describe('avgDaily (PRD AN-2)', () => {
  it('floors spent ÷ elapsed days to the sen', () => {
    expect(avgDaily(150000, 7)).toBe(21428); // 21428.57 → 21428
    expect(avgDaily(150000, 1)).toBe(150000);
    expect(avgDaily(150000, 30)).toBe(5000);
  });

  it('bucket boundaries floor, never round up', () => {
    expect(avgDaily(100000, 3)).toBe(33333); // 33333.33 → 33333
    expect(avgDaily(100002, 3)).toBe(33334); // exactly 33334
  });

  it('0 on zero/negative elapsed days (division-by-zero guard)', () => {
    expect(avgDaily(500, 0)).toBe(0);
    expect(avgDaily(500, -4)).toBe(0);
    expect(avgDaily(0, 5)).toBe(0);
  });
});

describe('largestExpenses (PRD AN-2)', () => {
  const rows = [
    { amountSen: 500, date: '2026-09-01', description: 'a' },
    { amountSen: 300, date: '2026-09-02', description: 'b' },
    { amountSen: 900, date: '2026-09-03', description: 'c' },
    { amountSen: 300, date: '2026-09-04', description: 'd' },
  ];

  it('returns the n largest, descending by amount', () => {
    expect(largestExpenses(rows, 2).map((r) => r.description)).toEqual(['c', 'a']);
    expect(largestExpenses(rows, 1).map((r) => r.description)).toEqual(['c']);
  });

  it('ties keep input order (stable sort)', () => {
    // two 300-sen rows: b (index 1) before d (index 3)
    expect(largestExpenses(rows, 4).map((r) => r.description)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('n beyond length returns everything; n ≤ 0 returns nothing; empty input → []', () => {
    expect(largestExpenses(rows, 10)).toHaveLength(4);
    expect(largestExpenses(rows, 0)).toEqual([]);
    expect(largestExpenses(rows, -3)).toEqual([]);
    expect(largestExpenses([], 5)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const original = rows.map((r) => r.amountSen);
    largestExpenses(rows, 2);
    expect(rows.map((r) => r.amountSen)).toEqual(original);
  });
});

describe('topCategories (PRD AN-2)', () => {
  const breakdown = new Map<number, number>([
    [1, 400],
    [2, 900],
    [3, 400],
  ]);

  it('returns [categoryId, totalSen] pairs, descending; ties keep insertion order', () => {
    expect(topCategories(breakdown, 2)).toEqual([
      [2, 900],
      [1, 400],
    ]);
    expect(topCategories(breakdown, 10)).toEqual([
      [2, 900],
      [1, 400],
      [3, 400],
    ]);
  });

  it('n ≤ 0 → []; empty breakdown → []', () => {
    expect(topCategories(breakdown, 0)).toEqual([]);
    expect(topCategories(breakdown, -1)).toEqual([]);
    expect(topCategories(new Map(), 3)).toEqual([]);
  });
});

describe('projectMonthEnd (PRD AN-3)', () => {
  it('scales spent ÷ elapsed × daysInMonth exactly', () => {
    expect(projectMonthEnd(150000, 15, 30)).toBe(300000); // 2× spending pace
    expect(projectMonthEnd(1900000, 30, 30)).toBe(1900000); // full month = identity
  });

  it('floors to the sen (product-first integer math, no float drift)', () => {
    // 100000 × 31 ÷ 7 = 442857.14… → 442857
    expect(projectMonthEnd(100000, 7, 31)).toBe(442857);
    // 1 × 31 ÷ 3 = 10.33… → 10 — the sen-granularity floor
    expect(projectMonthEnd(1, 3, 31)).toBe(10);
    expect(projectMonthEnd(1, 7, 30)).toBe(4);
  });

  it('0 when elapsedDays = 0 (division-by-zero guard) or the month has 0 days', () => {
    expect(projectMonthEnd(500, 0, 30)).toBe(0);
    expect(projectMonthEnd(500, -2, 30)).toBe(0);
    expect(projectMonthEnd(500, 5, 0)).toBe(0);
    expect(projectMonthEnd(0, 5, 30)).toBe(0);
  });
});

describe('pureness — no hidden clock, zero imports (ARCH §6)', () => {
  it('every analytics function runs with Date.now mocked to throw', () => {
    const spy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => {
        throw new Error('engine must not read the clock');
      });
    let mom: { changeSen: number; changePct: number | null };
    let daily: number;
    let largest: number;
    let top: number;
    let proj: number;
    try {
      mom = monthOverMonth(12000, 10000);
      daily = avgDaily(150000, 7);
      largest = largestExpenses([{ amountSen: 5 }, { amountSen: 9 }], 1).length;
      top = topCategories(new Map([[1, 8]]), 1).length;
      proj = projectMonthEnd(100000, 7, 31);
    } finally {
      spy.mockRestore();
    }
    expect(mom.changePct).toBe(20.0);
    expect(daily).toBe(21428);
    expect(largest).toBe(1);
    expect(top).toBe(1);
    expect(proj).toBe(442857);
  });
});