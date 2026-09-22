# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo version discipline

`AGENTS.md`: Expo has changed — read the **versioned** docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code. This project is on Expo SDK 57 /
React Native 0.86 / React 19 / New Architecture; older Expo answers from memory are usually wrong.

## Commands

```bash
npm start                 # Expo dev server → Expo Go (Android + iOS; no dev build needed)
npm run ios | android     # optional native dev builds (native tooling only)
npm test                  # Jest (jest-expo). Default preset behaves as ios — see below
npm run test:ios          # explicit ios preset
npm run lint              # eslint-config-expo
npm run typecheck         # tsc --noEmit
npm run db:generate       # drizzle-kit generate → drizzle/*.sql + regenerated migrations.js
```

Single test / focused runs:

```bash
npx jest src/engine/__tests__/cashflow.test.ts
npx jest -t "safe to spend"
npx jest src/engine            # everything under a directory
```

Tests only match `**/__tests__/**/*.test.ts(x)`. `@/*` maps to `src/*` in both tsconfig and Jest.
`src/theme/__tests__/tokens.test.ts` asserts `moneyFontVariant === ['tabular-nums']`, which pins the
suite to the ios preset — a preset change breaks it deliberately.

## Architecture

Strict four-layer separation (full design in `docs/ARCHITECTURE.md`; the docs, not the chat, are the
source of truth — see also `docs/PRD.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/plans/NNN-*.md`):

```
Screen (src/app, expo-router) → Service (src/services) → Repository interface (src/repositories/types.ts)
                                        ↓                          ↓
                               Engine (src/engine, pure)   Drizzle impl → expo-sqlite
Screen → AIService (src/ai) → GeminiProvider | DeepSeekProvider
```

Non-negotiable invariants — breaking one breaks tests and the migration story:

1. **UI contains no SQL and no financial math.** Screens render and collect form input
   (React Hook Form + Zod); services orchestrate and own transactions; repositories are the only
   layer importing Drizzle.
2. **`src/engine/` is pure.** No imports from `db/`, `services/`, `ai/`; no `Date.now()`, no I/O —
   `referenceDate`/month is always an argument. This is what makes month/leap-year/rollover behavior
   testable (`src/engine/__tests__/boundaries.test.ts`).
3. **Money is integer sen everywhere** (`*_sen` columns, sen ints in domain types). `src/utils/money.ts`
   is the only sen ↔ string seam; it *throws* on >2 decimals rather than rounding. Divisions floor to sen.
4. **SQLite is the single source of truth.** Zustand (`src/store/uiStore.ts`) holds UI state only
   (selected month, filters, last-used category/account) and is not persisted. Screens re-read via
   services on focus (`useFocusEffect`) so values update as the calendar advances.
5. **Dates are local `YYYY-MM-DD` strings**, not `Date` objects — no timezone anywhere
   (`src/utils/dates.ts`, incl. day-of-month clamping for months that lack the anchor day).
6. **AI is an adapter.** It receives computed aggregates and category names only — never raw expense
   descriptions — and its Zod-validated output is presentation-only, never merged into financial state.
   Plan 019 adds one exception, made safe: the Dashboard "Ask about your money" box sends a capped
   user `question` as a **distinct field** after the snapshot; it is never interpolated into the fixed
   system instruction (which tells the model to treat it as data, not as an instruction).

### Database

- `src/db/schema.ts` is the schema source of truth and must load **without** expo-sqlite.
- `src/db/client.ts` is the only module importing `expo-sqlite`. `initDb()` = open + pragmas
  (WAL, `foreign_keys` per connection) → migrations → seed categories → seed default user; it is
  single-flight and clears its promise on failure so the root-layout Retry screen re-runs cleanly.
- Migrations: edit `schema.ts` → `npm run db:generate` → **commit** `drizzle/*.sql` and the generated
  `drizzle/migrations.js`. The app applies the bundle via the expo migrator (`src/db/migrate.ts`);
  `babel-plugin-inline-import` + `metro.config.js` `sourceExts.push('sql')` make the `.sql` imports work.
- Tests never touch a device: `src/db/testing.ts` runs the **same committed SQL** against an in-memory
  better-sqlite3 DB (`createMigratedTestDb()`).
- Repositories are wired through `repositories()` in `src/db/repositories.ts`; screens never call `getDb()`.

### Domain rules worth knowing before editing

- **Commitment payments are derived, not materialized.** `commitment_payments` stores only *paid* rows;
  the schedule comes from `src/engine/commitments.ts` (ongoing commitments are an infinite series
  materialized only inside the query window).
- **Mark-paid is one transaction**: paid row + `remaining_sen` decrement + linked expense + optional
  account balance adjustment. `expenses.commitment_payment_id` is UNIQUE, which is what makes a
  double-tap idempotent. Budgets are idempotent via `UNIQUE(user_id, category_id, month, year)` upsert.
- **Payroll-in** (`PayrollService`, `payroll_allocations`) is a standing split of pay across
  accounts, applied by one button. It *credits balances only* — the app models expenses, not income,
  so a deposit writes no expense row and the engine is untouched. Credit cards are refused as targets
  (their balance is money owed). The deposit and its last-run stamp are one transaction.
- Every financial table is `user_id`-scoped; categories are global. Credit-card `balance_sen` is
  amount *owed* and subtracts from "available".
- Auth is a **local gate, not production auth**: PBKDF2-SHA256 via `@noble/hashes`, 10,000 iterations
  (Hermes is ~100× slower than V8; Argon2/WASM does not run on Hermes). Session = user id in
  SecureStore, validated against `users` at boot. BYOK AI keys live in SecureStore under
  `key:{provider}:{userId}`, never SQLite/Zustand; active provider + model are non-secret rows in `settings`.

### Theme

Use `@/theme` tokens (`colors`, `spacing`, `radius`, `shadows`, `typography`, `MIN_TOUCH_TARGET`) —
no literal hex or magic padding in components. Token contrast (WCAG AA) and the 44pt touch target are
asserted in `src/theme/__tests__/tokens.test.ts`, so darkening/lightening a color needs the test updated
with recomputed ratios. Single light theme; dark mode is future work.

## Notes

- Commit style: `type(scope): summary` (e.g. `feat(commitments): …`, `fix(auth): …`).
- README's "Run it" section still says Argon2id/hash-wasm; the shipped hasher is PBKDF2
  (`src/auth/pbkdf2Hasher.ts`, decision A7 rev). Trust the code and `docs/ARCHITECTURE.md` §12.
