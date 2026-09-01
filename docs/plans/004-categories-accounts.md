# 004 — Categories & Accounts

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002, 003 |
| **PRD** | §7.7 accounts; §7.2 EXP-7 categories |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 004 |

## Objective

User can create and list accounts (Cash, Bank, E-wallet, Credit card) with initial balances; seeded categories are queryable and used by the expense form (005). This establishes the "available money" primitives with the auto-adjust contract (D1) the rest of the app relies on.

## Context

Accounts are the source of "Current available money" (PRD §7.7/§8.4): available = Σ balances, credit-card owed amounts counted negative (D1). Balances auto-adjust from expenses (implemented in 004); this plan only creates/list s accounts and proves the sum semantics. Categories come seeded from 002 and are read-only in the MVP (customization is future, PRD §3).

## Requirements

- Create account: name, type (`cash` | `bank` | `ewallet` | `credit_card`), initial balance in RM (converted to sen).
- List accounts with balance; credit-card rows display the amount as **Owed** (never as a positive available balance).
- Delete account only when no expenses reference it; otherwise blocked with an explanatory message (FK-protected).
- `AccountRepository.sumBalances()` returns available-money math (credit negative) — the primitive the cash-flow engine (009) consumes.
- Category repository: list all, get by id — used by expense/budget forms (005/007). No category editing UI.
- Accounts management lives in the **Settings** tab (no dedicated tab; PRD §7.9/§7.10).

## Technical Design

### Domain types

```ts
type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit_card';
interface Account { id; name; type: AccountType; balanceSen: number; createdAt; updatedAt; }
type Category = { id; name; icon; type; createdAt; }
```

### Repository contracts (interfaces for future cloud impls — ARCHITECTURE §10)

`src/repositories/types.ts`:

```ts
interface AccountRepository {
  create(input: {name, type, initialBalanceSen}): Promise<Account>;
  list(): Promise<Account[]>;
  byId(id): Promise<Account | null>;
  sumBalances(): Promise<number>;   // SUM(balance_sen) with credit_card → -balance_sen
  countExpenses(id): Promise<number>; // for delete-blocking
  delete(id): Promise<void>;        // throws when referenced
}
interface CategoryRepository { list(): Promise<Category[]>; byId(id): Promise<Category|null>; }
```

Drizzle implementations in `src/repositories/drizzle/`; wired via a lightweight factory (`src/db/index.ts` exports `repositories`). The `sumBalances` SQL: `SUM(CASE WHEN type='credit_card' THEN -balance_sen ELSE balance_sen END)` — one deterministic query, tested.

### UI (Settings tab)

- Accounts section: list (name, type badge, balance; credit card shows "Owed RM…"), "Add account" button.
- Add form (React Hook Form + Zod): name (required), type (segmented picker), initial balance (decimal-input, sen conversion via `utils/money.ts` — `parseMoneyToSen("120.50") → 12050`).
- Delete: long-press or row action → confirm → attempt; on FK violation show "This account has expenses and can't be deleted".
- Categories: read-only preview section (optional, cheap): name + icon chips from the 12 seeds (proves the repository works; main consumer is 004's form).

### Money util (`src/utils/money.ts`)

`parseMoneyToSen(input): number` (rejects >2 decimals, NaN, negative), `formatSen(sen): string` ("RM1,900", "RM0.50"). Rounding: truncate excess decimals (fail validation instead of silently rounding). Unit-tested here; engine (009) reuses `formatSen` for display only.

## Files / Components Likely Affected

- `src/repositories/types.ts`, `src/repositories/drizzle/accountRepository.ts`, `categoryRepository.ts` (new)
- `src/services/AccountService.ts` (validation + orchestration; thin)
- `app/(tabs)/settings.tsx` — accounts list + add form
- `src/utils/money.ts` (new, tested)
- `src/components/AccountRow.tsx`, `src/components/AccountForm.tsx` (new)

## API Changes

Internal: `AccountService.list/create/delete`, `CategoryService.list` — consumed by screens now, by forms later.

## Database Changes

None beyond 002's schema (accounts/categories exist). First repository implementations land.

## Dependencies

002 (schema, migrations, seed, test harness).

## Edge Cases

- **Duplicate account names**: allowed (no constraint) — names are labels, not keys.
- **Initial balance 0**: valid default; forms prefill 0.
- **Credit card owed semantics**: user enters the *amount owed* as a positive number; stored positive; `sumBalances` negates it. UI labels it "Owed" to avoid confusion.
- **Delete with expenses** → blocked + message; DELETE CASCADE is deliberately NOT configured.
- **Sen conversion**: "12.345" rejected by Zod regex; "12." rejected; "." rejected.
- **Large balances**: JS `number` handles sen values up to ~9e15 — far beyond practicality; no BigInt needed (documented).

## Security Considerations

- None (local data, no credentials). Account data is user-private in app storage.

## Tests

- `money.ts`: parse/format matrix (valid, 2-decimal edge, invalid inputs, large values).
- `AccountRepository` (better-sqlite3 harness): create → list round-trip; `sumBalances` with mixed cash/bank/credit (expected: cash+bank−credit); delete blocked when `countExpenses > 0`; delete succeeds on empty account.
- `CategoryRepository.list` returns the 12 seeds in seed order.
- Zod form schema: rejects 3-decimal amounts, empty names, unknown types.

## Acceptance Criteria

1. In Settings: add accounts of each type with balances; list displays correctly (credit = "Owed").
2. `sumBalances` returns the documented signed total (verified by test).
3. Deleting an account with expenses is blocked with a clear message.
4. Category list available via repository (12 items).
5. `npm test` green; typecheck/lint green.

## Out of Scope

- Balance editing after creation (D1 — derived from expenses in 004), account delete-unassign flow, category editing UI, multiple currencies, bank sync.