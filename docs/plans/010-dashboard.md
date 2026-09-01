# 010 — Dashboard

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 009, 005, 007, 008 |
| **PRD** | §7.1 DASH-1..5; §7.10 (no separate Cash Flow tab) |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 010 |

## Objective

The dashboard is the product's heart: one deterministic view of **available money, spent this month, budget/remaining, upcoming commitments, safe-to-spend, daily allowance, and the category summary** — with an expandable formula breakdown (DASH-3), a deficit state, and the "Explain my allowance" entry point (wired in 015).

## Context

All numbers are computed on demand by `CashFlowService.snapshot(now)` (A2): repositories feed rows, the engine (009) computes, the screen renders. The exact formula and its properties are PRD §8.4 — including the fact that **safe-to-spend is constant across the month** and **can be negative** (the deficit state is a first-class UI concern, never a number styled as success).

## Requirements (PRD DASH-1..5)

- Show for the current calendar month: available, spent, monthly budget, remaining budget, upcoming commitments (unpaid, due before next month start), safe-to-spend, daily allowance.
- Category summary for the month, sorted by amount (top 5 + "Other" or full list — UI choice below).
- Expandable **formula card**: Available − Upcoming commitments − Remaining budget − Safety buffer = Safe-to-spend, with each component labelled — also the surface for "Explain my allowance" (015).
- Deterministic: snapshot is pure computation of the same rows the other tabs show; refreshes on focus and pull-to-refresh.
- **Deficit state** (safe < 0): danger styling, explicit copy ("Cover commitments + buffer before discretionary spending"), daily allowance hidden or shown as "—" rather than a negative number.
- No overall budget set → remaining shows "—" + "Set a budget" prompt linking to Budgets (PRD §8.4: budget term 0; prompt per PRD).
- Empty account list → CTA to create accounts (Settings/004).

## Technical Design

### CashFlowService.snapshot(now) — the only orchestrator

```
availableSen       = AccountRepository.sumBalances(userId)                 // 004 (credit negative)
spentSen           = ExpenseRepository.sumByMonth(userId, month)           // 005
budget             = BudgetRepository.overallFor(userId, month, year)      // 007
remainingSen       = budget ? max(0, budget - spent) : 0                   // 007/009
upcomingSen, items = upcomingCommitments(active, paid, nextMonthStart)     // 008
bufferSen          = SettingsRepository.buffer(userId)                      // default RM300 (PRD SET-1)
{safeSen, deficit} = engine.safeToSpend({available, upcoming, remaining, buffer})   // 009
daily              = engine.dailyAllowance(safeSen, today, monthEnd)                // 009
breakdown          = engine.cashFlowBreakdown(...)                                   // 009
categorySummary    = engine.expenseTotalsByCategory(spentRows, month)                // 005/009
```

`settings` table: this plan introduces a tiny `settings` key-value table (or a `user_settings` row per user) holding `safety_buffer_sen` — implemented here (Settings UI for it lands in 016 polish; PRD SET-1). **Schema addition**: `settings (user_id PK/FK, safety_buffer_sen, updated_at)` — migration 0002, seeded default 30000 sen.

### Screen composition

```
DashboardScreen
├── Hero card        available (money font), spent-this-month, remaining budget row
├── Safe-to-spend    headline number + daily allowance chip (RM X/day)
├── Formula card     expandable: 4 component rows + = safe; "Explain my allowance" button (015)
├── Upcoming         next 3 commitments + total-due-before-next-month line (008 items)
├── Budget bar       spent vs budget progress (007 metrics)
└── Category summary 5 rows + "Show all" (→ Analytics 011)
```

Refresh: `useFocusEffect` re-query + `RefreshControl` pull-to-refresh. No caching (A4).

## Files / Components Likely Affected

- `src/services/CashFlowService.ts` (new)
- `src/services/SettingsService.ts` + `src/repositories/drizzle/settingsRepository.ts` (new, minimal)
- `src/db/schema.ts` — `settings` table (migration 0002)
- `app/(tabs)/index.tsx` (replaces placeholder), `src/components/dashboard/*` (HeroCard, SafeToSpendCard, FormulaCard, UpcomingList, CategorySummary)
- `src/engine/__tests__/cashflow.integration.test.ts` (snapshot assembly over harness DB)

## API Changes

Internal: `CashFlowService.snapshot(now: Date) → CashFlowSnapshot` (typed, serializable — doubles as the AI allowance payload in 015), `SettingsService.{getBuffer, setBuffer}`.

## Database Changes

New `settings` table (user-scoped, seeded with 30000 sen = RM300). Migration 0002.

## Dependencies

009 (engine), 005 (spent/accounts-driven totals), 007 (budgets), 008 (upcoming). Settings UI is 016; the service default here is enough.

## Decisions (confirmed defaults — no open questions)

- Category summary: top 5 rows + "Show all" (clean, low-clutter per PRD).
- Daily allowance primary; no weekly figure in the MVP (DASH-1 lists daily).
- Pull-to-refresh + focus refresh; no auto-polling/timers.
- Deficit state hides the daily chip (negative allowance is meaningless as advice) and shows the warning copy instead.

## Edge Cases

- First day of month (30 days → allowance = floor(safe/30)); last day (1 day).
- New month rollover: focus refresh recomputes with the new window automatically.
- No accounts → available 0 → safe = −(upcoming+budget+buffer) → deficit state + "create accounts" CTA (not a crash).
- No budget → remaining "—" + prompt; budget term 0 in math.
- Upcoming empty → show "Nothing due before next month" (not an error).
- Refresh racing a mark-paid transaction → snapshot reads after commit (serialized by SQLite; no stale cache to worry about).

## Security Considerations

- Read-only aggregation; user-scoped; no data leaves the device (AI only via 015's explicit action).

## Tests

- Snapshot integration over harness DB: mixed fixture (accounts incl. credit, expenses, budget, commitments) → exact PRD §8.4 example numbers; deficit fixture; empty-DB fixture; buffer default vs custom.
- Settings: default 30000; upsert; user isolation.
- Formula card data (`cashFlowBreakdown`) sums back to safe.

## Acceptance Criteria

1. Dashboard shows all DASH-1/2 values for the current month, deterministic and matching engine fixtures.
2. Formula card expands to the 4 components; numbers match PRD §8.5 order of operations.
3. Deficit state renders the warning, never a green negative.
4. Refresh on focus/pull; new month rolls over without restart.
5. DoD items 1, 9, 10, 11, 12, 16 (offline) verifiable on-device.
6. `npm test`, typecheck, lint green.

## Out of Scope

Weekly allowance, charts, notifications, budgeting actions (→ Budgets tab), AI explanation (015), buffer editing UI (016), multi-month navigation (011).