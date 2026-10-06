# 003 — Dashboard Screen Redesign (Asymmetrical Bento Grid)

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 1) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 1: Dashboard, pp. 13–14) |
| **Target Files** | `src/app/(tabs)/index.tsx`, `src/components/dashboard/*` |

---

## 1. Objective

Transform the Dashboard from a symmetrical vertical stack of cards into an **Asymmetrical Bento Grid** cash flow intelligence hub. Center the experience around real-time daily discretionary allowance ($A_{\text{daily}}$) and total discretionary pool ($S_{\text{safe}}$), structured formula breakdowns, upcoming commitments countdown, dynamic budget snapshot, and contextual AI insights.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  HERO BENTO TILE                                       │
│  - Daily Allowance (text-5xl font-mono tabular-nums)   │
│  - Total Discretionary Pool (S_safe)                   │
│  - Status Badge: HEALTHY SURPLUS / TIGHT / DEFICIT     │
│  - Hairline perimeter (Electric Mint / Amber / Rose)   │
├──────────────────────────┬─────────────────────────────┤
│  MODULAR SPLIT LEFT      │  MODULAR SPLIT RIGHT        │
│  Cash Flow Equation      │  Upcoming Commitments       │
│  Liquid - Bills - Reserve│  Next 2 maturing bills      │
│  (Tap -> Breakdown Sheet)│  Quick-pay action button    │
├──────────────────────────┴─────────────────────────────┤
│  MONTHLY BUDGET SNAPSHOT                               │
│  Spent vs Target Progress with BudgetMeter.tsx         │
├────────────────────────────────────────────────────────┤
│  CONTEXTUAL AI DAILY INSIGHT / ASK AI CARD             │
│  On-device velocity analysis + Free-form inquiry       │
├────────────────────────────────────────────────────────┤
│  FLOATING ACTION DOCK                                  │
│  [ + Add Expense ]   [ Transfer ]   [ Scan Receipt ]   │
└────────────────────────────────────────────────────────┘
```

### 2.1 Hero Bento Tile
- **Primary Hero Metric**: Daily Discretionary Allowance ($A_{\text{daily}} = \frac{S_{\text{safe}}}{\max(1, D_{\text{rem}})}$). Rendered via `MoneyDisplay` with `size="hero"` (`text-5xl font-black font-mono tracking-tighter`).
- **Discretionary Pool**: Displays total Safe-to-Spend ($S_{\text{safe}}$).
- **Surface & Framing**:
  - `Healthy Surplus`: Obsidian surface framed with Electric Mint border (`border-primary/40`).
  - `Constrained Margin`: Obsidian surface framed with Warm Amber (`border-warning/40`).
  - `Deficit Warning`: Obsidian surface framed with Vivid Rose (`border-destructive/40`).
- **Status Badge**: Top-right `StatusPill` with `HEALTHY SURPLUS`, `TIGHT MARGIN`, or `DEFICIT WARNING`.

### 2.2 Modular Bento Split Row
- **Left Tile (Cash Flow Equation)**:
  - Displays: $\text{Liquid} - \text{Bills} - \text{Reserve} = S_{\text{safe}}$.
  - Tapping opens an accessible bottom sheet (`Sheet.tsx`) breaking down the exact account totals, upcoming unpaid bills, and monthly budget reserve.
- **Right Tile (Upcoming Commitments Countdown)**:
  - Displays the next two maturing commitments (e.g., "Netflix in 3 days", "Car Loan in 5 days").
  - Quick-pay action button that navigates directly to or triggers the commitment settlement flow.

### 2.3 Lower Grid Sections
- **Monthly Budget Snapshot**:
  - Embeds `BudgetMeter.tsx` displaying spent vs target cap, percentage, and remaining balance.
- **Contextual AI Daily Insight Card (`AskAiCard`)**:
  - Spending observations powered by on-device BYOK prompts and free-form money inquiries.
- **Floating Action Dock**:
  - Pinned above the tab bar providing instant triggers: `+ Add Expense`, `Transfer`, and `Scan Receipt`.

---

## 3. Preserved Test Contracts & IDs

To prevent test regressions, the following `testID` markers must be preserved:

| Element | Preserved `testID` | Additional Retained IDs (for backward compatibility) |
|---|---|---|
| Dashboard Root Screen | `testID="dashboard-screen"` | — |
| Hero Discretionary Tile | `testID="dashboard-screen"` / `testID="hero-card"` | `hero-available`, `hero-spent`, `hero-remaining`, `hero-available-toggle` |
| Safe to Spend Metrics | `testID="safe-to-spend"` | `safe-headline`, `daily-allowance-value`, `deficit-copy` |
| Cash Flow Equation Card | `testID="cashflow-formula-card"` | `formula-card`, `formula-toggle`, `formula-breakdown`, `formula-equals` |
| Upcoming Commitments | `testID="upcoming-bills-card"` | `upcoming-card`, `upcoming-empty`, `upcoming-total`, `upcoming-row-{id}` |
| Monthly Budget Overall | `testID="budget-overall-card"` | `budget-bar`, `budget-bar-progress`, `budget-bar-over` |
| AI Insight Card | `testID="ai-daily-insight"` | `ask-ai-card`, `ask-ai-input`, `ask-ai-send`, `ask-ai-suggestions` |
| Add Expense Action | `testID="dashboard-add-expense-fab"` | — |

---

## 4. Invariants & Guardrails

- **Zero arithmetic on screen**: All financial calculations are derived exclusively via `CashFlowService.snapshot(now)`.
- **Domain Engine Immutability**: No modifications to `src/engine/*`.
- **Integer Sen Handling**: All props and values remain integer sen.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Dashboard and related components
npm test -- src/app/__tests__/ src/components/dashboard/__tests__/
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 003 — Dashboard Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/index.tsx`
  - `src/components/dashboard/HeroCard.tsx`
  - `src/components/dashboard/FormulaCard.tsx`
  - `src/components/dashboard/UpcomingList.tsx`
  - `src/components/dashboard/BudgetBar.tsx`
  - `src/components/dashboard/AskAiCard.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="dashboard-screen"
  - [x] testID="cashflow-formula-card"
  - [x] testID="upcoming-bills-card"
  - [x] testID="budget-overall-card"
  - [x] testID="ai-daily-insight"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Dashboard Asymmetrical Bento Grid operational; all test contracts verified.
```
