# Spending Tracker — Master Implementation Plan

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01, rev. 2: user-auth feature) |
| **Version** | 2.0 |
| **Date** | 2026-09-01 |
| **PRD** | [PRD.md](./PRD.md) (Approved 2026-09-01) |
| **Architecture** | [ARCHITECTURE.md](./ARCHITECTURE.md) (Approved 2026-09-01) |

The system is decomposed into **16 independently implementable features**, following the spec's implementation priority plus the user-requested **Users & Local Auth** feature (rev. 2). Each feature becomes a detailed plan in `docs/plans/NNN-*.md` (Draft → Approved per feature, after grilling).

> **Rev. 2 change (2026-09-01):** user requested login/register on the local database with a seeded default user (ooiguancheng18@gmail.com / 1234) and user-scoped data, as the foundation for a future web + cloud migration. Added feature **003 Users & Local Auth**; all subsequent features renumbered (+1). PRD §7.8 and ARCHITECTURE §4/§16 updated to match.

---

## 1. Feature Decomposition

**Platform: Android + iOS** (decision 2026-09-01 — web stays out; see PRD §10 / ARCH A16).

| ID | Name | Goal | Dependencies | Key outputs | Acceptance criteria (summary) |
|---|---|---|---|---|---|
| 001 | Project Setup & Navigation | Scaffold Expo + TypeScript; six-tab navigation; theme; Jest/ESLint/typecheck | — | Expo app, router tabs, theme tokens, tooling | Builds; 6 tabs navigate; `npm test/lint/typecheck` green |
| 002 | Database Schema & Migrations | Drizzle + expo-sqlite; **7 tables incl. `users` + `user_id` FKs**; migrations + seed (categories) | 001 | `src/db/*`, drizzle migrations, seeded schema | Fresh install → schema; migrations idempotent; failure → retry screen |
| 003 | Users & Local Auth | Register/login/logout; **PBKDF2-SHA256** hashing (@noble/hashes, Hermes-safe — A7 rev 2026-09-03); auto-login session; seeded default user; auth gate; user-scoped data | 002 | AuthService, hasher, login/register screens, user seed | Default user logs in; register/logout flows; data isolated per user; gate enforced |
| 004 | Categories & Accounts | Accounts CRUD (incl. credit-card owed semantics); categories queryable; `sumBalances` primitive | 002, 003 | AccountService/Repository, accounts UI | Create/list accounts; credit shows Owed; delete blocked when referenced |
| 005 | Expense CRUD | Add/edit/delete expenses; Zod forms; fast-entry; account-balance auto-adjust; engine monthly/category totals; E7 linked-expense locks | 002, 003, 004 | ExpenseService, forms, engine totals | Record in ≤3 taps; edits keep same row; balances/totals exact |
| 006 | Expense History & Filters | Chronological list, detail, search, category filter, date-range, period totals | 005 | Query/sum repositories, history UI | Filters compose; totals match engine; empty states |
| 007 | Monthly & Category Budgets | Overall + per-category budgets, upsert per (category, month, year); metrics; over-budget flags | 002, 005 | BudgetService, engine `budgetMetrics`, UI | Metrics per PRD BUD-2..4 |
| 008 | Commitments & Payments | Commitments CRUD (monthly/one-time); derived schedules; mark-paid txn (linked expense, idempotent); statuses | 002, 005 | CommitmentService, engine schedule/upcoming, UI | PRD COM-1..6; rem/paid math; idempotent |
| 009 | Financial Calculation Engine | Pure engine: safe-to-spend, allowance, analytics math, projection, deficit; full Jest suite | 002 (types only) | engine `safeToSpend`/`dailyAllowance`/`analytics`/`projectMonthEnd` | PRD §11 test list green; PRD §8.4 formula exact |
| 010 | Dashboard | Available, spent, budget, remaining, upcoming, safe, daily allowance, category summary; formula breakdown; deficit state | 009, 005, 007, 008 | CashFlowService.snapshot, Dashboard UI | PRD DASH-1..5; deterministic; refreshes |
| 011 | Analytics | Month selector; category breakdown, MoM change, avg daily, largest, top categories, budget utilization, projection | 009, 005, 007 | AnalyticsService, Analytics UI | PRD AN-1..4 vs hand-computed fixtures |
| 012 | AI Service Abstraction | `AIService` facade, typed contexts, error taxonomy, Zod response validation, provider-config + analyze, test double | 001 | `src/ai/*` abstraction only | UI never imports a provider; provider = one class |
| 013 | AI Providers (BYOK) | Provider configuration: Gemini + DeepSeek keys (per-user SecureStore), Test Connection, model discovery + selection, active provider | 012 | Gemini/DeepSeek providers, config UI | No keys in DB/logs/git; discovery-only models; explicit active provider, no fallback |
| 014 | AI Spending Analysis | "Analyze my spending" action via the active provider | 012, 013, 011 | Spending-analysis UI | Same hygiene rules as 013 |
| 015 | Cash-Flow Explanation | "Explain my allowance" on Dashboard via the active provider | 012, 013, 010 | Allowance-explanation UI | Explains snapshot; no new numbers |
| 016 | Polish & Hardening | Empty states, validation edge cases, toasts, deficit polish, offline verification, **iOS parity pass** (A16), QA | 010, 011, 013, 014, 015 | Polished app (Android + iOS) | PRD DoD §11 items 1–17 verifiable offline (except AI) |

