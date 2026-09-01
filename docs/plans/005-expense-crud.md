# 005 — Expense CRUD & Account Balances

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002, 003, 004 |
| **PRD** | §7.2 EXP-1..3, EXP-8; §7.7 ACC-2; §8.1–8.3 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 005 |

## Objective

Manual expense recording done right: add/edit/delete expenses with Zod-validated forms, fast-entry defaults, deterministic account-balance auto-adjustment (D1) in SQLite transactions, and the first financial-engine functions (monthly & category totals) with tests. The expense list itself is plan 005; this plan delivers the data layer + forms + totals.

## Context

The app's core loop — "record lunch in a few seconds" — and the double-counting-safe data foundation. Balance semantics: an expense reduces the linked account's balance (cash/bank/ewallet), or increases a credit card's owed amount (stored positive, counts negative in available — ACC-3). Editing/deleting must produce exactly the same balances as if the corrected transaction had always been the one recorded (PRD note 6: edit updates the same row, never a duplicate).

## Requirements

- **Add expense**: amount (sen), category (from the 12 seeds), description (optional, ≤200 chars), date (default today), account (optional, last-used default). Zod-validated; money via `parseMoneyToSen` (004).
- **Edit expense**: same form; updates the existing row; balance adjustments compute the delta against the old values (see Technical Design).
- **Delete expense**: removes the row and reverses its balance effect.
- **Linked-expense (D3) handling on edit/delete**: expenses auto-created from commitment payments carry `commitment_payment_id` and are **read-only in the expense UI** — edit and delete are blocked with a hint ("un-pay this payment in Commitments"). Decision **E7 (confirmed): block** — the linked expense is removed only by un-paying the commitment payment (Commitments flow, plan 007); this keeps the expense set and payment set consistent (PRD §8.3).
- **Engine functions** (pure): `monthlyTotals(expenses, {month, year})`, `expenseTotalsByCategory(expenses, {month, year})` — consumed by budgets (007), dashboard (010), analytics (011).
- **Fast entry** (EXP-8): date = today, category/account prefilled from last-used (Zustand), amount input auto-focused, submit in ≤3 taps.
- Offline: everything local (NFR-1).

## Technical Design

### Service: `src/services/ExpenseService.ts`

```
create(input)  → txn { insert expense; adjustBalance(accountId, -amount) }
edit(id, input) → txn {
    old = get(id); if account changed: adjust(old.accountId, +old.amount); adjust(new.accountId, -new.amount);
    if amount changed: adjust(account, -(new.amount - old.amount));
    update row (same id); }
delete(id)     → txn { if linked (E7, see Decisions); adjust(account, +amount); delete row; }
```

`adjustBalance(accountId, deltaSen)`: `balance_sen = balance_sen + deltaSen` where for `credit_card` the stored value is owed (positive), so a purchase *increases* it — i.e. the sign convention is: **asset accounts: purchase → −amount; credit card: purchase → +amount (owed)**. The service applies `delta = (type === 'credit_card' ? +amount : -amount)`.

### Form & screens

- `src/components/ExpenseForm.tsx` (RHF + Zod schema shared with the service: `ExpenseFormSchema`).
- `app/expenses/new.tsx` — create; `app/expenses/[id]/edit.tsx` — edit (route from detail, 005).
- Category picker: chips/grid from `CategoryRepository`; account picker: `AccountRepository.list()` + "None" option (form shows current balance per account, and the projected balance after save).
- Save button disables while pending (double-submit guard).

### Engine additions (`src/engine/`)

```ts
monthlyTotals(expenses, {month, year}): MoneySen          // sum where local month matches
expenseTotalsByCategory(expenses, {month, year}): Map<CategoryId, MoneySen>
```

Pure, date-decoupled: caller passes filtered rows; month matching happens inside on a `YYYY-MM-DD` string via local-date utils.

## Files / Components Likely Affected

- `src/services/ExpenseService.ts`, `src/repositories/drizzle/expenseRepository.ts`, `src/repositories/types.ts` (+ `expenseRepository` interface: create/update/delete/byId)
- `src/engine/totals.ts` (+ tests), `src/utils/dates.ts` (local month helpers)
- `src/components/ExpenseForm.tsx`, `app/expenses/new.tsx`, `app/expenses/[id]/edit.tsx`
- `src/store/uiStore.ts` — last-used category/account

## API Changes

Internal: `ExpenseService.{create,edit,delete,byId}`, engine `monthlyTotals`, `expenseTotalsByCategory`.

## Database Changes

None (schema complete in 002). First transactional writes land.

## Dependencies

002 (schema/harness), 003 (users/auth + user context), 004 (accounts, categories, money utils).

- **E7 — deleting/editing an auto-created Debt expense: BLOCKED (confirmed 2026-09-01).** Linked expenses are read-only in the expense UI; removal happens by un-paying the commitment payment in Commitments (008).

## Edge Cases

- Amount 0 or negative → Zod reject; >2 decimal places → reject (004).
- Date outside current month: fine — totals are per-month queries.
- Delete the last expense of an account → balance reverts to initial; no special handling needed.
- Unknown category/account id (stale picker) → FK error mapped to a friendly message.
- Double-tap save → disabled button + txn idempotency (unique ids).
- Moving an expense between accounts across the same edit → both balances adjusted once (tested).
- Credit-card purchase → owed increases; deleting it → owed decreases; tests cover sign flips.

## Security Considerations

- Local data only; no secrets. Input validation at the service boundary (Zod) — never trust the form.

## Tests

- Balance math (better-sqlite3 harness): create on cash −amount; on credit +amount; edit amount delta; edit account move both ways; delete reversal; multiple sequential edits end-state equals single corrected record.
- `monthlyTotals`/`expenseTotalsByCategory`: hand-computed fixtures; month-boundary inclusivity (1st/31st, leap Feb in a test year); empty months → zero; expenses from other accounts/months excluded.
- Zod schema: rejects 0/negative/3-decimal; accepts sen-parseable strings ("12.5", "12.50").
- Linked-expense behavior per E7 decision.

## Acceptance Criteria

1. A user can record an expense in ≤3 taps with defaults (today, last-used) — verified on-device.
2. Editing keeps the same row id (no duplicates); balances after edit equal the corrected single record (tested).
3. Deleting reverses the balance effect; totals (monthly/category) match hand-computed fixtures.
4. Double-tap can't double-insert.
5. `npm test`, typecheck, lint green. E7 behavior implemented per the approved option.

## Out of Scope

- History/search/filters (006), budgets (007), auto-payment linkage creation (008), recurring expenses, photo receipts, import.