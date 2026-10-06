# 006 — Commitments & Subscriptions Screen Redesign (Digital Passes)

| | |
|---|---|
| **Status** | Ready for Session |
| **Version** | 1.0 |
| **Date** | 2026-10-06 |
| **Phase** | Phase 3: Screen Overhaul (Screen 4) |
| **Dependencies** | 001 (Tokens), 002 (Primitives) |
| **Source Specification** | `ui-redesign.pdf` (§ Screen 4: Commitments and Subscriptions, p. 16) |
| **Target Files** | `src/app/(tabs)/commitments.tsx`, `src/app/commitments/[id]/index.tsx`, `src/components/ScheduleRow.tsx`, `src/components/CommitmentForm.tsx` |

---

## 1. Objective

Elevate the commitments and subscriptions interface into sleek **Digital Passes** reflecting three distinct obligation models: amortizing fixed loans, recurring subscriptions, and one-off upcoming obligations. Deliver an automated, bulletproof "Mark as Paid" ledger synchronization workflow that seamlessly coordinates payments, linked expenses, and funding account deductions.

---

## 2. Layout & Architectural Specifications

```
┌────────────────────────────────────────────────────────┐
│  RECURRING SUBSCRIPTION PASS (testID="subscription-card-{id}")│
│  ┌─ 🍿 Netflix ───────────────────────── Active ─────┐ │
│  │ Monthly Fee: RM 45.00 • Renews in 3 days          │ │
│  │ Auto-debit Account: Touch 'n Go                   │ │
│  │ [ Mark as Paid ]                                  │ │
│  └───────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  FIXED AMORTIZING LOAN PASS (testID="loan-card-{id}")  │
│  ┌─ 🚗 Car Loan ──────────────────────── Active ─────┐ │
│  │ Repayment: RM 650.00 / month                      │ │
│  │ Balance: RM 31,200.00 / RM 45,000.00 (36 mos left) │ │
│  │ [==========                    ] 30.6% Paid Off   │ │
│  │ [ Mark as Paid ]                                  │ │
│  └───────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────┤
│  ONE-OFF OBLIGATION PASS (testID="obligation-card-{id}")│
│  ┌─ 📄 Road Tax & Insurance ─────────── Active ─────┐ │
│  │ Maturity Date: Nov 15, 2026                       │ │
│  │ Total Amount Due: RM 820.00                       │ │
│  │ [ Mark as Paid ]                                  │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 2.1 Three Obligation Models (Digital Passes)
1. **Fixed Amortizing Loans**:
   - `testID="loan-card-{id}"`
   - Displays: Monthly payment amount, total principal, payoff progress bar (`BudgetMeter`), remaining balance, and months to maturity.
2. **Recurring Subscriptions**:
   - `testID="subscription-card-{id}"`
   - Displays: Monthly/recurring billing fee, due date countdown, and default auto-debit funding account.
3. **One-Off Obligations**:
   - `testID="obligation-card-{id}"`
   - Displays: Single maturity date, full amount due, and settled/active status badge.

### 2.2 "Mark as Paid" Ledger Synchronization Workflow
- Triggered via `testID="mark-paid-button"` (and preserved `testID="schedule-row-mark-paid"`).
- Opens an account selector bottom sheet to confirm funding source.
- Synchronizes with SQLite via `CommitmentService`:
  1. Generates a linked expense entry in the database.
  2. Deducts the amount from the chosen funding account (`balance_sen = balance_sen - amount_sen`).
  3. Marks the commitment as Paid for the active billing cycle.
  4. Automatically decrements `remaining_sen` for amortizing loans.
  5. If a payment is reversed/deleted ("Un-pay"), removes the linked expense and restores the account balance.

---

## 3. Preserved Test Contracts & IDs

| Element | Preserved `testID` | Additional Retained IDs |
|---|---|---|
| Fixed Amortizing Loan Pass | `testID="loan-card-{id}"` | `commitment-row-{id}`, `commitment-name-{id}`, `commitment-next-due-{id}` |
| Recurring Subscription Pass | `testID="subscription-card-{id}"` | `commitment-row-{id}`, `commitment-name-{id}`, `commitment-next-due-{id}` |
| One-Off Obligation Pass | `testID="obligation-card-{id}"` | `commitment-row-{id}`, `commitment-name-{id}`, `commitment-next-due-{id}` |
| Mark as Paid Action | `testID="mark-paid-button"` | `schedule-row-mark-paid` |
| Commitments Screen Container | `testID="commitments-screen"` | — |
| Commitments List Container | `testID="commitments-list"` | — |
| Archived Toggle | `testID="commitments-archived-toggle"` | — |
| Restore Commitment Action | `testID="commitment-restore-{id}"` | `commitment-restore` |
| Add Commitment FAB | `testID="add-commitment-fab"` | `new-commitment-screen` |
| Detail Screen Contracts | `testID="commitment-detail-screen"` | `commitment-hero`, `commitment-edit`, `commitment-delete`, `commitment-plan-summary` |

---

## 4. Invariants & Guardrails

- **Domain Engine Immutability**: `src/engine/commitments.ts` logic remains strictly untouched.
- **Transactional Atomic Writes**: All multi-table updates (commitment + payment + linked expense + balance) execute within SQLite transactions.
- **Integer Sen Storage**: Zero floating point usage.

---

## 5. Verification Commands

```bash
# 1. Typecheck
npm run typecheck

# 2. Lint
npm run lint

# 3. Jest tests for Commitments
npm test -- src/app/__tests__/commitment src/services/__tests__/commitment src/repositories/drizzle/__tests__/commitment
```

---

## 6. Session Handoff Report Template

```markdown
### Session Handoff Report: Plan 006 — Commitments & Subscriptions Screen Redesign
- **Status**: [Completed / Blocked]
- **Files Modified**:
  - `src/app/(tabs)/commitments.tsx`
  - `src/app/commitments/[id]/index.tsx`
  - `src/components/ScheduleRow.tsx`
- **Preserved Test Contracts Verified**:
  - [x] testID="loan-card-{id}"
  - [x] testID="subscription-card-{id}"
  - [x] testID="obligation-card-{id}"
  - [x] testID="mark-paid-button"
- **Verification Commands Executed**:
  - `npm run typecheck`: [PASS]
  - `npm test`: [PASS]
- **Handoff Notes**:
  - Digital Pass styling active across loan, subscription, and obligation models; ledger sync verified.
```
