# 015 — Cash-Flow Explanation

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 012, 010 |
| **PRD** | §7.1 DASH-4; §7.6 AI-2 (Cash Flow → Explain my allowance) |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 015 |

## Objective

The third contextual AI action — **"Explain my allowance"** on the Dashboard's formula card: Gemini narrates the already-computed cash-flow components (`AllowanceSnapshot`, 010/012) in plain language. This is the optional-but-included explanation feature (PRD §7.6; spec's "optional cash-flow explanation"), explicitly presentation-only: **the AI never calculates the result** — it explains the app's numbers.

## Context

010 produces `CashFlowSnapshot` via the engine (D2 formula); 012 already defines `AllowanceSnapshot` shape and the `'allowance'` prompt template; 013 built the provider plumbing (key, model G1, errors, `AIAnalysisCard`). This plan wires the third button with near-zero new machinery.

## Requirements

- "Explain my allowance" button on the Dashboard formula card (DASH-4) — visible whenever the card is (even in deficit state; the explanation then describes the deficit).
- Payload = `AllowanceSnapshot`: available, upcoming, remaining budget, buffer, safe-to-spend, daily allowance, days remaining — all engine-computed (010).
- Instructions (prompt `'allowance'`, 012 registry): explain each component in plain language and what the daily allowance implies; **never recompute or introduce numbers**; in a deficit, state it plainly without sugarcoating.
- Shared `AIAnalysisCard` flow: pending / typed error + Retry / validated result.
- Result card sits inside the expanded formula card (contextual, not a full screen).

## Technical Design

- `src/components/dashboard/FormulaCard.tsx` gains the action button; on tap, the Dashboard passes its current `CashFlowSnapshot` (010) mapped to the 012 `AllowanceSnapshot` shape (same fields) — no recomputation.
- Reuses `createAIService()` (013's provider), `AIAnalysisCard`.
- Deficit handling: snapshot carries negative `safeSen`; prompt fixed text covers "a deficit means …" — the AI explains the app's negative number, never "fixes" it.

## Files / Components Likely Affected

- `src/components/dashboard/FormulaCard.tsx` (button + card embedding)
- `src/ai/prompts.ts` — allowance template (012 registry)
- No new services/providers.

## API Changes

None new.

## Database Changes

None.

## Dependencies

012 (contracts/provider plumbing), 010 (snapshot + UI surface).

## Decisions

None open — inherits G1 (model), key flow, error handling from 013; snapshot shape from 012.

## Edge Cases

- Deficit state → explanation describes negative safe + the "cover commitments + buffer" reality; no positive spin.
- No budget set → snapshot's `remainingBudgetSen` is 0 with the UI's "—" mapped to a `hasBudget: false` flag so the AI doesn't invent a budget; prompt covers "no budget set".
- Offline/typed errors → same non-blocking card state (AI-4).
- Rapid taps → pending guard (013 behaviour reused).

## Security Considerations

- Aggregates only; no descriptions anywhere in `AllowanceSnapshot`; validated output; key handled by 013's provider.

## Tests

- Snapshot mapping: `CashFlowSnapshot → AllowanceSnapshot` field equality (fixture).
- Fake-provider rendering: success, deficit copy, no-budget copy, error+retry.
- Prompt fixture: allowance template receives exactly the mapped fields (no drift from 012 schema).

## Acceptance Criteria

1. "Explain my allowance" produces a plain-language explanation of the components, citing supplied numbers (real API on-device).
2. Deficit and no-budget states produce honest, non-invented copy.
3. Error/retry/offline behaviour identical to 013/014; DoD 16.
4. `npm test`, typecheck, lint green.

## Out of Scope

Turn-by-turn assistant, "what-if" questions, forecasts, alternative formulas.