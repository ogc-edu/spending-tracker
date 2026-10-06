# 007 — Analytics & Insights Screen Redesign (Metrics Bento Matrix)

| | |
|---|---|
| **Status** | Completed |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 5) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 5: Analytics and Insights, pp. 16–17) |
| **Target Files** | `src/app/(tabs)/analytics.tsx`, `src/components/analytics/*`, `src/components/AIAnalysisCard.tsx` |

---

## 1. Objective

Upgrade the Analytics screen into an executive-level cash flow dashboard pairing a Month-over-Month (MoM) cycle stepper with a **2x2 Metrics Bento Matrix**, ranked **Category Breakdown Proportional Bars**, and a Bring-Your-Own-Key (BYOK) **AI Monthly Review Container** framed with a subtle cyan glow.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  MOM STEPPER:  <  October 2026  >                      │
├────────────────────────────────────────────────────────┤
│  METRICS BENTO MATRIX (2x2 Grid)                       │
│  (testID="analytics-kpi-grid")                         │
│  ┌───────────────────────┐  ┌────────────────────────┐ │
│  │ Total Monthly Spend   │  │ Daily Average Spend    │ │
│  │ RM 2,450.00           │  │ RM 163.33 / day        │ │
│  │ [-8.4% vs last month] │  │ (15 days elapsed)      │ │
│  ├───────────────────────┤  ├────────────────────────┤ │
│  │ Peak Spending Day     │  │ Top Category           │ │
│  │ RM 520.00 (Oct 4)     │  │ Food & Dining          │ │
│  │ Grocery Restock       │  │ RM 850.00 (34.7%)      │ │
│  └───────────────────────┘  └────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  CATEGORY BREAKDOWN CONTAINER (testID="analytics-categories")│
│  🍔 Food & Dining       RM 850.00 (34.7%)              │
│  [====================                             ]   │
│  🚗 Transport           RM 420.00 (17.1%)              │
│  [==========                                       ]   │
│  ⚡ Utilities           RM 350.00 (14.3%)              │
│  [========                                         ]   │
├────────────────────────────────────────────────────────┤
│  AI MONTHLY REVIEW CONTAINER (testID="ai-analysis-card")│
│  Framed with subtle cyan border (border-cyan-500/40)   │
│  [ ✨ Analyze Month ]                                  │
│  • Executive Summary: Spending down 8.4% from Sept.    │
│  • Anomaly Detected: RM 520 grocery spike on Oct 4.    │
│  • Strategic Recommendation: Transfer RM 300 to buffer.│
└────────────────────────────────────────────────────────┘
```

### 2.1 Metrics Bento Matrix (2x2 Grid)
- Rendered using `BentoCard` and `MoneyDisplay`. Tagged with `testID="analytics-kpi-grid"` (retaining `analytics-stats`).
- **Cell 1: Total Monthly Spend**: Headline sum with MoM percentage change badge (`MoMChip`).
- **Cell 2: Daily Average Spend**: Total spend divided by elapsed days in billing cycle.
- **Cell 3: Peak Spending Day**: Highest single day of spending, driver note/category, and date.
- **Cell 4: Top Category**: Dominant expense category, expenditure sum, and proportion percentage.

### 2.2 Category Breakdown Container
- Ranked list ordered from highest to lowest expenditure, tagged with `testID="analytics-categories"` (retaining `analytics-breakdown`).
- Proportional dynamic fill bars indicating exact percentage share of total month spend.
- Category icon badge and formatted currency amount with tabular typography.

### 2.3 AI Monthly Review Container
- Framed with subtle cyan border (`border-cyan-500/40`), tagged with `testID="ai-analysis-card"`.
- "Analyze Month" action trigger (`testID="analytics-analyze-button"`).
- Sends local, privacy-safe spending summary to user's configured Gemini or DeepSeek model.
- Renders structured bullet points (Executive Summary, Anomalies, Recommendations) with retry states and offline/invalid API key error handling.

---

## 3. Preserved Test Contracts & IDs

| Element | Preserved `testID` | Additional Retained IDs |
|---|---|---|
| Metrics Bento Matrix | `testID="analytics-kpi-grid"` | `analytics-stats`, `analytics-stat-avg`, `analytics-stat-largest`, `analytics-stat-utilization`, `analytics-stat-projection` |
| Category Breakdown | `testID="analytics-categories"` | `analytics-breakdown`, `analytics-breakdown-row-{id}` |
| AI Monthly Review Card | `testID="ai-analysis-card"` | `analytics-total-card`, `analytics-total`, `analytics-analyze-button` |
| Month Bar & Controls | `testID="analytics-month-bar"` | `analytics-month-prev`, `analytics-month-next`, `analytics-month-label` |
| Screen Container | `testID="analytics-screen"` | `analytics-loading`, `analytics-empty`, `analytics-error` |
| MoM Indicator Chip | `testID="analytics-mom"` | `analytics-mom-label` |
| Top Expenses Section | `testID="analytics-top-expenses"` | `analytics-top-list`, `analytics-top-expense-{id}` |

---

## 4. Invariants & Guardrails

- **Domain Engine Immutability**: All analytics algorithms in `src/engine/analytics.ts` remain untouched.
- **Local-First AI Privacy**: Only anonymized numerical aggregates are sent to the AI service; no personal raw text.
- **Monospace Tabular Numerals**: Enforce `fontVariant: ['tabular-nums']` for all currency amounts.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Analytics
npm test -- src/app/__tests__/analyticsScreen src/engine/__tests__/analytics
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 007 — Analytics & Insights Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/analytics.tsx`
  - `src/components/analytics/StatGrid.tsx`
  - `src/components/analytics/CategoryBreakdown.tsx`
  - `src/components/analytics/MoMChip.tsx`
  - `src/components/AIAnalysisCard.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="analytics-kpi-grid"
  - [x] testID="analytics-categories"
  - [x] testID="ai-analysis-card"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Metrics Bento Matrix and Category Breakdown proportional bars active.
```
