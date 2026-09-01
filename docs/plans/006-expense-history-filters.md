# 006 — Expense History, Search & Filters

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 005 |
| **PRD** | §7.2 EXP-4..6 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 006 |

## Objective

The Expenses tab becomes useful: chronological history with detail view, real search and filters (category, date range), and a totals bar for the filtered period — all with proper empty states and offline operation.

## Context

005 made recording possible; this plan makes history browsable and answerable ("what did I spend on transport in June?"). All data is local — filtering is SQL predicates, and totals come from the engine over the filtered set (PRD EXP-6).

## Requirements

- Chronological list, newest first, with day-grouping headers (nice-to-have) and batch pagination ("load more", 50/batch).
- Detail view per expense (amount, category, description, date, account) with Edit / Delete actions (Edit routes to 005's form; delete reuses 005's service incl. E7 semantics).
- Search: case-insensitive substring on description.
- Filter by category (multi? **single-select in MVP** — decision F1, pending).
- Filter by date range: presets (Today, This Week, This Month, Last Month, All) + custom from/to.
- Totals bar: sum of the visible filtered set, always displayed, updates with every filter change.
- Empty states: no expenses at all; no results for the active filters.
- Default view: current month (matches dashboard); one tap clears to All.

## Technical Design

### Repository query: `expenseRepository.query(filter)` + `sum(filter)`

```ts
interface ExpenseFilter {
  search?: string;          // LIKE '%...%' escape %, _ 
  categoryId?: number;
  from?: LocalDate;         // inclusive
  to?: LocalDate;           // inclusive
  limit?: number; offset?: number;
}
query(filter): Expense[]          // ORDER BY date DESC, id DESC
sum(filter): MoneySen             // COUNT + SUM in the same predicate set
```

One SQL builder, one predicate function — query and sum can never disagree (single source of predicates; tested).

### UI

- `app/(tabs)/expenses.tsx`: filter bar (search input, category chip, period chip), FlatList (50/batch, onEndReached), totals bar pinned at top under the filter bar, empty-state component.
- Category filter: horizontal chip row (All + 12 categories) — single-select.
- Period: dropdown/presets + custom picker (two date inputs) — custom range via a small calendar sheet or native picker (implementation detail; week starts Monday, local calendar).
- `app/expenses/[id].tsx`: detail screen with edit/delete (delete → confirm dialog → 005 service → pop + refresh).
- Zustand `filterStore` (or uiStore): search term, category, period, offset — kept in state so returning from edit keeps context.
- Debounce search input (300 ms) before querying.
- Refresh on focus (`useFocusEffect`) so edits/deletes elsewhere show up — SQLite is source of truth (A4).

## Files / Components Likely Affected

- `src/repositories/drizzle/expenseRepository.ts` (query + sum), `src/repositories/types.ts` (ExpenseFilter)
- `app/(tabs)/expenses.tsx`, `app/expenses/[id].tsx`
- `src/components/FilterBar.tsx`, `ExpenseList.tsx`, `ExpenseRow.tsx`, `EmptyState.tsx`, `PeriodPicker.tsx`
- `src/store/uiStore.ts` (filter state)

## API Changes

Internal: `ExpenseRepository.query/sum`, `ExpenseService.listFiltered(…)`.

## Database Changes

None (indexes on `date`/`category_id` exist from 002).

## Dependencies

005 (service, engine totals, edit route).

## Decisions

- **F1 — category filter cardinality: single-select (confirmed 2026-09-01)** — chips, one category at a time; composes with search + period.
- (Minor, confirmed defaults): period presets list, day-grouping, batch size 50, debounce 300 ms.

## Edge Cases

- `%`/`_` in search text must be escaped (LIKE wildcards).
- Case-insensitivity: SQLite `LIKE` is ASCII-case-insensitive by default — fine for English MVP.
- Filter + pagination: offset applies to the *filtered* set; reset to 0 on any filter change.
- Empty search + no filters = all (paginated); "All" period = no date predicate.
- Deleting the currently-open expense → pop to list, totals refresh.
- Date range with empty middle (gap): list simply shows nothing in between; totals match the gap.
- Custom range where `from > to` → Zod reject on the picker.

## Security Considerations

- Local queries only; no network. LIKE-escaping is correctness, not injection risk (parameterized queries throughout).

## Tests

- Predicate composition: search+category+range combined vs hand-picked fixture rows; boundary inclusivity (from=to returns that day); sum == engine total over the same rows.
- Pagination: batches return distinct, ordered, complete coverage; offset resets per filter.
- LIKE escaping: literal `%` in description matches only itself.
- Empty states: zero rows → empty-all; rows exist but filter misses → empty-filtered.

## Acceptance Criteria

1. History loads newest-first with load-more; detail opens with Edit/Delete working (delete honors 005 E7).
2. Search, category, and period filters each work alone and composed; totals bar matches the filtered engine sum.
3. Default view is current month; clearing to All shows everything.
4. Empty states render for both empty cases; offline works throughout.
5. `npm test`, typecheck, lint green.

## Out of Scope

- Multi-select filters, saved filter presets, exports/CSV, grouped chart in history, photo attachments.