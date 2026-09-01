# Spending Tracker — Product Requirements Document (PRD)

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01, rev. 3: AI BYOK) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Platform** | Android + iOS (React Native + Expo); web out of MVP (A16) |
| **MVP scope** | Local-first personal expense tracker with budgets, commitments, cash-flow awareness, and contextual AI analysis |

---

## 1. Problem

People spend money faster than their calendar obligates it. Bills, installments, and repayments arrive after the cash is gone, leaving users to discover shortfalls too late. Existing trackers record the past (what was spent) or the future (what is owed), but rarely answer the daily question: *"how much can I actually spend right now?"*

The app solves this by combining manual expense tracking, budgets, and future commitments into a single deterministic **cash-flow view**: available money minus what is already committed equals what is safe to spend today.

**Core principle — the application calculates, AI interprets.** Every financial figure (totals, balances, budgets, commitment schedules, safe-to-spend) is computed deterministically by application code. AI only receives pre-calculated structured data and turns it into human-readable analysis. AI is never used for ordinary expense entry and never performs financial calculations.

## 2. Goals

1. Record a daily expense in a few seconds (amount, category, description, date, account).
2. Set an overall monthly budget and per-category budgets, with deterministic spent/remaining/over-budget status.
3. Track future commitments (installments, bills, debts) with individual payment tracking.
4. Calculate safe-to-spend money and a daily spending allowance from available money, commitments, the monthly budget, and a user-defined safety buffer.
5. Provide deterministic analytics: category breakdown, month-over-month change, averages, largest expenses, projection.
6. Provide contextual AI analysis of commitments and spending without a general chatbot.
7. Work fully offline for every non-AI feature.
8. Keep all financial calculations independent of the UI and database, unit-testable on their own.
9. Provide local user accounts (register/login/logout) with per-user data isolation — the seam a future web + cloud migration will reuse.

## 3. Non-Goals (MVP)

- No web application, cloud database, synchronization, or backend server.
- No cloud authentication, password recovery, email verification, or MFA — login is **local-only** in the MVP (per-user data isolation on-device, offline); a future web backend will bring real auth.
- No Firebase / Supabase / PostgreSQL / Cognito.
- No bank integration or automatic transaction import.
- No general-purpose AI chatbot / natural-language command routing.
- No multi-currency support (MYR/RM only), no currency selection.
- No weekly-frequency commitments (monthly and one-time only).
- No manual account-balance editing after creation (balances are derived from expenses; initial balance is set at creation).
- No category customization UI (categories are database entities now so they can be customized later).
- No recurring/automated expense generation, no CSV import/export.
- No AI provider selection UI (Gemini only, behind an abstraction).
- No AI fallback providers.

## 4. Users

**Sole user (single-device personal tool).** A Malaysian individual managing everyday ringgit spending, monthly budgets, and obligations such as rent, phone bill, credit-card repayment, installments (BNPL/loan), subscriptions, and money owed. Not a family/shared account; not an accountant; no multi-currency needs. English-language UI.

## 5. User Flows (primary)

1. **Record an expense** — open app → tap "+" → amount, category, description, date, account → save. Few seconds, works offline.
2. **Check the day** — open Dashboard → see available money, spent this month, remaining budget, upcoming commitments, safe-to-spend, daily allowance, category summary.
3. **Set a budget** — Budgets → set overall monthly amount → optionally set per-category amounts → see spent/remaining/percentage/over-budget per category.
4. **Create a commitment** — Commitments → new → name, type, total/amount, frequency (monthly or one-time), dates → app derives the payment schedule → mark payments paid as they happen (each paid payment records an expense in **Debt / Repayment**).
5. **Understand obligations** — Commitments → "Analyze my debt" → app computes upcoming-payment totals, AI explains them.
6. **Understand spending** — Analytics → month view → "Analyze my spending" → app computes the numbers, AI interprets them.
7. **Understand allowance** — Cash Flow view → "Explain my allowance" → app shows the formula components, AI optionally narrates.

## 6. Confirmed Decisions (2026-09-01)