## 2. Dependency Graph

```
001 ─► 002 ─► 003 ─► 004 ─► 005 ─► 006
                        │
                        ├──► 007 ──────────────┐
                        └──► 008 ──────────────┤
                                               │
002 ──► 009 ◄── (parallelizable with 004–006)  ├──► 010
                                               ├──► 011
001 ─► 012 ──► 013 ─┬─► 014 ◄── 011           │
                    └─► 015 ◄── 010           ▼
                                       016 (all)
```

Sequencing notes:

- **001 → 002 → 003 → 004 → 005 → 006** is the strict spine. 003 (auth) is required by everything downstream because all data is user-scoped.
- **007** and **008** depend on 005 (spent data / linked-expense transaction) — buildable in parallel.
- **009** depends only on 002's types: develop and test in parallel with 003–006; consumed by 010/011.
- **012** is independent of the financial spine (deps 001 only) and can land early. **013** (BYOK provider config) depends only on 012 and makes the analysis features usable; **014** waits for 011's snapshot; **015** waits for 010's snapshot.
- **016** is the final cross-cutting pass.

## 3. Definition-of-Done Coverage

| PRD DoD item (1–17) | Delivered by |
|---|---|
| 1 open dashboard · 2 create/select account | 010, 004 |
| 3 record expenses · 4 browse/search/edit history | 005, 006 |
| 5 overall budget · 6 category budgets | 007 |
| 7 commitments · 8 mark payments paid (linked expense) | 008 |
| 9 spent this month · 10 upcoming obligations | 009, 010 |
| 11 safe-to-spend + breakdown · 12 daily allowance | 009, 010 |
| 13 analytics | 011 |
| 14 AI analyze commitments · 15 AI analyze spending | 013, 014 |
| 16 offline everywhere except AI | 010 (verification), 016 |
| **17 login/register + isolated users (rev. 2)** | 003 |

## 4. Plan Statuses

Each feature plan in `docs/plans/` starts as **Draft — decisions pending**, is grilled via the clarify tool (up to 5 decisions per round), and flips to **Approved — decisions confirmed** before implementation begins. Plans are written to be implementable by a coding agent without this conversation.

## 5. What's Next

1. Approve this master plan (gate #3, rev. 2). ✅ (approved)
2. Feature plans **001–016** are drafted in `docs/plans/` — 001–016 approved 2026-09-01 after grilling (E7, F1, C1, A3, G1 + BYOK/A14 decisions recorded in their plans; 013 rewritten as provider-agnostic BYOK: Gemini + DeepSeek).
3. Implementation order follows the spine: 001 → 002 → 003 → 004 → 005 → 006, with 007/008, 009, 012 parallelizable per §2.