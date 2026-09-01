# 012 — AI Service Abstraction

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 001 |
| **PRD** | §7.6 AI-1..6 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 012 |

## Objective

The `AIService` abstraction layer — **without any provider yet**: the interface, typed contexts and snapshot payloads, error taxonomy, Zod response validation, and a test double. After this plan, no code anywhere imports Gemini; adding the real provider in 013–015 is one class + a factory entry.

## Context

Per PRD AI-1 and ARCH §9: AI is accessed only through an application-level service; UI never talks to providers; the financial engine never knows AI exists. AI receives **already-calculated structured data** and returns human-readable analysis — presentation only, never authoritative financial data (AI-3). This plan fixes the contracts; 013–015 implement the provider and the three contextual actions.

## Requirements (PRD AI-1..6)

- `AIService` facade with provider-configuration capabilities (`testConnection(provider, key)`, `listModels(provider, key)`, active-provider get/set) **plus** `analyze(context, snapshot) → AIResult`, which dispatches to the **active** provider with its selected model (BYOK, plan 013).
- **Contexts** (fixed union): `'debt' | 'spending' | 'allowance'` — each with its own typed, JSON-serializable snapshot built by the application services (008/011/010) — never raw expense rows with free-text descriptions (A6).
- **Error taxonomy** (typed, all surfaced as UI-able messages): `offline`, `timeout`, `http` (status), `invalidKey`, `invalidResponse`, `unknown` — implemented as `AIUnavailableError` with a `reason` field (PRD AI-4: non-blocking, clear error).
- **Zod response schema**: `AIResult { summary: string, points: string[] }` — provider output validated before any UI renders it; malformed output → `invalidResponse` error, never a crash.
- **Hygiene invariants** (enforced at this layer): snapshot is a pure data transfer object (no functions/classes); provider receives only the snapshot + a fixed prompt template keyed by context; AI output is never merged into financial state.
- **Test double**: `FakeProvider` implementing the `AIProvider` capability interface (deterministic canned results incl. failure modes) so provider config (013) and the analysis UIs (013–015) are testable in Jest without network.
- **Factory**: `createAIService(providerName?)` — returns the configured provider; the future multi-provider switch lives here (AI-5; no provider-selection UI in MVP).

## Technical Design

```
src/ai/
├── types.ts            # AIContext union; snapshot record types per context; AIResult; AIErrorReason
├── schema.ts           # Zod: AIResultSchema; per-context snapshot schemas (mirrors what services produce)
├── errors.ts           # AIUnavailableError (reason, status?), mapping helpers (network/timeout/http/parse)
│   ├── AIService.ts        # facade: provider config (test/listModels/active) + analyze + prompt registry
│   ├── providers/
│   │   ├── fake.ts         # FakeProvider (implements the AIProvider capability interface — tests + dev)
│   │   ├── gemini.ts       # real provider (plan 013)
│   │   └── deepseek.ts     # real provider (plan 013)
└── __tests__/          # schema validation, error mapping, factory, fake behavior
```

Prompt registry: fixed system instructions per context ("You analyze pre-computed financial data; never recalculate; answer in plain language; reference only the supplied numbers; output JSON {summary, points}") + the JSON snapshot. No user free text reaches the prompt in the MVP contexts.

Snapshot types (defined here as the source of truth, produced by services):

```ts
type DebtSnapshot     = { commitments: {name,type,remainingSen,nextDue?,paidCount,totalCount?}[], upcomingBeforeNextMonthSen, overdueSen, totalRemainingSen }
type SpendingSnapshot = { month, totalSen, previousTotalSen, changeSen, changePct|null, avgDailySen, topCategories:{name,amountSen}[], largest:{description,amountSen}[]? } // NO raw descriptions sent — A6 decision means largest w/o description text
type AllowanceSnapshot= { availableSen, upcomingSen, remainingBudgetSen, bufferSen, safeSen, dailyAllowanceSen, daysRemaining }
```

Dev note: the Gemini key is read by the provider (013) from SecureStore, entered in Settings (013).

## Files / Components Likely Affected

- `src/ai/*` (all new)
- No app screens in this plan; `src/types/` gains the snapshot types

## API Changes

Internal: `AIService.analyze(context, snapshot)`, `createAIService()`, `AIResult`, `AIUnavailableError`.

## Database Changes

None.

## Dependencies

001 (project structure only). Designed so 013–015 need zero changes to the engine/services that produce snapshots.

## Decisions (confirmed defaults — no open questions)

- Capabilities: provider configuration (test connection, model listing, active-provider selection — plan 013) plus `analyze`; **no streaming, no raw chat** — the general assistant is explicitly future (PRD §7.6).
- `AIResult` = summary + points (structured enough to render nicely, simple enough to validate).
- No raw descriptions in snapshots (A6) — "largest expenses" in the spending snapshot is category-level, not transaction-level text.
- Responses are capped (max_points: 5; max summary length) to keep UI tight.

## Edge Cases

- Provider throws mid-request → mapped to typed reason → caller UI shows inline error + Retry (013–015).
- Response JSON valid but wrong shape → Zod reject → `invalidResponse` (never rendered).
- Snapshot with negative safe (deficit) → still analyzable (allowance explanation 015 must handle deficit copy).
- Factory called with unknown provider name → typed error (future-proofing).

## Security Considerations

- Key never touches this layer (providers own it, 013).
- Snapshot/response boundaries are Zod-validated; AI output treated as untrusted presentation data.
- Nothing leaves the device except the explicit snapshot per user action (A6).

## Tests

- Zod: valid/invalid/partial AIResult fixtures; snapshot schemas reject wrong shapes.
- Error mapping: network error → offline; timeout; 401/403 → invalidKey; 429/5xx → http; garbage JSON → invalidResponse.
- Fake: canned success + each failure mode; factory returns Fake in tests (dependency injection point for 013–015 tests).
- Prompt registry: each context has a template; no template interpolates free text.

## Acceptance Criteria

1. `createAIService('fake')` runs end-to-end in Jest; every failure mode maps to the right AIError reason.
2. No UI/service imports any provider directly (lint-guard or review).
3. Snapshot types match what 008/011/010 services produce (compiled type checks).
4. `npm test`, typecheck, lint green.

## Out of Scope

Real Gemini (013–015), provider selection UI, streaming, fallback providers, general chat assistant, prompt histories.