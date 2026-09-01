# 009 — Financial Calculation Engine

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002 (types only — parallelizable with 004–008) |
| **PRD** | §8.1–8.5; §11 test priorities |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 009 |

## Objective

Complete the **pure financial engine** with the two headline calculations — **safe-to-spend** and **daily allowance** (PRD §8.4) — plus the **analytics math** (monthly totals, MoM change, averages, largest, top categories, budget utilization, projection). All functions are pure (data + reference date in, numbers out), and the PRD §11 test suite lands here — the most heavily tested module in the app.

## Context

005 delivered `monthlyTotals`/`expenseTotalsByCategory`; 006 uses `sum`; 007 has `budgetMetrics`; 008 has `commitmentSchedule`/`upcomingCommitments`. This plan consolidates the rest and owns the **canonical formula** (D2, PRD §8.4), including its documented properties (spent term cancels; allowance rises daily; safe can go negative). The UI (010) and Analytics (011) consume these functions; AI (013–015) receives their output — the engine never sees AI.

## Requirements

- `safeToSpend({ availableSen, upcomingSen, remainingBudgetSen, bufferSen }) → { safeSen, deficit }` — exactly PRD §8.4: `safe = available − upcoming − remainingBudget − buffer`. `deficit = safeSen < 0`.
- `dailyAllowance(safeSen, today, monthEnd) → sen` — `floor(safe / days)` where days = calendar days from today **inclusive** through month end inclusive; `days = 0` → 0; negative safe returns negative allowance (UI decides presentation).
- `cashFlowBreakdown(...)` — the same inputs rendered as labelled components (Available / Upcoming commitments / Remaining budget / Safety buffer) for the Dashboard's expandable formula card (DASH-3) and AI allowance payload (015).
- Analytics math (PRD AN-1..4):
  - `monthTotals`, `categoryBreakdown` (from 005)
  - `monthOverMonth(current, previous) → { changeSen, changePct | null }` — pct null when previous is 0 (undefined change shown as "—")
  - `avgDaily(spent, elapsedDays)` — 0 when elapsedDays = 0
  - `largestExpenses(rows, n)`, `topCategories(breakdown, n)`
  - `budgetUtilization(spentSen, budgetSen | null) → { pct | null, overBudget }`
  - `projectMonthEnd(spent, elapsedDays, daysInMonth)` — `spent ÷ elapsedDays × daysInMonth`, floor to sen; 0 when elapsedDays = 0
- Documented invariants as code comments + tests: the spent term cancels in `safeToSpend`; expense set ⊥ unpaid-commitment set (PRD §8.3); every division floors deterministically (ARCH §6).

## Technical Design

```
src/engine/
├── totals.ts        (005)   monthlyTotals, expenseTotalsByCategory
├── budgets.ts       (007)   budgetMetrics
├── commitments.ts   (008)   commitmentSchedule, upcomingCommitments
├── cashflow.ts      (NEW)   safeToSpend, dailyAllowance, cashFlowBreakdown
├── analytics.ts     (NEW)   monthOverMonth, avgDaily, largestExpenses, topCategories, budgetUtilization, projectMonthEnd
└── __tests__/       (NEW)   cashflow.test.ts, analytics.test.ts, boundaries.test.ts, empty.test.ts
```

All take plain rows/numbers + an explicit `referenceDate`/`month {month, year}` — no `Date.now()`, no imports from db/services/ai (enforced by lint rule or review; ARCH §6).

Date helpers live in `utils/dates.ts` (local calendar only — no UTC conversions; device timezone is the calendar, PRD NFR-6): `daysInMonth`, `daysRemainingInMonthInclusive(today, monthEnd)`, `monthStart/End`, `isSameMonth`.

## Files / Components Likely Affected

- `src/engine/cashflow.ts`, `src/engine/analytics.ts` (+ tests)
- `src/utils/dates.ts` (+ tests)
- `src/types/` domain types (Month, LocalDate as `YYYY-MM-DD` string, MoneySen)

## API Changes

Internal only: engine functions listed above — consumed by CashFlowService (010) and AnalyticsService (011).

## Database Changes

None (pure module).

## Dependencies

002 (types only). Ready to implement in parallel with 004–008; wired by 010/011.

## Decisions (confirmed defaults — no open questions)

- Floor all divisions to the sen (conservative; ARCH §6).
- `days` includes today (PRD example: full month = 30 days).
- Analytics month-over-month is vs the previous calendar month only (PRD AN-4).
- Negative safe/allowance returned raw; presentation state (deficit) belongs to the UI.
- Pct change shows "—" (null) when the baseline is 0.

## Edge Cases & Boundary Tests (PRD §11)

- **Month boundaries**: last day (Sept 30 → allowance over 1 day); rollover (Oct 1 fresh window, prev month's totals isolated); leap February; year boundary (Dec → Jan).
- **Empty DB**: zero expenses/commitments → safe = available − buffer; allowance by days; analytics zeros; no NaN/Infinity (elapsedDays/daysInMonth never divide by zero).
- **Deficit**: available smaller than commitments+budget+buffer → negative safe + deficit flag; allowance negative.
- **Cancellation property**: fixture with varying spent shows safe unchanged (documents D2's constant-across-month behavior).
- **Disjointness**: paid payment expense + others — double-count regression: upcoming excludes paid; spent includes the expense exactly once.
- **Rounding**: 1,900,000 sen / 30 days → 63,333 → floor 63,333 sen (RM63.33)? — fixture asserts exact floor, no float drift (integer math only).

## Security Considerations

- None new: no I/O, no secrets. Pure arithmetic on integers.

## Tests (the PRD §11 suite)

cashflow (safe/allowance/deficit/cancellation), analytics (totals/breakdown/MoM/avg/largest/top/utilization/projection), boundaries (month/day/leap/year), empty DB, rounding matrix. Every fixture hand-computed. Target: >80 assertions across the suite.

## Acceptance Criteria

1. `safeToSpend` + `dailyAllowance` match PRD §8.4 exactly (fixtures incl. the RM60 example: 300-000-1840-300 → 60 with 30 days → 2/day).
2. Analytics functions match hand-computed fixtures; projection floor-correct.
3. No NaN/Infinity/negative-zero anywhere; no floats in money math.
4. Suite green under Jest; typecheck + lint green.
5. Engine imports only types/utils (enforced).

## Out of Scope

Anything stateful, scheduling, persistence, AI integration, UI.