| # | Decision | Choice |
|---|---|---|
| D1 | Account balance semantics | **Auto-adjust**: recording/editing/deleting an expense updates the linked account's balance. Available money = sum of all balances; credit-card accounts store the amount owed and count negatively. No manual balance editing after creation. |
| D2 | Cash-flow formula | **Conservative**: Safe = Available − Upcoming commitments − Remaining monthly budget − Safety buffer. Remaining budget uses the *overall* monthly budget only (category budgets do not enter the formula). |
| D3 | Paid commitment payments | **Auto-create linked expense**: marking a payment paid creates an Expense (category **Debt / Repayment**) linked to that payment. Paid payments are excluded from upcoming totals; the expense counts exactly once in spending. |
| D4 | Commitment frequencies | **Monthly + one-time** only. Weekly/yearly are future. Installments define a payment count or end date; recurring monthly commitments (rent, subscriptions) have no end date. |
| D5 | Project & docs location | `~/Documents/projects/spending-tracker/`, docs in `docs/` per auth-system convention (PRD / ARCHITECTURE / IMPLEMENTATION_PLAN / plans/NNN-*). |
| D6 | Local user accounts (user request 2026-09-01) | Register/login/logout on the local DB. **Argon2id** hashing via `hash-wasm` (pure WASM — no native module; params mirroring the user's auth-system: time=2, 64 MiB, par=1); **auto-login** session (SecureStore) with explicit logout; **no password policy**; seeded default user `ooiguancheng18@gmail.com` / `1234`; financial data **user-scoped** (`user_id`), categories global; login gates the whole app. |
| D7 | AI BYOK (user request 2026-09-01) | **Gemini + DeepSeek**, user-supplied API keys (per local user, SecureStore — never SQLite/logs/git); Test Connection; **model discovery only** (no hardcoded lists; manual model-ID entry when discovery fails); explicit **active provider**, no automatic fallback; hardcoded endpoints; app fully functional with no AI configured. |

### Assumptions (flag any that are wrong)

- Currency is MYR, stored as integer **sen**, displayed as RM with thousand separators.
- UI language is English.
- AI API keys are **user-supplied (BYOK)** and stored per user in SecureStore; nothing is bundled in the app.
- "Local calendar" = the device's configured timezone; month boundaries follow the device calendar.
- AI **models are discovered at runtime** from each provider's listing API — no hardcoded model lists (catalogs change: Gemini retired 2.0-flash; DeepSeek renamed chat → v4-*).
- Financial engine is pure TypeScript, unit-tested with Jest, independent of UI and SQLite.
- If no overall budget is set, the budget term in the cash-flow formula is `0` (dashboard shows a "set a budget" prompt).

## 7. Functional Requirements

### 7.1 Dashboard

| ID | Requirement |
|---|---|
| DASH-1 | Show, for the current calendar month: available money, total spent, monthly budget, remaining budget, upcoming commitments (unpaid, due before next month start), safe-to-spend, daily allowance. |
| DASH-2 | Show spending grouped by category for the current month (sorted by amount). |
| DASH-3 | Allow expanding the cash-flow section into a component breakdown of the safe-to-spend formula (Available − Commitments − Remaining budget − Buffer). |
| DASH-4 | Optional: "Explain my allowance" contextual AI action on the cash-flow section. |
| DASH-5 | Every dashboard value is computed deterministically by the financial engine (see §8). |

### 7.2 Expenses

| ID | Requirement |
|---|---|
| EXP-1 | Add expense: amount, category, description, date, **account (required — approved deviation 2026-09-01; nullable only for auto-created commitment-repayment expenses, plan 008)**. Amount in sen (integer), validated by Zod. |
| EXP-2 | Edit an expense (updates the same transaction — never silently duplicates), adjusting the linked account balance deterministically. |
| EXP-3 | Delete an expense (adjusts the linked account balance). |
| EXP-4 | Expense history, chronological (newest first), with detail view. |
| EXP-5 | Search by description; filter by category; filter by date range. |
| EXP-6 | Show the total for the currently filtered/selected period. |
| EXP-7 | Default categories (database entities, not hardcoded UI strings): Food, Groceries, Transport, Entertainment, Shopping, Bills, Health, Education, Travel, Gifts, Debt / Repayment, Other. |
| EXP-8 | Fast entry: defaults (today's date, last-used category/account) to minimize taps. |

### 7.3 Budgets

| ID | Requirement |
|---|---|
| BUD-1 | One overall monthly budget per (month, year); one category budget per (category, month, year). Editing replaces that month's value. |
| BUD-2 | Deterministic per-budget metrics: amount, spent, remaining, percentage used, over-budget state. |
| BUD-3 | Category budgets are informational (spent/remaining/over-budget indicators); only the overall budget enters the cash-flow formula. |
| BUD-4 | Remaining overall budget floors at 0 for months already over budget. |

### 7.4 Commitments / Debt

| ID | Requirement |
|---|---|
| COM-1 | Create a commitment: name, type (credit-card repayment, installment, BNPL, monthly bill, subscription, rent, phone bill, money owed, other), total amount, payment amount, frequency (monthly / one-time), start date, end date (optional), due date. |
| COM-2 | The app derives the payment schedule deterministically: for fixed installments a series of payments (last payment absorbs any remainder); for one-time commitments a single payment on the due date; for ongoing monthly commitments (no end date) payments derive on the fly within any query window. |
| COM-3 | Track individual commitment payments: commitment ID, amount, due date, paid date, status. |
| COM-4 | Mark a payment paid → records paid date, updates remaining_amount, and auto-creates a linked Expense in **Debt / Repayment** (D3). |
| COM-5 | Compute total amount due within any date window, in particular before the start of the next month — excluding paid payments (no double-count with expenses). |
| COM-6 | Statuses: active / completed / cancelled. Installment completion is determined by remaining_amount reaching 0. |
| COM-7 | Contextual AI action "Analyze my debt": app passes pre-computed structured figures (upcoming totals, biggest commitments, remaining balances) to AI. |

### 7.5 Analytics

| ID | Requirement |
|---|---|
| AN-1 | Current-month total spending; category breakdown; month-over-month comparison with absolute and percentage change. |
| AN-2 | Average daily spending (to date), largest expenses, highest-spending categories, budget utilization. |
| AN-3 | Basic projection: `spent to date ÷ elapsed days × days in month` (deterministic). |
| AN-4 | Month selector; comparison is against the previous calendar month. |
| AN-5 | Contextual AI action "Analyze my spending": AI explains trends, patterns, budget pressure, pace, projection — using only supplied data. |

### 7.6 AI Assistant (contextual only — not a general chatbot)

| ID | Requirement |
|---|---|
| AI-1 | AI is accessed exclusively through an application-level `AIService` abstraction → the **active provider** (`GeminiProvider` or `DeepSeekProvider`) → provider API. UI never talks to a provider directly. |
| AI-2 | AI actions available where context exists: Commitments → analyze debt; Analytics → analyze spending; Cash Flow → explain allowance. |
| AI-3 | AI receives only already-calculated structured financial data; it must not invent transactions, amounts, or trends. Its output is presentation, never authoritative financial data. |
| AI-4 | When the network/API is unavailable, AI actions show a clear error and nothing else is blocked. |
| AI-5 | Provider architecture: `GeminiProvider` and `DeepSeekProvider` implement the same capability interface (test connection, model discovery, generate); adding/switching providers never touches the financial engine or analysis UI. |
| AI-6 | Keys: **user-supplied (BYOK)**, stored per user in SecureStore (never SQLite, AsyncStorage, or persistent app state); masked in UI; never logged, committed, or included in errors; sent only to the provider's own auth mechanism — never to an app-owned server. |
| AI-7 | Test Connection (per provider): minimal real request; results distinguish invalid/unauthorized key, quota/rate limit, model unavailable, and network error. Never expose the raw credential. |
| AI-8 | Model discovery: official provider listing APIs, filtered to text-generation models suitable for financial analysis (no image/speech/embedding); **no hardcoded model lists** — if discovery fails but the credential is valid, allow manual model-ID entry. |
| AI-9 | Active provider: user selects among **configured** providers only; no automatic fallback; with none configured → "No AI provider configured" and every non-AI feature works normally. |
| AI-10 | Selected model is stored as a preference (settings table) separate from the credential (SecureStore); if a model becomes unavailable, the app tells the user to re-select. |
| AI-11 | Provider endpoints hardcoded (no custom base URL); provider-specific auth encapsulated per provider (Gemini `x-goog-api-key`; DeepSeek `Authorization: Bearer`). |

### 7.7 Accounts

| ID | Requirement |
|---|---|
| ACC-1 | Create and list accounts: name, type (Cash, Bank account, E-wallet, Credit card), initial balance at creation. |
| ACC-2 | Recording/editing/deleting an expense auto-adjusts the linked account's balance (credit card: an expense increases the owed amount). |
| ACC-3 | Available money = sum of balances; credit-card balances (owed) count negatively. |
| ACC-4 | No bank integration; no manual balance editing in the MVP. |
| ACC-5 | An account can be selected on an expense form; expense account is optional. |

### 7.8 Users & Login

| ID | Requirement |
|---|---|
| USR-1 | Register: email (valid format) + password (any non-empty — no policy, confirmed) → creates a user and signs in immediately. |
| USR-2 | Login: Argon2id verification against the stored hash; wrong credentials → clear error; duplicate email → clear error on register. |
| USR-3 | Session: auto-login across launches (SecureStore holds the current user id); explicit logout returns to the login screen; a stale id (user gone) is handled as signed-out. |
| USR-4 | Seed: default user `ooiguancheng18@gmail.com` / `1234` created on first run (hash computed at seed time with the real hasher). |
| USR-5 | User isolation: accounts, expenses, budgets, commitments, and commitment payments belong to a user (`user_id` FK); the 12 categories stay global. |
| USR-6 | Gate: Dashboard and all tabs are unreachable while signed out; login/register are the only routes. |
| USR-7 | Entirely offline; no remote authentication. |
| USR-8 | Note: Argon2id runs via `hash-wasm` (pure WASM — no native module): **Expo Go works on Android and iOS**; dev builds are optional. Amended 2026-09-01 (cross-platform decision A16). |

### 7.9 Settings

| ID | Requirement |
|---|---|
| SET-1 | Edit the safety-buffer amount (default RM300). |
| SET-2 | AI provider configuration: per-provider keys (SecureStore, add/replace/remove), Test Connection, model selection, active provider (plan 013). |
| SET-3 | No other settings in MVP (currency, language, categories are fixed/out of scope). |

### 7.10 Navigation

- Tabs: Dashboard, Expenses, Budgets, Commitments, Analytics, Settings. Cash Flow is embedded in the Dashboard (expandable breakdown) and does not get its own tab in the MVP.

## 8. Financial Rules & Cash Flow

### 8.1 Money representation
All money is stored as integer minor units (**sen**). No floating-point monetary values anywhere in storage or calculations.

### 8.2 Deterministic calculations
All financial figures are produced by the financial engine — a pure TypeScript module, unit-testable without UI or database. Every calculation: monthly totals, category totals, budget metrics, commitment schedules and totals, safe-to-spend, daily allowance, projections.

### 8.3 Double-counting rule (by construction)
The expense set and the unpaid-commitment set are **disjoint**:

- A commitment payment marked **paid** becomes an Expense (D3) → counted in *spent this month* → reduces *available* and *remaining budget*. It is excluded from *upcoming commitments*.
- An **unpaid** payment is never an Expense → it is not in *spent* and does not reduce *remaining budget* → it appears only in *upcoming commitments*.

So a given ringgit is counted exactly once in the cash-flow formula. A consequence: **the engine never reconciles a standalone manually-typed expense against an unpaid commitment** (there is no matching link); users who pay commitments through the Commitments flow get the auto-created expense, which is the supported path.

### 8.4 Cash-flow formula (decision D2 — conservative)

```
Available            = Σ account balances (credit-card owed amounts count negative)
Upcoming commitments = Σ unpaid payment amounts with due date < start of next month
                       (overdue-unpaid included; paid excluded)
Remaining budget     = max(0, monthly budget − spent this month)
                       (0 if no overall budget is set)
Safe to spend        = Available − Upcoming commitments − Remaining budget − Safety buffer
Daily allowance      = Safe to spend ÷ remaining calendar days of the month (incl. today)
```

Properties of this formula (documented so implementers and users are not surprised):

1. **The spent term cancels out.** Available already nets out spending (D1), and remaining budget subtracts it back in. Safe-to-spend is therefore *constant across the month* given fixed commitments and buffer: `Safe = StartingAvailable − MonthlyBudget − Commitments − Buffer`. Spending does not change it; only calendar rollover, commitment changes, balance corrections, or buffer edits do.
2. **Daily allowance rises** slightly each day as the denominator shrinks.
3. **Safe can be negative** → UI must show an explicit deficit state ("no safe-to-spend; cover commitments + buffer before discretionary spending"), never a misleading positive number.

### 8.5 Worked example (spec numbers, September 2026)

| Component | Spec example | Our formula (D2) |
|---|---|---|
| Available | RM3,000 | RM3,000 |
| Upcoming commitments | RM800 | RM800 |
| Remaining budget (3,000 − 1,160 spent) | (not subtracted) | −RM1,840 |
| Safety buffer | RM300 | −RM300 |
| **Safe to spend** | **RM1,900** | **RM60** |
| Daily allowance (30 days) | RM63 | RM2 |

> ⚠️ **Divergence from the spec example is expected and intentional.** The user chose to reserve the remaining monthly budget (D2), which is significantly more conservative than the spec's illustrative formula. *Safe = RM60* reads as "after reserving your full month's budget, commitments, and buffer, RM60 is truly discretionary." Implementation must use D2 and this document as the reference; the spec example is illustrative only.

## 9. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Offline**: all non-AI features (expenses, budgets, commitments, analytics, cash flow, dashboard) work without any network. AI failures block nothing. |
| NFR-2 | **Testability**: financial engine is pure logic with no I/O; every calculation listed in §8.2 has unit tests (see §10 acceptance criteria). |
| NFR-3 | **Determinism**: identical data + date → identical results, every time, no randomness. |
| NFR-4 | **Data integrity**: money in integer sen; transaction history immutable in meaning (edit updates the existing row; no silent duplicates). |
| NFR-5 | **Performance**: local SQLite; dashboard and list operations feel instant on-device (no network waits). |
| NFR-6 | **Calendar correctness**: all month calculations use the device's local calendar/timezone. |
| NFR-7 | **Separation of concerns**: UI screens → application services → repository → SQLite; AIService isolated; UI contains no SQL and no financial calculations. Business logic independent of the database layer so a future cloud DB / web client can be added. |
| NFR-8 | **UX**: fast expense entry, clear numbers, low clutter, clear distinction between spent money and future obligations, useful warnings (over-budget, deficit) without notification spam. Mobile-first, no gamification, no financial jargon. |

## 10. Constraints

- Stack: React Native + TypeScript + Expo + Expo Router + Expo SQLite + Drizzle ORM + Zustand + React Hook Form + Zod; AI providers: **Gemini + DeepSeek with user-supplied API keys (BYOK)**; Argon2id (`hash-wasm` — pure WASM, no native module) for local login.
- **iOS + Android** in the MVP; web stays out of scope.
- Local login hashing is pure WASM (`hash-wasm` Argon2id): the app runs in **Expo Go** on both platforms; development builds are optional (native tooling only).
- No backend, cloud sync, or third-party BaaS.
- Do not add features beyond this PRD unless required by the specified functionality.

## 11. Acceptance Criteria (Definition of Done)

The MVP is complete when a user can, on Android **or iOS**, fully offline (except AI actions):

1. Open the app and land on a correct dashboard.
2. Create/select an account (with initial balance).
3. Record ordinary expenses manually in a few seconds.
4. Browse, search, filter, edit, and delete expense history; see totals for a selected period.
5. Set an overall monthly budget.
6. Set category budgets and see per-category spent/remaining/percentage/over-budget.
7. Create debts/bills/installments/other commitments (monthly or one-time) with a derived payment schedule.
8. Mark commitment payments as paid; each paid payment records a linked Debt / Repayment expense and updates remaining amounts.
9. See how much they have spent (this month, and any selected month).
10. See upcoming financial obligations (e.g., total due before next month).
11. See their calculated safe-to-spend amount, with an expandable formula breakdown.
12. See a daily spending allowance.
13. View spending analytics (breakdown, MoM change, averages, largest, projection).
14. Ask AI to analyze commitments/debt and get a sensible natural-language answer from pre-computed data.
15. Ask AI to analyze spending and get a sensible natural-language answer from pre-computed data.
16. Use every non-AI feature with the network disabled; AI actions show a clear error instead.
17. Register a new local account, log out, and log back in as the seeded default user (`ooiguancheng18@gmail.com` / `1234`); each user sees only their own financial data.

### Test priorities (financial engine)

- Monthly expense totals; category totals; budget remaining; budget percentage; over-budget state.
- Commitment totals; installment schedules (n payments, last-payment remainder); paid vs unpaid; upcoming-commitment calculation (window boundaries); one-time and ongoing-monthly shapes.
- Safe-to-spend (incl. negative/deficit); daily allowance; month-boundary behavior (last day, rollover); empty database; editing/deleting expenses and their balance/budget effects; date filtering.
- AI output: never asserted as financial truth — presentation only.

## 12. Open Items

- None blocking. Model choice for Gemini (e.g., flash vs flash-lite) deferred to the AI feature plan.
- (Deliberate, recorded) Conservative cash-flow formula diverges from the spec's illustrative example by design (D2).

## 13. Out of Scope (future, explicitly not in MVP)

Web app, cloud DB, sync, cloud/remote authentication (local login is in the MVP), automatic provider fallback, AI provider marketplace, OAuth login, cloud credential storage, other AI providers, general AI assistant, bank integrations, multi-currency, weekly/yearly commitments, category editing, manual balance editing, CSV import/export, recurring auto-expenses.