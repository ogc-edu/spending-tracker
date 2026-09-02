/**
 * Plan 014 — SpendingSnapshot → AI spending payload mapping ("Analyze my
 * spending").
 *
 * Pure field mapping of the ALREADY-COMPUTED analytics snapshot (011): the AI
 * receives exactly what the Analytics screen renders (same month, same
 * numbers — no recomputation, no drift; the screen captures this mapping at
 * tap time). The AI snapshot is validated by the 012 facade schema, extended
 * in 014 with `monthLabel`/`projectionSen`/`utilization` — the budget-pressure
 * and pace context AN-5 needs (the prompt only references supplied values).
 *
 * A6 hygiene: category names + amounts only — free-text expense descriptions
 * never cross this boundary (the analytics snapshot already strips them).
 */
import type { SpendingSnapshot as AISpendingSnapshot } from '@/ai/types';
import type { SpendingSnapshot as AnalyticsSpendingSnapshot } from './AnalyticsService';

/** Map the analytics snapshot onto the AI spending payload. */
export function toSpendingSnapshot(snapshot: AnalyticsSpendingSnapshot): AISpendingSnapshot {
  return {
    month: monthKey(snapshot.month),
    monthLabel: snapshot.monthLabel,
    totalSen: snapshot.totalSen,
    previousTotalSen: snapshot.previousMonth.totalSen,
    changeSen: snapshot.changeSen,
    changePct: snapshot.changePct,
    avgDailySen: snapshot.avgDailySen,
    projectionSen: snapshot.projectionSen,
    utilization:
      snapshot.utilization === null
        ? null
        : {
            pct: snapshot.utilization.pct,
            overBudget: snapshot.utilization.overBudget,
          },
    topCategories: snapshot.topCategories.map((category) => ({
      name: category.categoryName,
      amountSen: category.amountSen,
    })),
    // Largest expenses stay per-expense (category name + amount), description-stripped.
    largest: snapshot.largest.map((largest) => ({
      name: largest.categoryName,
      amountSen: largest.amountSen,
    })),
  };
}

/** `{month, year}` → the schema's `YYYY-MM` key (zero-padded). */
function monthKey(scope: { month: number; year: number }): string {
  return `${scope.year}-${String(scope.month).padStart(2, '0')}`;
}