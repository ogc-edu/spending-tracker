# Spending Tracker — Architecture

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **PRD** | [PRD.md](./PRD.md) (Approved 2026-09-01) |

---

## 1. Overview & Principles

Android-first → now **iOS + Android** (rev. 2026-09-01, A16), local-first React Native (Expo) app. A four-layer separation of concerns, per the spec:

```
Screen                     ->  AIService -> GeminiProvider -> Gemini API
  -> Application Service
    -> Repository (interface)
      -> Drizzle ORM -> expo-sqlite -> SQLite
```

Non-negotiable rules:

1. **UI never contains SQL or financial math.** Screens render; services compute; repositories persist.
2. **The financial engine is pure.** No I/O, no date calls — dates and data are passed in, so every calculation is unit-testable and deterministic.
3. **Money is integer sen everywhere** (`*_sen` columns, `MoneySen` domain type). No floats.
4. **SQLite is the single source of truth.** State stores hold UI state only; financial values are always computed on demand from the database.
5. **AI is an adapter.** The financial engine never knows Gemini exists; AI receives computed aggregates only.

## 2. Components

| Component | Responsibility | Depends on |
|---|---|---|
| **Screens** (Expo Router) | Rendering, form input (React Hook Form + Zod), navigation, AI action buttons | Services, Store |
| **Application services** | Orchestration, business rules, transactions, validation, assembling engine inputs | Repositories, Engine, AIService |
| **Financial engine** (`engine/`) | Pure deterministic calculations (see §6) | nothing |
| **Repositories** (interfaces + Drizzle impls) | Persistence; the only layer that touches Drizzle/SQLite | Drizzle schema/client |
| **Drizzle + expo-sqlite** | Schema, migrations, SQLite storage | — |
| **AIService** (`ai/`) | Abstraction over AI providers; prompt assembly from structured data; response validation | GeminiProvider → Gemini API |
| **Store** (Zustand) | Non-persistent UI state: selected month, active filters, last-used category/account | — |
| **AuthService** (`services/`) | Register/login/logout; Argon2id verification; session persistence (SecureStore); exposes the current user to services/repositories | UserRepository, PasswordHasher |
| **PasswordHasher** (`auth/`) | `hash`/`verify` contract; Argon2IdHasher (native) for devices, FakeHasher for Jest | react-native-argon2 |
| **Utils** | Money (sen ↔ display), local-date handling, formatting | — |

## 3. Project Structure

```
spending-tracker/
├── app/                          # Expo Router
│   ├── _layout.tsx               # init gate + AuthProvider routing gate
│   ├── login.tsx / register.tsx  # auth screens (outside tabs)
│   ├── (tabs)/                   # Dashboard, Expenses, Budgets, Commitments, Analytics, Settings
│   ├── expenses/{new,[id],edit}.tsx
│   └── commitments/{new,[id]}.tsx
├── src/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema — single source of truth
│   │   ├── client.ts             # expo-sqlite + drizzle init
│   │   └── seed.ts               # 12 default categories (users seeded in 003)
│   ├── auth/                     # passwordHasher.ts (contract + fake), argon2Hasher.ts, AuthProvider.tsx
│   ├── repositories/
│   │   ├── types.ts              # interfaces (future cloud impls implement the same)
│   │   └── drizzle/              # Drizzle implementations, one file per entity
│   ├── services/                 # AuthService, ExpenseService, BudgetService, CommitmentService,
│   │                             # AccountService, CashFlowService, AnalyticsService
│   ├── engine/                   # PURE financial engine (no imports of db/services)
│   ├── ai/
│   │   ├── AIService.ts          # interface + factory
│   │   └── providers/GeminiProvider.ts
│   ├── store/                    # Zustand: uiStore (month, filters, last-used)
│   ├── utils/                    # money.ts, dates.ts, format.ts
│   └── types/                    # domain types (MoneySen, Month, etc.)
├── drizzle/                      # drizzle-kit generated migrations
├── docs/
└── src/engine/__tests__/         # engine unit tests (Jest)
```

