/**
 * CashFlowService (plan 010 / ARCHITECTURE §8 pipeline) — the ONLY
 * orchestrator behind the dashboard. `snapshot(now)` reads the same rows the
 * other tabs show and pushes them through the pure engine (009); the screen
 * renders the result with NO arithmetic of its own (ARCH §1, NFR-7).
 *
 * Pipeline (ARCH §8):
 *   available = AccountRepository.sumBalances        (credit-card owed negative)
 *   spent     = ExpenseRepository.listForMonth → engine.monthlyTotals
 *   budget    = BudgetRepository.overallFor          (null = none set)
 *   remaining = budget ? max(0, budget − spent) : 0  (D2 — spent term cancels)
 *   upcoming  = engine.upcomingCommitments(active, paid, nextMonthStart)  (008)
 *   buffer    = SettingsRepository.buffer            (default RM300, SET-1)
 *   safe      = engine.safeToSpend(...)              (may be negative → deficit)
 *   daily     = engine.dailyAllowance(safe, today, monthEnd)
 *   breakdown = engine.cashFlowBreakdown(...)        (Σ = safe — the formula card)
 *   summary   = engine.expenseTotalsByCategory → topCategories (DASH-2)
 *
 * The snapshot is typed and serializable — it doubles as the AI allowance
 * payload in 015 (aggregates + category ids only; no free-text descriptions).
 * `now` is derived by the caller at call time (focus refresh / pull-to-
 * refresh), so the calendar rolls over without restart (A4: no caching).
 */
import { topCategories } from '@/engine/analytics';
import { budgetMetrics, type BudgetMetrics } from '@/engine/budgets';
import {
  cashFlowBreakdown,
  dailyAllowance,
  safeToSpend,
  type CashFlowBreakdownItem,
} from '@/engine/cashflow';
import { upcomingCommitments, type CommitmentLike } from '@/engine/commitments';
import { expenseTotalsByCategory, monthlyTotals } from '@/engine/totals';
import type { Budget } from '@/db/schema';
import type {
  AccountRepository,
  BudgetRepository,
  CommitmentRepository,
  ExpenseRepository,
  SettingsRepository,
} from '@/repositories/types';
import { monthEndDate, nextMonthStartDate, toLocalDateString } from '@/utils/dates';
import type { CurrentUserSource } from './AccountService';

/** One upcoming slot, shaped for the dashboard list (name from the DB row). */
export interface UpcomingSnapshotItem {
  commitmentId: number;
  /** Commitment display name (COM-1 label). */
  name: string;
  /** `YYYY-MM-DD` — the derived due date (ARCH §7). */
  dueDate: string;
  amountSen: number;
  /** 'monthly' | 'one_time' — plan 017: drives the row's leading glyph. */
  frequency: 'monthly' | 'one_time';
}

/** One row of the category summary (DASH-2) — id + total; names resolved by the UI. */
export interface CategorySummaryItem {
  categoryId: number;
  totalSen: number;
}

/**
 * The full deterministic dashboard view (PRD DASH-1..5). Every number is
 * engine-computed; nulls are absent data (no budget / no accounts), never
 * errors.
 */
export interface CashFlowSnapshot {
  /** The current calendar month scope (derived from `now`, device-local). */
  month: { month: number; year: number };
  /** Σ account balances; credit-card owed counts negative (PRD §8.4). */
  availableSen: number;
  /** Σ expenses dated in `month` — paid commitment payments included (D3). */
  spentSen: number;
  /** The month's overall budget row, or null when unset (UI: "—" + prompt). */
  budget: Budget | null;
  /** `budget !== null` — drives the "Set a budget" prompt. */
  hasBudget: boolean;
  /** max(0, budget − spent) with a budget, else 0 (D2 — the formula term). */
  remainingSen: number;
  /** Σ unpaid payment amounts due before next month start (008, PRD COM-5). */
  upcomingSen: number;
  /** The upcoming slots, due-date ascending — the dashboard's "next 3" list. */
  upcomingItems: UpcomingSnapshotItem[];
  /** The safety buffer term (SET-1; default RM300 until edited). */
  bufferSen: number;
  /** available − upcoming − remaining − buffer; MAY be negative (deficit). */
  safeSen: number;
  /** `safeSen < 0` — first-class UI state, never styled as success. */
  deficit: boolean;
  /** floor(safe / days remaining incl. today) — hidden ("—") on deficit. */
  dailyAllowanceSen: number;
  /** Signed, labelled terms summing to safeSen (DASH-3 formula card / 015). */
  breakdown: CashFlowBreakdownItem[];
  /** Category totals for the month, descending by amount (DASH-2). */
  categorySummary: CategorySummaryItem[];
  /** Budget-bar metrics (007) — pct null when no budget. */
  budgetMetrics: BudgetMetrics;
  /** Account count — 0 drives the empty-accounts CTA (plan §Edge cases). */
  accountCount: number;
}

