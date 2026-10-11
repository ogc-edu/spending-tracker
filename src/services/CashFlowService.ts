/**
 * CashFlowService (plan 010 / ARCHITECTURE §8 pipeline) — the ONLY
 * orchestrator behind the dashboard. `snapshot(now)` reads the same rows the
 * other tabs show and pushes them through the pure engine (009); the screen
 * renders the result with NO arithmetic of its own (ARCH §1, NFR-7).
 *
 * Pipeline (ARCH §8; plan 020 removed budget / buffer / safe-to-spend /
 * daily allowance — Home now answers "what did I spend" and "what is due"):
 *   available = AccountRepository.sumBalances        (credit-card owed negative)
 *   spent     = ExpenseRepository.listForMonth → engine.monthlyTotals
 *   upcoming  = engine.upcomingCommitments(active, paid, nextMonthStart)  (008)
 *               — "due by end of this month", overdue included
 *   summary   = engine.expenseTotalsByCategory → topCategories (DASH-2)
 *
 * The snapshot is typed and serializable — the ask box maps it onto the AI
 * payload (aggregates + category ids only; no free-text descriptions).
 * `now` is derived by the caller at call time (focus refresh / pull-to-
 * refresh), so the calendar rolls over without restart (A4: no caching).
 */
import { topCategories } from '@/engine/analytics';
import { upcomingCommitments, type CommitmentLike } from '@/engine/commitments';
import { expenseTotalsByCategory, monthlyTotals } from '@/engine/totals';
import type {
  AccountRepository,
  CommitmentRepository,
  CreditBillRepository,
  ExpenseRepository,
} from '@/repositories/types';
import { monthEndDate, nextMonthStartDate, toLocalDateString } from '@/utils/dates';
import type { CurrentUserSource } from './AccountService';
import { CreditBillService } from './CreditBillService';

/** One upcoming slot, shaped for the dashboard list (name from the DB row). */
export interface UpcomingSnapshotItem {
  commitmentId: number;
  /** Commitment display name (COM-1 label) or credit bill name. */
  name: string;
  /** `YYYY-MM-DD` — the derived due date (ARCH §7). */
  dueDate: string;
  amountSen: number;
  /** 'monthly' | 'one_time' — plan 017: drives the row's leading glyph. */
  frequency: 'monthly' | 'one_time';
  /** Plan 020: optional metadata for credit bills */
  kind?: 'commitment' | 'credit_bill';
  billAccountId?: number;
  billYear?: number;
  billMonth?: number;
}

/** One row of the category summary (DASH-2) — id + total; names resolved by the UI. */
export interface CategorySummaryItem {
  categoryId: number;
  totalSen: number;
}

/**
 * The full deterministic dashboard view (PRD DASH-1..5). Every number is
 * engine-computed.
 */
export interface CashFlowSnapshot {
  /** The current calendar month scope (derived from `now`, device-local). */
  month: { month: number; year: number };
  /** Σ account balances; credit-card owed counts negative (PRD §8.4). */
  availableSen: number;
  /** Σ expenses dated in `month` — paid commitment payments included (D3). */
  spentSen: number;
  /**
   * Σ unpaid payment amounts due before next month start (008, PRD COM-5) —
   * Home's "due by end of this month"; overdue slots and credit bills included.
   */
  upcomingSen: number;
  /** The upcoming slots, due-date ascending — the dashboard's "next 3" list. */
  upcomingItems: UpcomingSnapshotItem[];
  /**
   * Plan 019 — Σ unpaid commitment slots and bills due in the NEXT calendar month
   * (the ask box's "total commitment next month").
   */
  nextMonthSen: number;
  /** The next calendar month's unpaid slots — ask-box context (plan 019). */
  nextMonthItems: UpcomingSnapshotItem[];
  /** Category totals for the month, descending by amount (DASH-2). */
  categorySummary: CategorySummaryItem[];
  /** Account count — 0 drives the empty-accounts CTA (plan §Edge cases). */
  accountCount: number;
}

/** Sort upcoming slots by due date ascending — stable ties keep input order. */
function byDueDateAsc(a: { dueDate: string }, b: { dueDate: string }): number {
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
}

export class CashFlowService {
  private readonly creditBillService?: CreditBillService;