## 4. Data Model (Drizzle)

Refined from the spec schema (money columns suffixed `_sen`; two structural additions for D3 and budget uniqueness).

| Table | Columns (key additions bolded) | Notes |
|---|---|---|
| `users` | id, email (**UNIQUE, COLLATE NOCASE**), password_hash (Argon2id encoded), created_at | seeded with the default user in feature 003 |
| `categories` | id, name, icon, type, created_at | seeded with the 12 defaults; **global** (shared by all users); editable in a future version |
| `accounts` | id, **user_id FK**, name, type (`cash`\|`bank`\|`ewallet`\|`credit_card`), balance_sen, created_at, updated_at | balance_sen on a credit card = **amount owed** (positive); counted negatively in "available" |
| `expenses` | id, **user_id FK**, amount_sen, category_id FK, description, date (TEXT `YYYY-MM-DD`, local), account_id FK **nullable**, **commitment_payment_id FK nullable UNIQUE**, created_at, updated_at | unique link enforces D3 idempotency (a payment's expense is created exactly once) |
| `budgets` | id, **user_id FK**, category_id FK **nullable** (NULL = overall), month (1–12), year, amount_sen, **UNIQUE(user_id, category_id, month, year)** | upsert semantics: editing a month's budget replaces its row |
| `commitments` | id, **user_id FK**, name, type, **total_sen nullable**, remaining_sen, payment_sen, frequency (`monthly`\|`one_time`), start_date, end_date **nullable**, due_date, status (`active`\|`completed`\|`cancelled`), **archived_at nullable**, created_at, updated_at | total_sen NULL = ongoing recurring (rent/subscription); fixed otherwise; `archived_at` = soft-delete (C1, plan 008) |
| `commitment_payments` | id, **user_id FK**, commitment_id FK, amount_sen, due_date, paid_date **nullable**, status (`paid`) | **stores only PAID payments** (see §7); unpaid schedule is derived |

Foreign keys enforced (PRAGMA foreign_keys = ON). Indexes: `users(email)` (unique covers it), `expenses(date)`, `expenses(category_id)`, `budgets(user_id,category_id,month,year)` (unique covers it), `commitments(status)`, `commitment_payments(commitment_id)`, plus a `user_id` index on each financial table.

## 5. State Management

- **SQLite = source of truth.** No data cache in Zustand; screens re-read via services on focus (`useFocusEffect`). This makes "values update when financial data changes and as the calendar advances" free — `now` is always derived at call time.
- **Session state lives in AuthProvider** (React context): `{status: loading | signedOut | signedIn, user}`. The persisted part is just the current user id in SecureStore; on boot it is validated against `users`. Everything else (including the user's data) is read from SQLite on demand.
- Zustand holds only: selected month (analytics/expenses), active filters, last-used category/account (fast entry), transient UI flags. State is not persisted.

## 6. Financial Engine (pure module)

`src/engine/` — zero imports from `db/`, `services/`, or `ai/`. Every function takes explicit inputs including a `referenceDate`/month:

- `monthlyTotals(expenses, {month, year}) → {total, perCategory}`
- `budgetMetrics(budgetSen, spentSen) → {spent, remaining, pctUsed, overBudget}`
- `commitmentSchedule(commitment) → Payment[]` (derivation, §7)
- `upcomingCommitments(commitments, paidPayments, windowEnd) → {total, items}` (unpaid, due < windowEnd, incl. overdue)
- `safeToSpend({availableSen, upcomingSen, remainingBudgetSen, bufferSen}) → {safe, dailyAllowance}` — PRD §8.4 formula; `safe` may be negative (deficit)
- `dailyAllowance(safeSen, today, monthEnd) → sen` — integer floor to sen
- `analytics(expenses, {month, year}, previousMonth) → {total, momChangePct, avgDaily, largest, topCategories, budgetUtilization, projection}`
- `projectMonthEnd(spentSen, elapsedDays, daysInMonth)` — `spent ÷ elapsed × daysInMonth`, floor to sen

**Rounding policy (documented, deterministic):** divisions floor to the nearest sen; percentages are displayed with one decimal, computed from integer sen (e.g. `floor(spent×1000/budget)/10`).

## 7. Commitment Schedule Derivation

Payments are **derived, not materialized** — `commitment_payments` stores only paid records. This eliminates schedule/data drift and infinite rows for ongoing commitments.

| Shape | Rule |
|---|---|
| One-time | Single payment: amount = payment_sen, due on `due_date` |
| Fixed monthly (`total_sen` set) | N payments where N = `ceil(total/payment)` (or months from `start_date` to `end_date` inclusive if end_date set); due = `start_date` + k months; amount = payment_sen for k < N−1, remainder `total − (N−1)·payment` for the last (≥ 1 sen) |
| Ongoing monthly (total NULL) | Infinite series anchored at `start_date`; engine only materializes payments falling inside the query window |

Day-of-month clamping: when a month lacks the anchor day (e.g., Jan 31 → Feb), the due date clamps to the last valid day of that month. Deterministic; documented in `dates.ts`.

**Mark-paid (D3):** user picks a scheduled slot → transaction: (1) insert `commitment_payments` row (due_date = slot's due date, paid_date = today); (2) decrement `remaining_sen`; (3) create linked `expenses` row (category **Debt / Repayment**, `commitment_payment_id` = new row, account optional — UI prefills last-used account); (4) if an account was chosen, adjust its `balance_sen`. The unique `commitment_payment_id` makes double-tap idempotent.

**Upcoming-commitment window** (dashboard/cash flow): all active commitments except `one_time` paid; fixed monthly: unpaid slots with due < next-month-start; ongoing: derived slots in same window; overdue unpaid slots are included (they still must be paid). `cashFlowSnapshot` sums these — disjoint from expenses by construction (PRD §8.3).

## 8. Cash-Flow Pipeline

```
Screen (Dashboard) → CashFlowService.snapshot(now)
  → AccountRepository.sumBalances (credit-card owed amounts subtracted)
  → ExpenseRepository.sumByMonth
  → BudgetRepository.overallFor(month, year)
  → CommitmentRepository.allActive + paidPayments
  → engine.safeToSpend(...)            // PRD §8.4
  → typed snapshot {available, spent, budget, remaining, upcoming, safe, daily, breakdown[{label, amount}]}
```

The snapshot is what the UI renders and what "Explain my allowance" sends to AI (with the formula's components).

## 9. AI Service

```ts
interface AIService {
  analyze(context: "debt" | "spending" | "allowance", snapshot: FinancialSnapshot): Promise<AIResult>;
}
```

- Two providers behind the abstraction (A14): `GeminiProvider` (**API-key auth** via `x-goog-api-key`, never OAuth — AQ-format keys live-verified 2026-09-01; v1beta REST) and `DeepSeekProvider` (OpenAI-compatible `chat/completions` + `GET /models` at `api.deepseek.com`, `Authorization: Bearer` — API shape verified from official docs; live check when a user key is added). Both implement `testConnection` / `listModels` / `generate`; **no models are hardcoded — discovery only**, with manual model-ID entry as the fallback.
- **Input hygiene:** AI receives aggregates and category names only — raw free-text descriptions are **not** sent (reduces sensitive data leakage and prompt-injection surface).
- **Output hygiene:** response parsed and Zod-validated (`AIResult {summary, points[]}` — presentation only, never merged into financial state). Failures map to a typed `AIUnavailableError` (offline/timeout/HTTP/key).
- **Keys (BYOK):** user-supplied, per local user, in **expo-secure-store** (`key:{provider}:{userId}`) — never SQLite/Zustand/AsyncStorage; masked in UI; never logged or committed. No bundled key, no OAuth. Active provider + per-provider selected model persist as non-secret preferences in the `settings` table (010). **No automatic fallback** — the user explicitly picks the active provider; with none configured, AI actions show "No AI provider configured" and the app works fully.
- Adding a future provider = new class behind `AIService`; the engine and UI never change (PRD AI-5).

## 10. Data Flows (key paths)

| Flow | Path |
|---|---|
| Register | Login screen → AuthService.register → hash (Argon2id) + insert + session → Redirect to (tabs) |
| Login / logout | Login screen → AuthService.login → verify → session / logout clears → Redirect; root gate blocks tabs while signed out |
| Add/edit/delete expense | Screen (Zod form) → ExpenseService → drizzle **transaction** {expense row ± account balance} → screen refetch on focus |
| Set budget | Screen → BudgetService.upsert (unique-key replace) |
| Create commitment | Screen → CommitmentService → insert + `remaining_sen = total`; schedule derived, nothing else written |
| Mark payment paid | Screen → CommitmentService.markPaid (transaction as §7) |
| Dashboard | §8 pipeline, computed per render |
| Analytics | Screen → AnalyticsService → engine → charts/lists |
| AI action | Screen → AIService.analyze(context, snapshot) → spinner → validated result or inline error |

## 11. Failure Handling

- **Migration failure at startup** → full-screen error with Retry (no partial state).
- **Write failures** → Drizzle transaction rollback; user-visible toast; state unchanged.
- **AI unavailable** → inline error panel on the contextual action only; all other functionality untouched (PRD §11.16, NFR-1).
- **Deficit state** (safe < 0) → rendered as a warning state, not an error; dashboard prompts "cover commitments + buffer before discretionary spending".
- **Double-tap / races** → unique constraint on `expenses.commitment_payment_id` + upsert-on-budget-key make writes idempotent.

## 12. Security Boundaries

- Single-user-per-session local auth: Argon2id (`hash-wasm`, time=2, 64 MiB, par=1, 32-byte salt/hash), per-user random salt; SQLite at rest is unencrypted inside the device sandbox. This is a **local gate, not production auth** — superseded by a future web backend (the user's own AWS auth system applies there).
- Hashing is pure WASM (`hash-wasm` Argon2id — no native module): **Expo Go works on both platforms**; dev builds only for optional native tooling (amended 2026-09-01, A16; implementation swap session pending — plan 003).
- Session: current user id in SecureStore; validated at boot; logout clears it.
- SQLite lives in app-private storage per platform (Android app-private dir; iOS Library/) — same driver (`expo-sqlite`), same schema.
- Gemini key in SecureStore (obfuscation only — not a real secret store; explicitly documented insecure for distribution).
- AI actions are explicit user gestures; every request sends only computed aggregates (§9) — never the full expense list with descriptions.
- No network permissions needed beyond the AI call; everything else offline-capable.

## 13. Scalability & Performance

- Single-user local data (thousands of rows/ year) → compute-on-demand is trivially fast with the indexes in §4. No materialized aggregates, no caches (they'd risk staleness — exactly what the calendar-advance requirement forbids).
- Future cloud/web: repositories are interfaces; engine is dependency-free; Drizzle schema ports to Postgres-compatible deployments; AIService already decoupled. This is the entire migration story — no other changes required.

## 14. Observability

- Structured console logger at the service layer (`logger.info/error` with context tags), timings on AI calls and dashboard snapshots.
- No crash-reporting or analytics SDKs in the MVP (privacy + scope).

## 15. External Dependencies

Runtime: `expo`, `expo-router`, `expo-sqlite`, `expo-secure-store`, `drizzle-orm`, `zustand`, `react-hook-form`, `zod`, `@google/generative-ai`.
Dev: `drizzle-kit`, `jest`, `jest-expo`, `typescript`.

## 16. Architectural Decisions (recorded)

| ID | Decision | Choice | Status |
|---|---|---|---|
| A1 | SQLite access | **Drizzle ORM** (schema-as-TS, typed queries, drizzle-kit migrations) — user decision 2026-09-01; tradeoff noted: one extra dependency + abstraction vs the raw-SQL alternative; Drizzle's schema object is reusable for the future web/cloud DB | Confirmed |
| A2 | Dashboard aggregates | Compute-on-demand from SQLite; **no** materialized summary tables (single-user scale; always consistent; calendar advance needs nothing) | Confirmed |
| A3 | Commitment payments | Derive schedule on the fly; persist only paid records (no drift, no infinite rows) | Confirmed |
| A4 | Zustand role | UI state only; SQLite is the source of truth (no data cache) | Confirmed |
| A5 | Auto-created Debt expense (D3) | Account optional; UI prefills last-used account; balance adjusts when an account is chosen; unique `commitment_payment_id` = exactly-once | Confirmed |
| A6 | AI input hygiene | Aggregates + category names only; raw descriptions never sent; responses Zod-validated; key in SecureStore | Confirmed |
| A7 | Local login hashing | **Argon2id** via `react-native-argon2` (time=2, memory=64 MiB, parallelism=1, 32-byte) — mirrors the user's auth-system params; dev-build requirement documented | Confirmed |
| A8 | Session | Auto-login (current user id in SecureStore, validated at boot); explicit logout; stale id → signed out | Confirmed |
| A9 | Password policy | **None** — any non-empty password; seeded `1234` is a deliberate exception | Confirmed |
| A10 | Data scoping | Financial tables carry `user_id`; categories global; every repository query user-scoped | Confirmed |
| A11 | Default user seed | `ooiguancheng18@gmail.com` / `1234` created on first run when `users` is empty (hash computed with the real hasher) | Confirmed |
| A12 | Commitment soft-delete (C1) | Archive via `archived_at` (hidden from lists/upcoming/analytics, restorable); hard delete only for zero-payment commitments | Confirmed |
| A13 | Gemini auth (G1, rev. 2026-09-01) | API-key auth (`x-goog-api-key` / `GEMINI_API_KEY`), never OAuth — AQ-format key live-verified 2026-09-01; **no pinned model — discovery only** (catalogs churn: 2.0-flash retired, DeepSeek chat → v4-*) | Confirmed |
| A14 | AI BYOK (rev. 2026-09-01) | Gemini + DeepSeek providers, user-supplied keys (SecureStore, per local user); test connection; model discovery + manual entry fallback; explicit active provider, **no automatic fallback**; hardcoded endpoints; keys never in SQLite/logs/git | Confirmed |
| A15 | Account-required (deviation 2026-09-01) | **Manual expenses require an account** (ACC-2 determinism; closes the spent-without-available hole; account deletion stays safe — no unlinked orphans). DB column remains nullable **only** for plan-008 auto-created repayment expenses with no paying account (balance adjustment skipped); form uses last-used default so it costs one tap | Confirmed |
| A16 | Cross-platform & hasher (2026-09-01) | **iOS + Android** in MVP (web out). Argon2id implementation swapped `react-native-argon2` → **`hash-wasm`** (same Argon2id v1.3 params, A7 intact) → no native module: **Expo Go works**, dev-build constraint removed. `ios.bundleIdentifier` already in app.json. Swap verification: known-vector test + a hash captured from a native build. iOS Keychain note: SecureStore entries survive app reinstall on iOS — handle explicitly in 016 | Confirmed |

Alternatives considered: raw SQL + hand-rolled migration runner (my original recommendation — zero deps, more explicit SQL) and Kysely (typed builder, smaller expo-sqlite ecosystem); user chose Drizzle. Materialized payment rows rejected (A3); Zustand-as-cache rejected (A4); Gemini without SDK (raw fetch) rejected for MVP simplicity.

## 17. Open Items

- Exact Gemini model (flash vs flash-lite) — resolved in the AI feature plan.
- All items marked "future" in PRD §13 remain out of scope.