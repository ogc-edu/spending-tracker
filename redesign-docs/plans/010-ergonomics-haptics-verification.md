# 010 — Mobile Ergonomics, Haptics & Quality Assurance Verification

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 4: Ergonomics, Haptics & QA Verification |
| **Dependencies** | Plans 001 through 009 |
| **Source Specification** | `ui-redesign.pdf` (§ Mobile Ergonomics, Viewport Engineering, and Keyboard Dynamics; § Verification Matrix, pp. 19–24) |
| **Target Files** | `src/utils/haptics.ts`, `src/components/KeyboardAwareScrollView.tsx`, App-wide screen wrappers, Jest test suite |

---

## 1. Objective

Complete the final engineering and verification pass across the redesigned mobile app: enforce rigorous safe area insets and horizontal gutters (`px-4`), verify native sheet ergonomics and keyboard avoidance behavior, implement tactile haptic feedback mappings via a safe abstraction layer, and conduct full end-to-end quality assurance ensuring **all 65 test suites and 800+ unit tests pass without regressions**.

---

## 2. Technical Specifications

### 2.1 Viewport Engineering & Safe Areas
- Use `react-native-safe-area-context` dynamically:
  - Top headers pad using `insets.top` to clear camera cutouts and dynamic islands.
  - Bottom navigation docks pad using `insets.bottom` to clear system home indicators.
  - Eliminate all hardcoded `100vh` or fixed device heights.
- Enforce standard horizontal gutter of `px-4` (16px) across all screens.
- Layer arrangement:
  1. Status bar and notch padding (`insets.top`)
  2. Navigation headers
  3. Scrollable content (`KeyboardAwareScrollView`)
  4. Interactive inputs above keyboard
  5. System home indicator padding (`insets.bottom`)

### 2.2 Native Sheet Architecture & Keyboard Avoidance
- Bottom sheets constructed with `rn-primitives` and `KeyboardAwareScrollView`.
- Automatic viewport adjustment when software keyboard expands, keeping active inputs centered and unobstructed.

### 2.3 Tactile Haptic Feedback Abstraction (`src/utils/haptics.ts`)
Provide a resilient haptics utility that triggers physical feedback on supported native devices while degrading gracefully to no-ops in headless test environments (Jest) and web:

| User Trigger | Haptic Feedback Target | Behavioral Function | Utility Method |
|---|---|---|---|
| Keypad Digit Press | `SelectionAsync (Light)` | Replicates physical POS feel | `haptics.keypadPress()` |
| Category Selection | `ImpactFeedbackStyle.Light` | Confirms selection | `haptics.categorySelect()` |
| Commitment Mark as Paid | `NotificationFeedbackType.Success` | Confirms debt settlement | `haptics.paymentSuccess()` |
| Budget Limit Reached | `NotificationFeedbackType.Warning` | Alerts threshold breach | `haptics.budgetAlert()` |
| Transaction Deletion | `ImpactFeedbackStyle.Medium` | Confirms deletion | `haptics.deleteConfirm()` |

---

## 3. Comprehensive Verification Matrix

The session must execute the complete verification pipeline and verify all contract markers:

### 3.1 Verification Commands
```bash
# 1. Full TypeScript compilation
npm run typecheck

# 2. Strict linter validation
npm run lint

# 3. Comprehensive unit & screen test suite
npm test
```

### 3.2 Acceptance Criteria
- **Zero TypeScript errors** (`tsc --noEmit` exits with 0).
- **Zero ESLint errors**.
- **All 65 test suites pass**; all 800+ tests pass with zero regressions.
- **Engine immutability preserved**: `src/engine/*` files remain untouched.
- **Database schema preserved**: `src/db/schema.ts` remains untouched.
- **All 25 preserved test contracts verified present**:
  - `testID="dashboard-screen"`
  - `testID="cashflow-formula-card"`
  - `testID="upcoming-bills-card"`
  - `testID="budget-overall-card"`
  - `testID="ai-daily-insight"`
  - `testID="expense-search-input"`
  - `testID="period-summary-strip"`
  - `testID="expenses-list"`
  - `testID="expense-row-{id}"`
  - `testID="category-card-{id}"`
  - `testID="category-limit-input"`
  - `testID="loan-card-{id}"`
  - `testID="subscription-card-{id}"`
  - `testID="obligation-card-{id}"`
  - `testID="mark-paid-button"`
  - `testID="analytics-kpi-grid"`
  - `testID="analytics-categories"`
  - `testID="ai-analysis-card"`
  - `testID="accounts-stack"`
  - `testID="trigger-payroll-btn"`
  - `testID="ai-config-section"`
  - `testID="money-input"`
  - `testID="account-pill-{id}"`
  - `testID="category-matrix"`
  - `testID="linked-commitment-lock"`

---

## 4. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 010 — Mobile Ergonomics, Haptics & Verification
- **Status**: [Completed / Blocked]
- **Files Modified / Created**:
  - `src/utils/haptics.ts`
  - App-wide layout wrappers
- **Full Test Suite Results**:
  - Test Suites: 65 passed, 65 total
  - Tests: 800+ passed, 800+ total
  - Typecheck: 0 errors
  - Lint: 0 errors
- **Preserved Test Contracts Check**:
  - [x] All 25 critical testID markers verified present and accessible
- **Handoff Notes**:
  - Full UI/UX Redesign complete and verified production-ready.
```