  constructor(
    private readonly accounts: AccountRepository,
    private readonly expenses: ExpenseRepository,
    private readonly commitments: CommitmentRepository,
    private readonly auth: CurrentUserSource,
    creditBills?: CreditBillService | CreditBillRepository,
  ) {
    if (creditBills instanceof CreditBillService) {
      this.creditBillService = creditBills;
    } else if (creditBills) {
      this.creditBillService = new CreditBillService(
        accounts,
        expenses,
        creditBills,
        auth,
      );
    }
  }

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * Compute the complete dashboard view for the month containing `now`
   * (device-local calendar). Pure aggregation over SQLite rows → engine —
   * no arithmetic in the screen, no caches (A4), deterministic for fixed
   * data + date (NFR-3).
   */
  async snapshot(now: Date): Promise<CashFlowSnapshot> {
    const userId = await this.requireUserId();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const scope = { month, year };
    const referenceDate = toLocalDateString(now);

    const [availableSen, accounts, spentRows, commitments, paidPayments] = await Promise.all([
      this.accounts.sumBalances(userId),
      this.accounts.list(userId),
      this.expenses.listForMonth(userId, year, month),
      this.commitments.list(userId),
      this.commitments.paidPayments(userId),
    ]);

    const spentSen = monthlyTotals(spentRows, scope);

    // 008: unpaid slots due before the start of next month (overdue included).
    const windowEnd = nextMonthStartDate(year, month);
    const thisMonthEnd = monthEndDate(year, month);
    // Repository rows ARE engine CommitmentLike (structural); the DB type's
    // `text` columns (frequency/status) are `string`, so the boundary cast to
    // the engine's narrower literal-union shape is expected (not a bug to fix).
    const upcoming = upcomingCommitments(
      commitments as CommitmentLike[],
      paidPayments,
      windowEnd,
    );

    // Plan 019 — the NEXT calendar month's unpaid slots, for the ask box.
    // Same rows, one window further out; filtering at `windowEnd` drops
    // overdue/this-month slots, so `nextMonth` is exactly next month.
    const [nextYear, nextMonthNumber] = windowEnd.split('-').map(Number);
    const nextMonthEnd = monthEndDate(nextYear as number, nextMonthNumber as number);
    const nextWindow = upcomingCommitments(
      commitments as CommitmentLike[],
      paidPayments,
      nextMonthStartDate(nextYear as number, nextMonthNumber as number),
    );
    const nextMonthCommitmentItems = nextWindow.items.filter((item) => item.dueDate >= windowEnd);

    // Plan 020 — Credit bills due by month end (overdue included) & next month
    const thisMonthBillItems: UpcomingSnapshotItem[] = [];
    const nextMonthBillItems: UpcomingSnapshotItem[] = [];

    if (this.creditBillService) {
      const allDueBills = await this.creditBillService.getBillsDueBefore(referenceDate, nextMonthEnd);
      for (const item of allDueBills) {
        const billItem: UpcomingSnapshotItem = {
          commitmentId: -(item.account.id * 1000000 + item.bill.year * 100 + item.bill.month),
          name: `${item.account.name} Bill`,
          dueDate: item.bill.dueDate,
          amountSen: item.bill.outstandingSen,
          frequency: 'monthly',
          kind: 'credit_bill',
          billAccountId: item.account.id,
          billYear: item.bill.year,
          billMonth: item.bill.month,
        };
        if (item.bill.dueDate <= thisMonthEnd) {
          thisMonthBillItems.push(billItem);
        } else if (item.bill.dueDate >= windowEnd && item.bill.dueDate <= nextMonthEnd) {
          nextMonthBillItems.push(billItem);
        }
      }
    }

    // DASH-2: category totals sorted by amount (engine, stable ties).
    const byCategory = expenseTotalsByCategory(spentRows, scope);
    const categorySummary: CategorySummaryItem[] = topCategories(
      byCategory,
      byCategory.size,
    ).map(([categoryId, totalSen]) => ({ categoryId, totalSen }));

    // Display names come from the DB rows (CommitmentLike is structural — no
    // name); stable map avoids deriving names off the downcast engine items.
    const nameById = new Map(commitments.map((c) => [c.id, c.name]));

    const upcomingItems: UpcomingSnapshotItem[] = [
      ...upcoming.items.map((item) => ({
        commitmentId: item.commitment.id,
        name: nameById.get(item.commitment.id) ?? String(item.commitment.id),
        dueDate: item.dueDate,
        amountSen: item.amountSen,
        frequency: item.commitment.frequency,
      })),
      ...thisMonthBillItems,
    ].sort(byDueDateAsc);

    const upcomingSen = upcomingItems.reduce((sum, item) => sum + item.amountSen, 0);

    const nextMonthItems: UpcomingSnapshotItem[] = [
      ...nextMonthCommitmentItems.map((item) => ({
        commitmentId: item.commitment.id,
        name: nameById.get(item.commitment.id) ?? String(item.commitment.id),
        dueDate: item.dueDate,
        amountSen: item.amountSen,
        frequency: item.commitment.frequency,
      })),
      ...nextMonthBillItems,
    ].sort(byDueDateAsc);

    const nextMonthSen = nextMonthItems.reduce((sum, item) => sum + item.amountSen, 0);

    return {
      month: { month, year },
      availableSen,
      spentSen,
      upcomingSen,
      upcomingItems,
      nextMonthSen,
      nextMonthItems,
      categorySummary,
      accountCount: accounts.length,
    };
  }
}
