# 008 — Commitments & Payments

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002, 005 |
| **PRD** | §7.4 COM-1..6; §8.3 (double-count partition) |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 008 |

## Objective

Create and manage commitments (debts, bills, installments, subscriptions) with a **derived payment schedule**, mark payments paid (auto-creating the linked Debt/Repayment expense per D3), un-pay them (E7's counterpart), and compute totals due before any date — especially before next month's start (PRD COM-5).

## Context

Schedules are **derived, never materialized** (A3): `commitment_payments` stores only paid records; pending slots are computed deterministically from the commitment (ARCH §7). Mark-paid is the atomic transaction that keeps expenses and payments disjoint (PRD §8.3). Frequencies: monthly + one-time only (D4). Every row is user-scoped (A10).

## Requirements (PRD COM-1..6)

- Create a commitment: name, type, total (fixed) or ongoing, payment amount, frequency (monthly / one-time), start date, due date, end date (optional).
- Derive the schedule deterministically: fixed installments N = ceil(total/payment) (or months start→end inclusive); last payment = remainder; one-time = single payment on due date; ongoing monthly = payments anchored at start_date, derived within any query window (ARCH §7).
- List active commitments with next payment + overdue state; detail view with full schedule; statuses active / completed / cancelled.
- Mark a payment paid → transaction: insert paid record, decrement `remaining_sen`, create linked Debt/Repayment expense (E7 read-only), adjust the paying account's balance (A5: account optional, prefills last-used). Idempotent (unique `expenses.commitment_payment_id`).
- **Un-pay a payment** (E7 counterpart — required so linked expenses can be removed): reverse the transaction (delete paid record + linked expense + restore remaining + reverse balance).
- Compute `upcomingCommitments` (unpaid, due < window end, incl. overdue; excludes paid/cancelled) — the engine function Dashboard (010) and Cash Flow (009) consume.
- Completion: fixed commitment with remaining = 0 → status `completed` automatically.

## Technical Design

### Engine (pure, in this plan)

```
commitmentSchedule(c, from?: LocalDate, to?: LocalDate) → ScheduledPayment[]   // {dueDate, amountSen, index}
upcomingCommitments(commitments, paidPayments, windowEnd) → { totalSen, items: {commitment, dueDate, amountSen}[] }
remainingAfterPaid(commitment, paidCount) → remainder math
```

Day-of-month clamping (Jan 31 → Feb 28/29) lives in `utils/dates.ts` (ARCH §7), deterministic.

### Service transactions (drizzle tx)

```
CommitmentService.create(input)                        // validate: fixed XOR ongoing; payment > 0; dates sane
CommitmentService.markPaid(commitmentId, dueDate, accountId?)  // slot → paid record + expense + balance
CommitmentService.unPay(paymentId)                            // full reversal (E7)
CommitmentService.cancel(commitmentId)                        // status=cancelled; keeps paid history
CommitmentService.delete(commitmentId)                        // C1 (see Decisions)
```

Mark-paid flow detail: locate the derived slot by `dueDate` (exact match on the schedule); if already paid → no-op/block; insert `commitment_payments` (user_id, commitment_id, amount_sen, due_date, paid_date=today, status='paid'); decrement remaining (fixed only); insert `expenses` (user_id, amount_sen, category=Debt/Repayment, date=today, account_id?, commitment_payment_id=NEW); adjust account balance (assets −, credit +) exactly as 005.

Un-pay: remove the expense by `commitment_payment_id`, remove the paid record, restore `remaining_sen += amount`, reverse the balance delta — all in one tx. Allowed for any paid slot (schedule positions are date-keyed; sum-based remaining stays correct).

### UI

- Commitments tab: list (name, next due, overdue badge in danger color, paid/total progress like "2/6"), "Add" → create form (RHF + Zod; type-specific fields), detail screen (`app/commitments/[id].tsx`): schedule rows upcoming (Mark paid → account picker prefilled), paid rows (show linked expense + Un-pay), status controls (Cancel), Delete per C1.
- Overdue rows are included in upcoming totals (PRD §8.4) and highlighted, never hidden.

## Files / Components Likely Affected

- `src/engine/commitments.ts` (schedule + upcoming) + tests
- `src/services/CommitmentService.ts`
- `src/repositories/drizzle/commitmentRepository.ts` (+ payments), `src/repositories/types.ts`
- `app/(tabs)/commitments.tsx`, `app/commitments/new.tsx`, `app/commitments/[id].tsx`
- `src/components/CommitmentForm.tsx`, `ScheduleRow.tsx`, `PaymentFlowSheet.tsx`

## API Changes

Internal: `CommitmentService.{create, markPaid, unPay, cancel, delete, byId, listActive}`, engine `commitmentSchedule`/`upcomingCommitments`.

## Database Changes

- `commitments` gains **`archived_at` (TIMESTAMP NULL)** — added via migration 0002 (folded into the pre-implementation initial migration set; schema is not yet deployed). Archive (C1) sets it; default lists/`upcomingCommitments`/analytics exclude `archived_at IS NOT NULL`; un-archive clears it. Hard delete stays possible only for zero-payment commitments.

## Dependencies

002 (schema/harness), 005 (expense insert + balance adjustment conventions; E7 locks enforced in the expense UI).

## Decisions

- **C1 — deleting a commitment with paid payments: ARCHIVE / soft-delete (confirmed 2026-09-01).** Deleting is replaced by **Archive**: sets `archived_at`, keeps every row (commitment, paid records, linked expenses); archived commitments are hidden from default lists, excluded from `upcomingCommitments` and analytics, and restorable (un-archive). Hard delete remains available **only** for commitments with zero payments (nothing to orphan). This keeps history and the E7 read-only contract intact with a simpler mental model than cascade-delete.
- (Confirmed defaults, no question): un-pay allowed for any paid slot; cancelled is terminal (re-create instead of re-activate); fixed schedule does not allow partial/extra payments (MVP); no backfill of "Paid: N" at creation (mark payments as they happen).

## Edge Cases

- Remainder payment: total 2,500 / 400 → 6×400 + 100 last (schedule math tested).
- Day clamp: start Jan 31 → due Feb 28 / Feb 29 (leap).
- Start date in the past: slots before today become overdue-unpaid and count in upcoming.
- One-time due next month: appears only in windows covering it.
- Mark-paid double-tap: second call blocked (unique expense link; UI disables while pending).
- Cancel vs upcoming: cancelled excluded from `upcomingCommitments`; paid history stays visible.
- Un-pay then re-pay: expense id changes (old link gone) — no duplication (unique per new paid record).
- User A cannot see/user B's commitments (scoping test).

## Security Considerations

- User-scoped everywhere; money in sen; no secrets. Transactions are the integrity boundary (a failure rolls back all four writes).

## Tests

- Schedule derivation fixtures: 6×400; remainder 100; one-time; ongoing monthly (windowed); leap clamps; mid-month anchor.
- Upcoming windows: totals before next-month-start; overdue included; paid & cancelled excluded; per-commitment breakdown.
- Mark-paid tx: all four writes land; balance math per account type; idempotency on double call; rollback on injected failure.
- Un-pay tx: full reversal incl. balance; expense gone; remaining restored.
- Status: auto-complete at 0; cancel terminal; delete-per-C1.
- User isolation fixtures.

## Acceptance Criteria

1. Create fixed/ongoing/one-time commitments; schedule shown matches hand-computed fixtures.
2. Mark paid creates exactly one linked Debt/Repayment expense + adjusts the account; double-tap safe.
3. Un-pay fully reverses; linked expense only removable this way (E7).
4. Upcoming-total (before next month) correct incl. overdue; DoD items 7, 8, 10.
5. `npm test`, typecheck, lint green.

## Out of Scope

Weekly/yearly frequency (D4), partial/extra payments, auto-pay reminders/notifications, backfilled history at creation, re-activation after cancel.