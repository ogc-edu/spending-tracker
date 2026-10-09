# 005 — Budgets Manager Screen Redesign (Allocations Grid)

| | |
|---|---|
| **Status** | Completed |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 3) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 3: Budgets Manager, pp. 15–16) |
| **Target Files** | `src/app/(tabs)/budgets.tsx`, `src/components/BudgetCard.tsx`, `src/components/BudgetRow.tsx`, `src/components/BudgetForm.tsx` |

---

## 1. Objective

Redesign the Budgets Manager into a visual allocation control dashboard featuring an accessible calendar cycle stepper, a high-contrast **Overall Monthly Budget Bento Card** equipped with multi-stage dynamic threshold color shifting, a **Two-Column Category Allocations Grid** across all 12 categories, and a native gesture-driven **Budget Limit Sheet** with quick percentage presets.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  CYCLE STEPPER:  <  October 2026  >                    │
├────────────────────────────────────────────────────────┤
│  OVERALL MONTHLY BUDGET BENTO CARD                     │
│  (testID="budget-overall-card")                        │
│  - Total Spent: RM 1,420.00 / Target Cap: RM 3,000.00  │
│  - Multi-tier BudgetMeter:                             │
│    [==========                  ] 47% (Electric Mint)  │
│  - Remaining Pool: RM 1,580.00                         │
│  - Remaining Daily Buffer: RM 60.77/day (S_safe/D_rem) │
├────────────────────────────────────────────────────────┤
│  TWO-COLUMN CATEGORY ALLOCATIONS GRID (12 categories)  │
│  ┌───────────────────────┐  ┌────────────────────────┐ │
│  │ 🍔 Food & Dining      │  │ 🚗 Transport           │ │
│  │ RM 450 / RM 600       │  │ RM 180 / RM 200        │ │
│  │ [=========  ] 75%     │  │ [===========] 90% (Amb)│ │
│  │ (category-card-{id})  │  │ (category-card-{id})   │ │
│  ├───────────────────────┤  ├────────────────────────┤ │
│  │ 🎬 Entertainment      │  │ ⚡ Utilities           │ │
│  │ RM 250 / RM 200       │  │ No limit set           │ │
│  │ [Over by RM 50] (Rose)│  │ [ + Set limit ]        │ │
│  └───────────────────────┘  └────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 2.1 Overall Monthly Budget Card
- Framed with hairline borders (`BentoCard`), tagged with `testID="budget-overall-card"`.
- Features multi-tier `BudgetMeter.tsx`:
  - **Spending < 80%**: Electric Mint (`#10B981`)
  - **Spending 80% – 99%**: Warning Amber (`#F59E0B`)
  - **Spending ≥ 100%**: Destructive Rose (`#F43F5E`) with "Over budget" alert badge indicating excess amount.
- Displays:
  - Total Spent vs Budget Target via `MoneyDisplay`
  - Remaining funds
  - Daily buffer calculation ($S_{\text{safe}} / D_{\text{rem}}$)

### 2.2 Two-Column Category Allocations Grid
- Arranged in an asymmetric 2-column grid covering all 12 system categories.
- Each tile (`testID="category-card-{id}"`):
  - 48px minimum touch target.
  - Category icon with category color token.
  - Current spend vs target limit cap.
  - Category-specific `BudgetMeter`.
  - Unset categories present a clear `Set limit` action.
  - Exceeded categories show a crimson alert pill: `Over by RM XX.XX`.
  - Tapping a tile triggers the **Budget Limit Sheet**.

### 2.3 Budget Limit Entry Sheet
- Native gesture-driven bottom sheet (`Sheet.tsx`).
- Sen keypad input (`testID="category-limit-input"`, retaining `budget-form-amount`).
- Quick percentage allocation presets (`+10%`, `+25%`, `Reset`).
- Save / Delete confirmation buttons.

---

## 3. Preserved Test Contracts & IDs

| Element | Preserved `testID` | Additional Retained IDs |
|---|---|---|
| Overall Monthly Card | `testID="budget-overall-card"` | `budget-overall-over`, `budget-overall-progress`, `budget-overall-clear`, `budget-overall-empty` |
| Category Allocation Tile | `testID="category-card-{id}"` | `budget-row-{id}`, `budget-row-{id}-spent`, `budget-row-{id}-amount`, `budget-row-{id}-over`, `budget-row-{id}-progress` |
| Category Limit Input | `testID="category-limit-input"` | `budget-form-amount`, `budget-form`, `budget-form-submit`, `budget-form-cancel` |
| Screen Container | `testID="budgets-screen"` | — |
| Month Bar & Controls | `testID="budgets-month-bar"` | `budgets-month-prev`, `budgets-month-next`, `budgets-month-label` |
| Add Category Budget Action | `testID="budgets-add-category"` | `budgets-pick-category-{id}`, `budgets-category-picker-cancel` |

---

## 4. Invariants & Guardrails

- **Domain Engine Immutability**: `src/engine/budgets.ts` remains strictly untouched.
- **Integer Sen Handling**: All limits stored and manipulated in integer sen (`limit_sen`).
- **Zero Layout Shifts**: Metric values formatted with tabular monospace numerals.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Budgets
npm test -- src/app/__tests__/budget src/components/__tests__/budget
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 005 — Budgets Manager Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/budgets.tsx`
  - `src/components/BudgetCard.tsx`
  - `src/components/BudgetRow.tsx`
  - `src/components/BudgetForm.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="budget-overall-card"
  - [x] testID="category-card-{id}"
  - [x] testID="category-limit-input"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Budgets Manager upgraded to 2-column allocation grid with dynamic multi-tier meters.
```
