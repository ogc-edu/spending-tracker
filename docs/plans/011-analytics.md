# 011 — Analytics

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 009, 005, 007 (budget utilization) |
| **PRD** | §7.5 AN-1..4 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 011 |

## Objective

Deterministic spending analytics: current-month totals, category breakdown, month-over-month change, average daily spend, largest expenses, highest categories, budget utilization, and a basic projection — with a free month selector. The "Analyze my spending" AI action lands here in 014; this plan is the numbers.

## Context

Engine (009) provides all math; repositories provide the rows; AnalyticsService assembles a typed `SpendingSnapshot`. Comparison is always vs the previous calendar month (PRD AN-4). Everything local + offline.

## Requirements (PRD AN-1..4)

- Month selector: prev/next navigation, **no range limit** (any month with data reachable); defaults to the current month.
- Current-month total + category breakdown (sorted, with amounts).
- Month-over-month: absolute change + percentage change (`changePct: null` when previous month total is 0 → display "—").
- Average daily spending (to date within the month).
- Largest expenses (top 5) and highest-spending categories (top 5).
- Budget utilization: overall-budget pct used + over-budget flag for the selected month (from 007).
- Basic projection: `spent ÷ elapsedDays × daysInMonth` (engine 009), shown as "Projected end-of-month.
- "Analyze my spending" button (wired in 014): passes the typed snapshot only.

## Technical Design

### AnalyticsService.analyzePeriod(month) → SpendingSnapshot (typed, serializable — the 014 AI payload)

```
rows          = ExpenseRepository.byMonth(userId, month)                 // 005
prevRows      = ExpenseRepository.byMonth(userId, previousMonth)
budget        = BudgetRepository.overallFor(userId, month, year)        // 007
snapshot = {
  month, totalSen,
  breakdown: [{category, amountSen}] ,          // sorted desc
  previousMonth: {month, totalSen},
  changeSen, changePct | null,
  avgDailySen, largest: Expense[], topCategories: [{category, amountSen}],
  utilization: {pctUsed | null, overBudget} | null,
  projectionSen, elapsedDays, daysInMonth,
  monthLabel,
}
```

All fields computed through engine functions (009) — service contains no arithmetic.

### UI (Analytics tab)

- Header: month selector (‹ month ›) + total; MoM chip ("▼ RM240 (−11.4%)" / "▲ …" / "—").
- Category breakdown: rows with progress bars — **chart rendering per decision A3** (see Decisions): plain bar rows (zero deps) vs donut chart (chart lib).
- Stats grid: avg daily, largest expense, budget utilization, projection.
- "Analyze my spending" entry point (disabled-looking/absent until 014 lands? — button rendered, action stubbed with a clear "coming in 014" note during development).
- Empty state: "No expenses this month" + month navigation.

## Files / Components Likely Affected

- `src/services/AnalyticsService.ts`, `src/repositories/types.ts` (+ `byMonth`)
- `app/(tabs)/analytics.tsx` (replaces placeholder)
- `src/components/analytics/*` (MonthSelector, CategoryBreakdown, StatGrid, MoMChip)
- Chart component per A3

## API Changes

Internal: `AnalyticsService.analyzePeriod(month) → SpendingSnapshot`.

## Database Changes

None (indexes from 002 cover `byMonth`).

## Dependencies

009 (engine math), 005 (expense rows), 007 (overall budget for utilization).

## Decisions

- **A3 — category breakdown rendering: plain bar rows (confirmed 2026-09-01).** Horizontal progress bars built from Views — zero dependencies, consistent with the Dashboard, trivially testable.
- (Confirmed defaults, no question): no range limit on month navigation; comparison always vs previous calendar month; top-5 lists; projection floor from engine.

## Edge Cases

- Previous month total 0 → changePct null ("—"), changeSen = current total.
- No expenses at all: zeros + empty state; projection 0; no NaN (engine floors guard division).
- Month with no budget → utilization null ("no budget").
- Rapid month switching: queries are per-month and user-scoped; no cross-month leaking (tests).
- Leap February in fixtures.
- ElapsedDays = 0 on the 1st (0 spent) → avg 0, projection 0.

## Security Considerations

- Read-only local aggregation; snapshot is what 014 sends to AI (never raw expense rows with descriptions — A6).

## Tests

- `analyzePeriod` fixtures vs hand-computed: totals, breakdown order, MoM sign/abs/pct, null-pct case, avg, largest ties, utilization, projection across day-of-month fixtures.
- Service assembles engine outputs without re-arithmetic (spot inputs/outputs equality).
- Month isolation: two months' data don't bleed.

## Acceptance Criteria

1. Every PRD AN-1..4 number renders and matches engine fixtures; month selector navigates freely.
2. MoM with zero baseline shows "—"; over-budget reflects 007's flag.
3. Empty months render the empty state, not zeros-noise.
4. Snapshot type is the exact payload 014 will send (schema fixed here).
5. `npm test`, typecheck, lint green.

## Out of Scope

Charts beyond the chosen rendering, trend lines, income analytics, exports, drill-down per category (future), AI (014).