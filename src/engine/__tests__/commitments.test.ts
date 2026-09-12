/**
 * Plan 008 — engine commitment schedule derivation (pure). Fixture matrix per
 * plan §Tests: remainder math (2500/400 → 6×400 + 100), exact division,
 * payment > total, day-of-month clamping incl. leap years, end-date capping,
 * window bounds, one-time, ongoing-monthly windowing (anchor + mid-month),
 * exact slot lookup, remainder-after-paid, and upcoming windows (paid /
 * cancelled / archived exclusions, overdue inclusion, exclusive windowEnd).
 */
import { describe, expect, it } from '@jest/globals';
import {
  commitmentSchedule,
  commitmentSlotAt,
  compareByNextDue,
  remainingAfterPaid,
  upcomingCommitments,
  type CommitmentLike,
  type NextDueOrder,
} from '@/engine/commitments';

/** Default: fixed monthly RM2,500 total, RM400 payment, anchored 2026-01-01. */
function commitment(over: Partial<CommitmentLike> = {}): CommitmentLike {
  return {
    id: 1,
    totalSen: 2500,
    paymentSen: 400,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    dueDate: '2026-01-01',
    status: 'active',
    archivedAt: null,
    ...over,
  };
}

describe('commitmentSchedule — fixed installments', () => {
  it('2500/400 → 6×400 + 100 remainder on the last slot', () => {
    const slots = commitmentSchedule(commitment());
    expect(slots).toHaveLength(7);
    expect(slots.slice(0, 6).map((s) => s.amountSen)).toEqual([400, 400, 400, 400, 400, 400]);
    expect(slots[6]).toMatchObject({ amountSen: 100, index: 6, dueDate: '2026-07-01' });
    expect(slots.reduce((sum, s) => sum + s.amountSen, 0)).toBe(2500); // sum invariant
  });

  it('exact division: no special remainder slot (2400/400 → 6×400)', () => {
    const slots = commitmentSchedule(commitment({ totalSen: 2400 }));
    expect(slots).toHaveLength(6);
    expect(slots.every((s) => s.amountSen === 400)).toBe(true);
  });

  it('payment > total collapses to a single payment of the total', () => {
    const slots = commitmentSchedule(commitment({ totalSen: 100, paymentSen: 400 }));
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ amountSen: 100, dueDate: '2026-01-01', index: 0 });
  });

  it('clamps the anchor day to the target month (Jan 31 → Feb 28, 2026)', () => {
    const slots = commitmentSchedule(commitment({ startDate: '2026-01-31', paymentSen: 500 }));
    expect(slots.map((s) => s.dueDate).slice(0, 5)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('clamps to Feb 29 in a leap year (2028) and keeps the anchor when it fits', () => {
    const slots = commitmentSchedule(commitment({ startDate: '2028-01-31', paymentSen: 500 }));
    expect(slots.map((s) => s.dueDate).slice(0, 4)).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
      '2028-04-30',
    ]);
    const jan30 = commitmentSchedule(commitment({ startDate: '2026-01-30', paymentSen: 500 }));
    expect(jan30.map((s) => s.dueDate).slice(0, 3)).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('end_date caps N at the inclusive month span; the last slot absorbs everything left', () => {
    const slots = commitmentSchedule(
      commitment({ startDate: '2026-01-15', endDate: '2026-03-10' }),
    );
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.amountSen)).toEqual([400, 400, 1700]);
    expect(slots.map((s) => s.dueDate)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(slots.reduce((sum, s) => sum + s.amountSen, 0)).toBe(2500);
  });

  it('filters to the window [from, to) with from inclusive and to exclusive', () => {
    const slots = commitmentSchedule(commitment(), '2026-03-01', '2026-05-01');
    expect(slots.map((s) => s.dueDate)).toEqual(['2026-03-01', '2026-04-01']);
  });

  it('an inverted/empty window (from >= to) yields no slots', () => {
    expect(commitmentSchedule(commitment(), '2026-05-01', '2026-05-01')).toEqual([]);
    expect(commitmentSchedule(commitment(), '2026-06-01', '2026-05-01')).toEqual([]);
  });
});

