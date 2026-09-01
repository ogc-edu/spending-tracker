/**
 * Plan 009 — engine cash-flow math (pure). Fixture matrix per plan §Tests:
 * the PRD §8.5 worked example (300000−80000−184000−30000 → 6000 → 2/day over
 * 30 days), the D2 cancellation property (varying spent → safe unchanged),
 * deficit + boundary (exactly 0 is NOT deficit), the 1,900,000 ÷ 30 rounding
 * matrix (exact floor, integer math, no float drift), negative-safe negative
 * allowance (floor direction), days=0 → 0, the signed formula breakdown, and
 * pureness (Date.now mocked to throw proves no hidden clock).
 */
import { describe, expect, it, jest } from '@jest/globals';
import {
  cashFlowBreakdown,
  dailyAllowance,
  safeToSpend,
  type SafeToSpendInput,
} from '@/engine/cashflow';

/** PRD §8.4/§8.5 worked example (September 2026, sen): 300000 − 80000 − 184000 − 30000. */
const PRD_EXAMPLE: SafeToSpendInput = {
  availableSen: 300000,
  upcomingSen: 80000,
  remainingBudgetSen: 184000,
  bufferSen: 30000,
};

describe('safeToSpend — PRD §8.4 canonical formula', () => {
  it('matches the §8.5 worked example: safe = 300000 − 80000 − 184000 − 30000 = 6000 (RM60)', () => {
    expect(safeToSpend(PRD_EXAMPLE)).toEqual({ safeSen: 6000, deficit: false });
  });

  it('daily allowance of that safe over a 30-day month is floor(6000/30) = 200 sen (RM2/day)', () => {
    expect(dailyAllowance(6000, '2026-09-01', '2026-09-30')).toBe(200);
  });

  it('no budget and no upcoming: safe = available − buffer (the engine\'s "set a budget" prompt state)', () => {
    expect(
      safeToSpend({ availableSen: 250000, upcomingSen: 0, remainingBudgetSen: 0, bufferSen: 30000 }),
    ).toEqual({ safeSen: 220000, deficit: false });
  });

  it('all-zero inputs → safe 0, NOT deficit (0 < 0 is false — the exact-zero boundary)', () => {
    expect(
      safeToSpend({ availableSen: 0, upcomingSen: 0, remainingBudgetSen: 0, bufferSen: 0 }),
    ).toEqual({ safeSen: 0, deficit: false });
  });

  it('spent term cancels: shifting spent only moves available and remaining by the same amount', () => {
    // D2 (PRD §8.4 property 1): safe = startingAvailable − budget − commitments − buffer.
    // Spending X sen shows up as available − X AND remainingBudget − X → cancels.
    const spent1000 = { ...PRD_EXAMPLE, availableSen: 299000, remainingBudgetSen: 183000 };
    const spent2160 = { ...PRD_EXAMPLE, availableSen: 297840, remainingBudgetSen: 181840 };
    expect(safeToSpend(spent1000).safeSen).toBe(6000);
    expect(safeToSpend(spent2160).safeSen).toBe(6000);
    // …and it is the exact same safe as the unspent fixture, not just coincidentally equal.
    expect(safeToSpend(spent2160)).toEqual(safeToSpend(PRD_EXAMPLE));
  });

  it('flips to deficit (negative safe + flag) when obligations exceed available', () => {
    // 100000 − 120000 − 50000 − 30000 = −100000
    expect(
      safeToSpend({ availableSen: 100000, upcomingSen: 120000, remainingBudgetSen: 50000, bufferSen: 30000 }),
    ).toEqual({ safeSen: -100000, deficit: true });
  });

  it('zero safe is NOT a deficit — the boundary is < 0, not ≤ 0', () => {
    // 160000 − 80000 − 50000 − 30000 = 0 exactly
    expect(
      safeToSpend({ availableSen: 160000, upcomingSen: 80000, remainingBudgetSen: 50000, bufferSen: 30000 }),
    ).toEqual({ safeSen: 0, deficit: false });
  });
});

