# 020 — Scope Reset: Remove Budgets & Allowance, Add Credit Bills (SPayLater), Analytics by Period

| | |
|---|---|
| **Status** | Implemented 2026-10-11 (Phases A, B, and C complete) |
| **Version** | 1.0 |
| **Date** | 2026-10-09 |
| **Dependencies** | 004, 005, 008, 009, 010, 011, 019 |
| **PRD** | Supersedes §2 goals 2 & 4, §7.1 DASH-1/3, §7.3 (all), §7.5 AN-1..3, decision D2 |

## Objective

Cut the app down to the features the user actually uses, and add the one that is missing:
seeing what is owed on **ShopeePayLater (SPL)** — and credit cards — per billing cycle,
without double-counting spending.

This plan is **functional only**. Screens get the minimum UI needed to expose the behavior;
the visual redesign is a separate plan written after the UI discussion.

## Decisions (user, 2026-10-09)

| # | Decision |
|---|---|
| S1 | **Budgets removed entirely** — tab, services, engine, table, AI fields. (Created by accident; not wanted.) |
| S2 | **Daily allowance removed.** |
| S3 | **Safe-to-spend, safety buffer, formula breakdown, health status pill removed.** D2 is retired. |
| S4 | Home shows **Spent this month** and **Due by end of this month** (commitments + credit bills). The user enters next month's obligations due within this month so the figure tells them what to pay up front. |
| S5 | **Payroll hidden** — UI removed; table, service and tests stay so it can return. |
| S6 | Dashboard **Transfer** and **Scan** buttons deleted (they were dead — both opened Add Expense). |
| S7 | SPL (and credit cards) are **credit accounts with billing cycles**, not commitments. A purchase is one normal expense on the credit account; the bill is derived. |
| S8 | SPL cycle: statement day **20**, due **end of the closing month**. Purchases 21 Sep – 20 Oct form the **October bill**, due 31 Oct. Closed bills are never changed by new purchases. |
| S9 | SPL instalments: a credit-account expense may be **split into N months** with an optional **monthly interest %** (usually 0%). |
| S10 | **Analytics** becomes spending by category over **Day / Week / Month** as a bar chart, highlighting the highest period. |
| S11 | Unchanged: expenses, commitments, login, categories, AI (adapted only where it read removed fields). |

## Why credit accounts, not commitments

Commitment mark-paid creates a **Debt / Repayment expense** (D3). If an SPL purchase were also
a commitment, RM30 of food would be counted twice: RM30 Food at purchase + RM30 Debt at
repayment. With a credit account the purchase is the only expense; paying the bill is a
**transfer** (bank → SPL) and creates no expense.

The `credit_card` account type already stores **amount owed** and increases it on purchase
(`ExpenseService.balanceEffectFor`), so most of the plumbing exists. What is missing is the
cycle, the bill, and a way to pay it off — today there is no correct way to reduce a credit
card's owed balance at all.

## Domain design

### Credit accounts

- New account type **`paylater`**. `credit_card` and `paylater` together are **credit accounts**
  and share all behavior below (the type only changes the label).
- Credit accounts gain two settings:
  - `statement_day` (1–31, clamped to month length) — the cycle closes on this day.
  - `due_day` (1–31, clamped; 31 = "last day of month").
- `balance_sen` keeps meaning **total owed** across all bills, including future instalment parts.
  Invariant: `owed = opening owed + Σ credit-account expenses − Σ bill payments`.

### Cycle and bill math (pure, `src/engine/creditBills.ts`)

- A bill is named by the month its cycle **closes** in.
- Bill *M* covers `(statementDay of M−1) + 1` … `statementDay of M`, both clamped.
- Due date: if `due_day > statement_day` → day `due_day` of *M*; otherwise → day `due_day`
  of *M+1* (clamped). SPL (20 / 31): October bill = 21 Sep – 20 Oct, due 31 Oct.
  A card with statement 25 / due 15: October bill = 26 Sep – 25 Oct, due 15 Nov.
- Bill amount = Σ charges falling in the cycle, where a charge is:
  - a plain credit-account expense → its full amount in the bill whose cycle contains its date;
  - an instalment expense → part *k* (k = 0…N−1) in the bill *k* months after the purchase's bill.
- Outstanding = amount − Σ payments recorded against that bill. Bills are processed oldest
  first; if an edit leaves a bill overpaid, the excess carries forward to the next bill.
- Status: **open** (today ≤ close date), **unpaid** (closed, outstanding > 0), **paid**.
- Bills are **derived, never stored**, the same way commitment schedules are. Fixing an expense
  (amount, date, delete) automatically corrects the right bill.

### Instalments

- Available only when the expense's account is a credit account.
- Inputs: principal (the price), months N (quick picks 3 / 6 / 12, or custom 2–24), monthly
  interest % (default 0, up to 2 decimals, stored as basis points).
- Per part: `floor(principal / N)` (last part absorbs the remainder) **+**
  `floor(principal × rate_bp / 10000)` interest.
- The expense's `amount_sen` = **total payable** (principal + N × monthly interest). It counts in
  its category **in full on the purchase date**, so spending and owed always agree.
- Stored in a new table `expense_installments(expense_id UNIQUE → expenses, months,
  monthly_rate_bp, principal_sen)`; `amount_sen` is recomputed by the service on every save.