/** Sort upcoming slots by due date ascending — stable ties keep input order. */
function byDueDateAsc(a: { dueDate: string }, b: { dueDate: string }): number {
  return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
}

export class CashFlowService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly expenses: ExpenseRepository,
    private readonly budgets: BudgetRepository,
    private readonly commitments: CommitmentRepository,
    private readonly settings: SettingsRepository,
    private readonly auth: CurrentUserSource,
  ) {}

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

    const [availableSen, accounts, spentRows, budget, commitments, paidPayments, bufferSen] =
      await Promise.all([
        this.accounts.sumBalances(userId),
        this.accounts.list(userId),
        this.expenses.listForMonth(userId, year, month),
        this.budgets.overallFor(userId, month, year),
        this.commitments.list(userId),
        this.commitments.paidPayments(userId),
        this.settings.buffer(userId),
      ]);

    const spentSen = monthlyTotals(spentRows, scope);
    // D2: the budget term is max(0, budget − spent); 0 when no budget is set.
    const remainingSen = budget ? Math.max(0, budget.amountSen - spentSen) : 0;

    // 008: unpaid slots due before the start of next month (overdue included).
    const windowEnd = nextMonthStartDate(year, month);
    // Repository rows ARE engine CommitmentLike (structural); the DB type's
    // `text` columns (frequency/status) are `string`, so the boundary cast to
    // the engine's narrower literal-union shape is expected (not a bug to fix).
    const upcoming = upcomingCommitments(
      commitments as CommitmentLike[],
      paidPayments,
      windowEnd,
    );

    const safe = safeToSpend({
      availableSen,
      upcomingSen: upcoming.totalSen,
      remainingBudgetSen: remainingSen,
      bufferSen,
    });

    const today = toLocalDateString(now);
    const daily = dailyAllowance(safe.safeSen, today, monthEndDate(year, month));
    const breakdown = cashFlowBreakdown({
      availableSen,
      upcomingSen: upcoming.totalSen,
      remainingBudgetSen: remainingSen,
      bufferSen,
    });

    // DASH-2: category totals sorted by amount (engine, stable ties).
    const byCategory = expenseTotalsByCategory(spentRows, scope);
    const categorySummary: CategorySummaryItem[] = topCategories(
      byCategory,
      byCategory.size,
    ).map(([categoryId, totalSen]) => ({ categoryId, totalSen }));

    // Display names come from the DB rows (CommitmentLike is structural — no
    // name); stable map avoids deriving names off the downcast engine items.
    const nameById = new Map(commitments.map((c) => [c.id, c.name]));

    return {
      month: { month, year },
      availableSen,
      spentSen,
      budget,
      hasBudget: budget !== null,
      remainingSen,
      upcomingSen: upcoming.totalSen,
      upcomingItems: upcoming.items
        .map((item) => ({
          commitmentId: item.commitment.id,
          name: nameById.get(item.commitment.id) ?? String(item.commitment.id),
          dueDate: item.dueDate,
          amountSen: item.amountSen,
          frequency: item.commitment.frequency,
        }))
        .sort(byDueDateAsc),
      bufferSen,
      safeSen: safe.safeSen,
      deficit: safe.deficit,
      dailyAllowanceSen: daily,
      breakdown,
      categorySummary,
      budgetMetrics: budgetMetrics(budget?.amountSen ?? null, spentSen),
      accountCount: accounts.length,
    };
  }
}