describe('dailyAllowance — floor to the sen over remaining days (today inclusive)', () => {
  it('1,900,000 sen ÷ 30 days → floor 63,333 sen — exact floor, no float drift', () => {
    expect(dailyAllowance(1900000, '2026-09-01', '2026-09-30')).toBe(63333);
  });

  it('rounding matrix: bucket edges floor correctly (never round up)', () => {
    // 1900001 ÷ 30 = 63,333.36… → 63,333 (floor, never round up)
    expect(dailyAllowance(1900001, '2026-09-01', '2026-09-30')).toBe(63333);
    // 1900030 ÷ 30 = 63,334.33… → 63,334 — one sen into the next bucket
    expect(dailyAllowance(1900030, '2026-09-01', '2026-09-30')).toBe(63334);
    // exact multiple: 1899990 ÷ 30 = 63,333 — integer division lands exactly
    expect(dailyAllowance(1899990, '2026-09-01', '2026-09-30')).toBe(63333);
  });

  it('negative safe → negative allowance, floored conservative (floor(−63001/30) = −2101)', () => {
    expect(dailyAllowance(-63001, '2026-09-01', '2026-09-30')).toBe(-2101);
    // exact division stays exact: −63000 ÷ 30 = −2100
    expect(dailyAllowance(-63000, '2026-09-01', '2026-09-30')).toBe(-2100);
  });

  it('days = 0 → 0 regardless of safe (stale/cross-month window: no days left)', () => {
    // today after monthEnd (cross-month) → daysRemaining returns 0
    expect(dailyAllowance(6000, '2026-10-01', '2026-09-30')).toBe(0);
    // …and even a NEGATIVE safe yields 0, not a division error (no NaN/Infinity)
    expect(dailyAllowance(-6000, '2026-10-01', '2026-09-30')).toBe(0);
  });

  it('mid-month denominator is today..month-end inclusive', () => {
    // Sept 15 → 30−15+1 = 16 days: 6000 ÷ 16 = 375 exactly
    expect(dailyAllowance(6000, '2026-09-15', '2026-09-30')).toBe(375);
  });
});

describe('cashFlowBreakdown — signed labelled components (DASH-3)', () => {
  it('renders the four terms in formula order with subtraction as negative amounts', () => {
    expect(cashFlowBreakdown(PRD_EXAMPLE)).toEqual([
      { label: 'Available', amountSen: 300000 },
      { label: 'Upcoming commitments', amountSen: -80000 },
      { label: 'Remaining budget', amountSen: -184000 },
      { label: 'Safety buffer', amountSen: -30000 },
    ]);
  });

  it('components sum to safeToSpend\'s safeSen (the formula card invariant)', () => {
    const items = cashFlowBreakdown(PRD_EXAMPLE);
    const sum = items.reduce((total, item) => total + item.amountSen, 0);
    expect(sum).toBe(safeToSpend(PRD_EXAMPLE).safeSen); // 6000
    expect(items).toHaveLength(4);
  });

  it('zero inputs yield positive-zero components (no negative zero anywhere)', () => {
    const zero: SafeToSpendInput = {
      availableSen: 0,
      upcomingSen: 0,
      remainingBudgetSen: 0,
      bufferSen: 0,
    };
    for (const item of cashFlowBreakdown(zero)) {
      expect(Object.is(item.amountSen, 0)).toBe(true); // −0 fails Object.is
    }
  });
});

describe('pureness — no hidden clock (ARCH §6)', () => {
  it('safeToSpend / dailyAllowance / cashFlowBreakdown never call Date.now', () => {
    const spy = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => {
        throw new Error('engine must not read the clock');
      });
    let safe: { safeSen: number; deficit: boolean };
    let daily: number;
    let items: { label: string; amountSen: number }[];
    try {
      safe = safeToSpend(PRD_EXAMPLE); // also expects Date.now was unused…
      daily = dailyAllowance(6000, '2026-09-01', '2026-09-30');
      items = cashFlowBreakdown({ availableSen: 1, upcomingSen: 2, remainingBudgetSen: 3, bufferSen: 4 });
    } finally {
      spy.mockRestore();
    }
    // …and the results are the same as without the mock (nothing depended on it).
    expect(safe).toEqual({ safeSen: 6000, deficit: false });
    expect(daily).toBe(200);
    expect(items.reduce((s, i) => s + i.amountSen, 0)).toBe(-8); // 1−2−3−4
  });
});