describe('commitmentSchedule — one-time', () => {
  it('is a single payment of paymentSen on dueDate, regardless of startDate', () => {
    const c = commitment({
      totalSen: null,
      frequency: 'one_time',
      startDate: '2026-01-01',
      dueDate: '2026-09-05',
      paymentSen: 30000,
    });
    expect(commitmentSchedule(c)).toEqual([{ dueDate: '2026-09-05', amountSen: 30000, index: 0 }]);
  });

  it('appears only inside a window covering its due date (exclusive end)', () => {
    const c = commitment({ totalSen: null, frequency: 'one_time', dueDate: '2026-09-05', paymentSen: 30000 });
    const nextMonthStart = '2026-10-01';
    expect(commitmentSchedule(c, '2026-09-01', nextMonthStart)).toHaveLength(1);
    expect(commitmentSchedule(c, '2026-10-01', '2026-11-01')).toEqual([]); // after
    expect(commitmentSchedule(c, '2026-01-01', '2026-09-05')).toEqual([]); // due ON the end
  });
});

describe('commitmentSchedule — ongoing monthly (windowed)', () => {
  it('anchors at startDate and materializes only slots with dueDate < to', () => {
    const c = commitment({ totalSen: null, startDate: '2026-01-15', paymentSen: 50000 });
    expect(commitmentSchedule(c, undefined, '2026-04-01').map((s) => s.dueDate)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
    ]);
  });

  it('stays on the mid-month anchor after day clamping across months', () => {
    const c = commitment({ totalSen: null, startDate: '2026-01-31', paymentSen: 50000 });
    expect(commitmentSchedule(c, undefined, '2026-04-01').map((s) => s.dueDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('requires a window end — an unbounded series is never materialized', () => {
    expect(() => commitmentSchedule(commitment({ totalSen: null }))).toThrow(
      'ongoing commitments need a window end',
    );
  });
});

describe('commitmentSlotAt — exact due-date lookup (mark-paid)', () => {
  it('matches a mid-schedule slot at its exact grid date', () => {
    expect(commitmentSlotAt(commitment(), '2026-03-01')).toEqual({
      dueDate: '2026-03-01',
      amountSen: 400,
      index: 2,
    });
  });

  it('matches the last (remainder) slot with the remainder amount', () => {
    expect(commitmentSlotAt(commitment(), '2026-07-01')).toEqual({
      dueDate: '2026-07-01',
      amountSen: 100,
      index: 6,
    });
  });

  it('rejects a date off the monthly grid (wrong day)', () => {
    expect(commitmentSlotAt(commitment(), '2026-01-02')).toBeNull();
  });

  it('rejects a date before the anchor', () => {
    expect(commitmentSlotAt(commitment(), '2025-12-01')).toBeNull();
  });

  it('rejects a date beyond the fixed count', () => {
    expect(commitmentSlotAt(commitment(), '2026-08-01')).toBeNull(); // k=7 ≥ N=7
  });

  it('matches a clamped due date (Jan 31 anchor → Feb 28 slot) and rejects a lookalike', () => {
    const c = commitment({ startDate: '2026-01-31', totalSen: 100000, paymentSen: 40000 });
    expect(commitmentSlotAt(c, '2026-02-28')).toMatchObject({ amountSen: 40000, index: 1 });
    expect(commitmentSlotAt(c, '2026-03-28')).toBeNull(); // March slot is the 31st
  });

  it('one-time: only its exact due date matches', () => {
    const c = commitment({ totalSen: null, frequency: 'one_time', dueDate: '2026-09-05', paymentSen: 30000 });
    expect(commitmentSlotAt(c, '2026-09-05')).toMatchObject({ amountSen: 30000, index: 0 });
    expect(commitmentSlotAt(c, '2026-09-06')).toBeNull();
  });

  it('ongoing: any date on the monthly grid from the anchor matches', () => {
    const c = commitment({ totalSen: null, startDate: '2026-01-31', paymentSen: 50000 });
    expect(commitmentSlotAt(c, '2026-02-28')).toMatchObject({ amountSen: 50000, index: 1 });
    expect(commitmentSlotAt(c, '2026-03-31')).toMatchObject({ amountSen: 50000, index: 2 });
    expect(commitmentSlotAt(c, '2026-03-30')).toBeNull();
  });

  it('returns null for malformed dates', () => {
    expect(commitmentSlotAt(commitment(), 'not-a-date')).toBeNull();
    expect(commitmentSlotAt(commitment(), '2026-02-30')).toBeNull();
  });
});

describe('remainingAfterPaid — sum-based remainder math', () => {
  it('fixed: total minus the sum of paid amounts', () => {
    const c = commitment();
    expect(remainingAfterPaid(c, [])).toBe(2500);
    expect(remainingAfterPaid(c, [400, 400, 400, 400, 400, 400, 100])).toBe(0);
    expect(remainingAfterPaid(c, [400, 400])).toBe(1700);
  });

  it('is order-independent (out-of-order paying lands on the same number)', () => {
    const c = commitment();
    expect(remainingAfterPaid(c, [100, 400])).toBe(2000);
    expect(remainingAfterPaid(c, [400, 100])).toBe(2000);
  });

  it('floors at 0 (defensive — over-paid state can never be negative)', () => {
    expect(remainingAfterPaid(commitment(), [2500, 100])).toBe(0);
  });

  it('ongoing and one-time have no fixed total — always 0', () => {
    expect(remainingAfterPaid(commitment({ totalSen: null }), [400, 400])).toBe(0);
    expect(
      remainingAfterPaid(commitment({ totalSen: null, frequency: 'one_time' }), [30000]),
    ).toBe(0);
  });
});

describe('upcomingCommitments — due before windowEnd (PRD COM-5)', () => {
  /** Window: "before next month start" — windowEnd is EXCLUSIVE. */
  const WINDOW_END = '2026-10-01';

  it('includes every unpaid slot < windowEnd, excluding paid (no double-count)', () => {
    const c = commitment(); // Jan–Jul, 2500
    const paid = [
      { commitmentId: 1, dueDate: '2026-01-01' },
      { commitmentId: 1, dueDate: '2026-02-01' },
    ];
    const result = upcomingCommitments([c], paid, WINDOW_END);
    expect(result.items.map((i) => i.dueDate)).toEqual([
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
    ]);
    expect(result.items.map((i) => i.amountSen)).toEqual([400, 400, 400, 400, 100]);
    expect(result.totalSen).toBe(1700);
    expect(result.items.every((i) => i.commitment === c)).toBe(true); // per-commitment breakdown
  });

  it('includes overdue (past) unpaid slots — they precede any window end', () => {
    const c = commitment({ startDate: '2026-08-01', totalSen: 300000, paymentSen: 100000 });
    const result = upcomingCommitments([c], [], '2026-11-01');
    // A slot due in the past of the caller's "today" is still in the window.
    expect(result.items.map((i) => i.dueDate)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(result.totalSen).toBe(300000);
  });

  it('excludes cancelled and archived commitments entirely', () => {
    const cancelled = commitment({ id: 2, status: 'cancelled' });
    const archived = commitment({ id: 3, archivedAt: 1735689600000 });
    const result = upcomingCommitments([cancelled, archived], [], WINDOW_END);
    expect(result.items).toEqual([]);
    expect(result.totalSen).toBe(0);
  });

  it('treats windowEnd as exclusive — a slot due ON windowEnd is outside', () => {
    const oneTime = commitment({
      id: 4,
      totalSen: null,
      frequency: 'one_time',
      dueDate: '2026-10-01',
      paymentSen: 30000,
    });
    expect(upcomingCommitments([oneTime], [], WINDOW_END)).toEqual({ totalSen: 0, items: [] });
    const inside = commitment({
      id: 5,
      totalSen: null,
      frequency: 'one_time',
      dueDate: '2026-09-30',
      paymentSen: 30000,
    });
    expect(upcomingCommitments([inside], [], WINDOW_END).totalSen).toBe(30000);
  });

  it('sums a mixed window: fixed + ongoing + one-time, paid excluded, breakdown intact', () => {
    const fixed = commitment({ id: 1, totalSen: 2500, paymentSen: 400 }); // Jan–Jul
    const ongoing = commitment({ id: 2, totalSen: null, startDate: '2026-08-15', paymentSen: 50000 });
    const dueThisWindow = commitment({
      id: 3,
      totalSen: null,
      frequency: 'one_time',
      dueDate: '2026-09-05',
      paymentSen: 30000,
    });
    const paid = [
      { commitmentId: 1, dueDate: '2026-01-01' },
      { commitmentId: 1, dueDate: '2026-02-01' },
      { commitmentId: 2, dueDate: '2026-08-15' },
    ];
    const result = upcomingCommitments([fixed, ongoing, dueThisWindow], paid, WINDOW_END);
    // fixed: 5 unpaid (1700) + ongoing: 2026-09-15 (50000) + one-time: 30000
    expect(result.totalSen).toBe(1700 + 50000 + 30000);
    expect(result.items).toHaveLength(7);
    expect(result.items.filter((i) => i.commitment.id === 2).map((i) => i.dueDate)).toEqual([
      '2026-09-15',
    ]);
  });

  it('a completed fixed commitment (every slot paid) contributes nothing', () => {
    const done = commitment({
      id: 9,
      totalSen: 2400,
      paymentSen: 400,
      status: 'completed',
      startDate: '2026-01-01',
    });
    const paid = [
      { commitmentId: 9, dueDate: '2026-01-01' },
      { commitmentId: 9, dueDate: '2026-02-01' },
      { commitmentId: 9, dueDate: '2026-03-01' },
      { commitmentId: 9, dueDate: '2026-04-01' },
      { commitmentId: 9, dueDate: '2026-05-01' },
      { commitmentId: 9, dueDate: '2026-06-01' },
    ];
    const result = upcomingCommitments([done], paid, WINDOW_END);
    expect(result.items).toEqual([]);
    expect(result.totalSen).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Default list order — soonest obligation first.
 * ------------------------------------------------------------------ */

describe('compareByNextDue', () => {
  const order = (rows: NextDueOrder[]): string[] =>
    [...rows].sort(compareByNextDue).map((row) => row.name);

  it('sorts by next due date, soonest first', () => {
    expect(
      order([
        { nextDue: '2026-10-15', name: 'Netflix', id: 1 },
        { nextDue: '2026-09-20', name: 'Rent', id: 2 },
        { nextDue: '2026-09-28', name: 'Car loan', id: 3 },
      ]),
    ).toEqual(['Rent', 'Car loan', 'Netflix']);
  });

  it('puts overdue at the very top (past dates sort first, no Date math)', () => {
    expect(
      order([
        { nextDue: '2026-09-20', name: 'Rent', id: 1 },
        { nextDue: '2026-08-01', name: 'Missed bill', id: 2 }, // overdue
        { nextDue: '2026-09-12', name: 'Phone', id: 3 },
      ]),
    ).toEqual(['Missed bill', 'Phone', 'Rent']);
  });

  it('sinks commitments with nothing outstanding to the bottom', () => {
    expect(
      order([
        { nextDue: null, name: 'Settled loan', id: 1 },
        { nextDue: '2026-12-31', name: 'Far away', id: 2 },
        { nextDue: null, name: 'Cancelled thing', id: 3 },
      ]),
    ).toEqual(['Far away', 'Cancelled thing', 'Settled loan']);
  });

  it('breaks ties by name then id — total and stable, never locale-dependent', () => {
    expect(
      order([
        { nextDue: '2026-09-20', name: 'beta', id: 5 },
        { nextDue: '2026-09-20', name: 'Alpha', id: 9 },
        { nextDue: '2026-09-20', name: 'alpha', id: 2 },
      ]),
    ).toEqual(['alpha', 'Alpha', 'beta']);
  });

  it('crosses the year boundary correctly', () => {
    expect(
      order([
        { nextDue: '2027-01-03', name: 'January', id: 1 },
        { nextDue: '2026-12-28', name: 'December', id: 2 },
      ]),
    ).toEqual(['December', 'January']);
  });
});
