/**
 * Plan 019 — CashFlowSnapshot → AskSnapshot mapping for the dashboard
 * "Ask about your money" box.
 *
 * Pure field mapping of the ALREADY-COMPUTED dashboard snapshot (010): the AI
 * never recalculates anything, so this must not either — every number is
 * copied straight from the snapshot, plus:
 *  - `nextMonth` slots (the snapshot derives them from the same rows);
 *  - category NAMES for the current month's spend totals.
 *
 * Hygiene (A6): commitment names and category names are aggregate labels, not
 * expense descriptions — no raw `expenses.description` ever enters the payload.
 */
import type { AskSnapshot } from '@/ai/types';
import type { Category } from '@/db/schema';
import { formatMonthLabel } from '@/utils/dates';
import type { CashFlowSnapshot, UpcomingSnapshotItem } from './CashFlowService';

/** Project an upcoming slot down to the AI-safe shape (drops ids/frequency). */
function toAskCommitments(items: UpcomingSnapshotItem[]): AskSnapshot['nextMonth'] {
  return items.map((item) => ({
    name: item.name,
    dueDate: item.dueDate,
    amountSen: item.amountSen,
  }));
}

/**
 * Map the dashboard's CashFlowSnapshot onto the ask payload.
 * `categories` resolve the summary's ids to names — a dangling id (category
 * deleted after use) renders as "Uncategorized" rather than breaking the AI
 * boundary.
 */
export function toAskSnapshot(snapshot: CashFlowSnapshot, categories: Category[]): AskSnapshot {
  const { month, year } = snapshot.month;
  const nameById = new Map(categories.map((category) => [category.id, category.name]));

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    monthLabel: formatMonthLabel(year, month),
    availableSen: snapshot.availableSen,
    spentSen: snapshot.spentSen,
    upcomingThisMonthSen: snapshot.upcomingSen,
    upcomingThisMonth: toAskCommitments(snapshot.upcomingItems),
    nextMonthSen: snapshot.nextMonthSen,
    nextMonth: toAskCommitments(snapshot.nextMonthItems),
    topCategories: snapshot.categorySummary.map((row) => ({
      name: nameById.get(row.categoryId) ?? 'Uncategorized',
      amountSen: row.totalSen,
    })),
  };
}
