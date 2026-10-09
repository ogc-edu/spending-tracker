# 004 — Expenses Feed Screen Redesign (Audit Ledger)

| | |
|---|---|
| **Status** | Completed |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 2) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 2: Expenses Feed, pp. 14–15) |
| **Target Files** | `src/app/(tabs)/expenses.tsx`, `src/components/ExpenseList.tsx`, `src/components/ExpenseRow.tsx`, `src/components/FilterBar.tsx` |

---

## 1. Objective

Upgrade the Expenses feed from a generic text list into an ergonomic **Audit Ledger** designed for rapid scanning and precision filtering. Introduce a single-axis horizontal filter dock, a sticky period summary strip, and daily grouped modular Bento card containers with hairline borders, circular icon containers, tabular typography, and swipe-to-action interactions.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  SEARCH & HORIZONTAL FILTER DOCK (Sticky Top)          │
│  [ Search payee/notes... (testID="expense-search-input")│
│  (Today) (This Week) (This Month) (Last Month) (Custom)│
│  [ Category Chips with Glyphs ] [ Account Dropdown ]   │
├────────────────────────────────────────────────────────┤
│  PERIOD SUMMARY STRIP (Hairline border-b)              │
│  Total Spent: RM 1,420.50          Count: [ 34 txns ]  │
│  (testID="period-summary-strip")                       │
├────────────────────────────────────────────────────────┤
│  DAILY GROUPED CARDS (testID="expenses-list")          │
│  ┌─ October 6, 2026 ──────────────── RM 142.00 ──────┐ │
│  │ ◯ Grab Car                   -RM 24.50           │ │
│  │   12:30 PM • Transport • Maybank                  │ │
│  │ ──────────────────────────────────────────────── │ │
│  │ ◯ Netflix  [Linked Commitment] -RM 45.00          │ │
│  │   09:00 AM • Entertainment • Touch 'n Go          │ │
│  └──────────────────────────────────────────────────┘ │
│  ┌─ October 5, 2026 ──────────────── RM 88.00 ───────┐ │
│  │ ...                                               │ │
│  └──────────────────────────────────────────────────┘ │
│                                                 [ + ]  │
└────────────────────────────────────────────────────────┘
```

### 2.1 Search & Filter Dock
- Replaces dense multi-row button controls with an integrated search bar and single horizontal carousel.
- Includes date presets: `Today`, `This Week`, `This Month`, `Last Month`, `Custom Date`.
- Category chips with icon glyphs and payment account selector.
- Enforces minimum 44px touch targets.

### 2.2 Period Summary Strip
- Framed with hairline border (`border-b border-border/60`).
- Left: Aggregated total expenditure rendered with `MoneyDisplay` (`testID="expenses-total"`).
- Right: Active transaction count badge via `StatusPill` / `Badge` (`testID="expenses-total-count"`).
- Container tagged with `testID="period-summary-strip"` and `testID="expenses-totals-bar"`.

### 2.3 Daily Grouped Bento Cards
- Group transactions into daily card containers (`BentoCard`) rather than flat text lists.
- **Date Header**: Displays formatted date string on the left, daily total sum on the right (rendered with `MoneyDisplay` `size="sm"`).
- **Transaction Rows (`testID="expense-row-{id}"`)**:
  - Minimum 48px touch target (`TouchTarget`).
  - Separated by hairline borders (`border-b border-border-subtle`).
  - **Left**: 40px circular category icon container with category-specific tinted background.
  - **Center**: Primary payee/note label (`text-base font-semibold`), accompanied by metadata (`text-xs font-medium text-muted-foreground` for timestamp, category, and payment account).
  - **Right**: Formatted deduction amount (e.g. `-RM 24.50`) rendered with `MoneyDisplay`.
  - **Auto-generated transactions**: Render an outline pill tag: `Linked Commitment`.
  - **Interactions**: Tapping navigates to `/expenses/[id]`; swipe actions expose edit and delete triggers.
  - Pinned Floating Action Button (`+ Add Expense`) in the lower right.

---

## 3. Preserved Test Contracts & IDs

| Target Screen / Element | Preserved `testID` | Contract / Fallback IDs |
|---|---|---|
| Search Input | `testID="expense-search-input"` | — |
| Period Summary Strip | `testID="period-summary-strip"` | `testID="expenses-totals-bar"`, `expenses-total`, `expenses-total-count` |
| Grouped Expenses List | `testID="expenses-list"` | `testID="expense-list"` |
| Transaction Row | `testID="expense-row-{id}"` | — |
| Expenses Screen Container | `testID="expenses-screen"` | — |
| Filter Bar Container | `testID="expense-filter-bar"` | — |
| Empty Filtered State | `testID="expenses-empty-filtered"` | — |
| Empty All State | `testID="expenses-empty"` | — |
| Add Expense FAB | `testID="add-expense-fab"` | — |

---

## 4. Invariants & Guardrails

- **Zero arithmetic on screen**: Date grouping and sums use pure utils (`src/utils/money.ts`, `src/utils/dates.ts`).
- **Domain Engine Immutability**: No changes to `src/engine/*`.
- **Linked Commitment Edits**: Expenses linked to commitments maintain immutable markers (no inline delete without unlinking).

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Expenses Screen and FilterBar
npm test -- src/app/__tests__/expense src/components/__tests__/
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 004 — Expenses Feed Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/expenses.tsx`
  - `src/components/ExpenseList.tsx`
  - `src/components/ExpenseRow.tsx`
  - `src/components/FilterBar.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="expense-search-input"
  - [x] testID="period-summary-strip"
  - [x] testID="expenses-list"
  - [x] testID="expense-row-{id}"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Audit Ledger and Daily Grouped Cards operational with tabular currency rendering.
```
