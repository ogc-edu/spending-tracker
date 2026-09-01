# 007 — Monthly & Category Budgets

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002, 005 |
| **PRD** | §7.3 BUD-1..4; §8.4 (only the overall budget enters the cash-flow formula) |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 007 |

## Objective

Set an overall monthly budget and optional per-category budgets; see deterministic spent / remaining / percentage / over-budget state for each, with a clean editing UI. Category budgets are informational only — the overall budget is the one the cash-flow engine subtracts (PRD §8.4).

## Context

Budgets are rows keyed by `(user_id, category_id NULL-able, month, year)` with a UNIQUE constraint — editing a month replaces its row (upsert, A1/Drizzle, ARCH §4). Spending data comes from plan 005's engine totals (`monthlyTotals`, `expenseTotalsByCategory`). Everything local + offline.

## Requirements (PRD BUD-1..4)

- Set/replace an **overall** monthly budget per (month, year); set/replace per-**category** budgets; clear either.
- Per-budget metrics, always deterministic: amount, spent, remaining, percentage used, over-budget flag (`spent > amount`).
- Category budgets are informational (indicator rows); only the overall budget feeds cash flow (PRD §8.4).
- Remaining floors at 0 when spent exceeds the budget (BUD-4).
- Over-budget is an in-app flag (color + label) — **no push/system notifications** (PRD UI/UX: "useful warnings without excessive notifications").
- A month with no overall budget shows a "set a budget" prompt (PRD §8.4 assumes budget term 0).
- Editing/clearing past months is allowed (no retroactive restrictions).

## Technical Design

### Service + repository

```
BudgetService.upsert(userId, {categoryId: number|null, month, year, amountSen})  // REPLACE on unique key
BudgetService.clear(userId, {categoryId: number|null, month, year})               // DELETE row
BudgetService.overallFor(userId, month, year): Budget | null
BudgetService.forMonthWithCategories(userId, month, year): { overall, byCategory: Map<catId, Budget> }
```

`BudgetRepository` mirrors these (drizzle insert … onConflictDoUpdate on the unique key). All queries scoped by `userId` (A10).

### Metrics

`engine.budgetMetrics(budgetSen, spentSen) → { spent, remaining, pctUsed, overBudget }`

- `remaining = max(0, budget − spent)` (BUD-4)
- `pctUsed = floor(spent × 1000 / budget) / 10` — one decimal, integer-sen math (ARCH §6)
- `overBudget = spent > budget` (equality is *not* over)
- `remaining` when no budget set: `null` (UI shows "no budget")

### UI (Budgets tab)

- Month selector shared with uiStore (same month object as Analytics; default current month).
- Overall card: amount, spent/remaining, progress bar, over-budget state (danger color), tap to edit (RHF + Zod amount form, reuse `parseMoneyToSen` from 004).
- Category rows (12 seeds): each shows spent (005), budget amount (or "—"), progress bar, over-budget flag; tap to set/edit; "clear" action.
- Category budgets are independent of the overall budget (either can exist alone).
- Debt/Repayment category budget counts the auto-created D3 expenses like any other expense (no special casing).

## Files / Components Likely Affected

- `src/repositories/drizzle/budgetRepository.ts`, `src/repositories/types.ts` (BudgetRepository)
- `src/services/BudgetService.ts`
- `src/engine/budgets.ts` (`budgetMetrics`) + tests
- `app/(tabs)/budgets.tsx` (replaces placeholder), `src/components/BudgetCard.tsx`, `BudgetRow.tsx`, `BudgetForm.tsx`, `ProgressBar.tsx` (shared with Dashboard 010)

## API Changes

Internal: `BudgetService.{upsert, clear, overallFor, forMonthWithCategories}`, engine `budgetMetrics`.

## Database Changes

None (schema from 002: `budgets` with UNIQUE(user_id, category_id, month, year)).

## Dependencies

002 (schema/harness), 005 (monthly & category totals).

## Decisions (confirmed defaults — no open questions)

- In-app over-budget flags only; no notifications (PRD).
- Past-month editing allowed; no rollover of unused budget (out of scope).
- Clearing a budget deletes its row (no zero-as-sentinel).

## Edge Cases

- Spent == budget → not over-budget; spent == budget+1 → over (boundary tested).
- No overall budget → remaining null; cash flow treats it as 0 (PRD §8.4) — dashboard prompt in 010.
- Month rolls over (uiStore default follows device calendar) → fresh month shows no budgets → "set a budget" prompts.
- Clear + re-set in the same month → row replaced, no duplicates.
- Category deleted (future feature) — FK blocks budget rows; not reachable in MVP.

## Security Considerations

- Local data only; user-scoped queries; Zod validation on amounts (sen, >0).

## Tests

- `budgetMetrics`: fixtures for 0/partial/exact/over spent; pct rounding (`floor` at 1 decimal); remaining floor at 0; equality boundary.
- BudgetRepository upsert: insert → replace same key → no dup rows; clear removes; user isolation (two users, same month → separate rows).
- Month/category scoping: budgets for other months don't leak into the month query.

## Acceptance Criteria

1. Set an overall budget and category budgets; both persist and survive restart.
2. Metrics match hand-computed fixtures (amount/spent/remaining/pct/over) for each state incl. over-budget.
3. Clearing works; editing a month replaces, never duplicates.
4. Category budgets act independently of the overall budget; no notifications anywhere.
5. `npm test`, typecheck, lint green.

## Out of Scope

Rollover/carry-over, budget templates, yearly budgets, notifications, income-side budgets.