### Paying a bill

- **Pay** on a bill: choose a non-credit source account; amount defaults to the outstanding
  amount (a smaller amount is allowed).
- One transaction: insert `credit_bill_payments` row, decrease credit account owed, decrease
  source balance. **No expense is created.**
- Guard: inside the transaction, refuse if the amount exceeds the current outstanding amount.
  This makes a double-tap harmless.
- Payments can be undone (delete row and reverse both balance changes, in one transaction).

### Opening balance

A credit account created with an existing amount owed stores `opening_owed_sen`. That amount is
assigned to the bill whose cycle contains the account's creation date.

### Home figures

- **Spent this month** = Σ expenses dated in the calendar month. This includes credit-account
  purchases at full amount and commitment repayment expenses, matching how spending is recorded.
- **Due by end of this month** = unpaid commitment slots due before next month's start
  (overdue included — the existing `upcomingCommitments` window) **+** outstanding on every
  credit bill due on or before month end (unpaid overdue bills included; the open bill is
  included if it is due this month).
- A list of what makes up that total, ordered by due date, mixing commitment slots and bills.
- Available money stays on the accounts surface. Its place on Home is decided in the UI plan.

## Analytics

- Controls: category (**All** or one category) × granularity (**Day / Week / Month**).
- Window: Day = last 30 days, Week = last 12 weeks (Monday start), Month = last 12 months.
  Each window ends at the period containing the reference date.
- Engine: `spendingSeries(expenses, { granularity, endDate, count, categoryId? })` → one
  `{ periodStart, label, totalSen }` per period, zeros included. It also returns the index of
  the highest period, the window total, and the average per period. Pure, with `referenceDate`
  passed as an argument.
- Kept below the chart: category breakdown and top expenses **for the selected bar** (the
  window when no bar is selected).
- Removed: 2×2 stat grid, month-over-month card, projection, budget utilisation.
- Chart drawn with `react-native-svg` (already a dependency) — no new chart library.

## AI adaptations (minimal — AI is otherwise unchanged)

- Delete the `'allowance'` context, `toAllowanceSnapshot`, and its prompt.
- `ask` snapshot: drop budget/buffer/safe/allowance fields; add spent this month, due by end of
  month, the due items (commitment slots + credit bills as names, dates and amounts), and
  category totals. Replace the "Explain my allowance" suggestion chip.
- `spending` snapshot: drop budget fields.
- `debt` snapshot: add unpaid credit bills as aggregates.
- A6 hygiene unchanged — no expense descriptions are sent.

## Data model / migration

One migration via `npm run db:generate`:

- `DROP TABLE budgets` — **deletes all budget data** (agreed in S1).
- Delete the safety-buffer row from `settings`.
- `accounts`: add `statement_day`, `due_day`, `opening_owed_sen` (nullable; required by the
  service for credit accounts). Existing `credit_card` rows get `NULL` and show a "set billing
  cycle" prompt until configured. While unconfigured, their owed amount is shown without bills.
- New `expense_installments` (above).
- New `credit_bill_payments(id, user_id, account_id → accounts, bill_year, bill_month,
  amount_sen, paid_date, from_account_id → accounts, created_at)`, `user_id`-scoped.

## Phases

**A — Removals.** Budgets (tab, `BudgetService`, `engine/budgets.ts`, repository, components,
uiStore fields, table); allowance, safe-to-spend and buffer (`engine/cashflow.ts` formula,
`HeroCard`, `SafeToSpendCard`, `FormulaCard`, `BudgetBar`, the Settings buffer editor); the
Transfer and Scan buttons; the Payroll UI. `CashFlowService` reduced to spent + due-by-month-end.
AI `allowance` removed and snapshots trimmed. Tests updated. Ships on its own.

**B — Credit bills.** Schema, `engine/creditBills.ts` (cycle, due date, instalment split, bill
derivation, carry-forward), `CreditBillService` (list bills, pay, undo), account form cycle
fields + `paylater` type, expense form "Split into months" + interest %, bills on the
Commitments screen with Pay, and Home's due total including bills.

**C — Analytics.** `spendingSeries` engine + service, new Analytics screen.

## Tests

- `creditBills` engine: the S8 example; statement day 31 in Feb; due-day-before-statement
  rolls to next month; instalment split with remainder and interest; part *k* landing *k* bills
  later; editing a closed-bill expense; overpayment carry-forward; opening balance.
- Year and leap-year boundaries added to `boundaries.test.ts`.
- Service: pay is one transaction, double pay refused, undo restores both balances, and an
  instalment expense's `amount_sen` matches the sum of its parts.
- Invariant test: for any sequence of expenses and payments, `owed == opening + Σ charges − Σ payments`.
- No double count: SPL purchase + bill payment → spending increases once.
- `spendingSeries`: zero-fill, Monday weeks, month window across a year boundary, category filter.

## Out of scope

Visual redesign (next plan); income tracking; transfers between asset accounts; late fees;
SPL-specific import.

## Docs to update when this lands

`docs/PRD.md` (goals, §7.1, remove §7.3, new credit-account section, §7.5, D2 retired),
`docs/ARCHITECTURE.md` (cash-flow section, new tables), `CLAUDE.md` (budget idempotency note,
payroll note, invariants list).
