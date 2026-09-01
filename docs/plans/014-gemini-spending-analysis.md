# 014 — AI Spending Analysis

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 012, 013, 011 |
| **PRD** | §7.5 AN-5; §7.6 AI-1..11 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 014 |

## Objective

The **"Analyze my spending"** action in Analytics: the app's deterministic `SpendingSnapshot` (011) goes to Gemini, which explains trends, patterns, budget pressure, and the projection — using only supplied data (PRD AN-5). Same pipeline and hygiene as 013 — this plan is mostly wiring + snapshot reuse.

## Context

011 fixed the snapshot shape ("the exact payload 014 will send" — its AC 4). This plan: reuse `AnalyticsService.analyzePeriod` output as the snapshot, add the action button + AI card (shared `AIAnalysisCard` from 013), and rely on the model/error plumbing already built. No new calculations.

## Requirements (PRD AN-5)

- "Analyze my spending" button in the Analytics tab (current selected month).
- Payload = `SpendingSnapshot` (011) exactly: totals, MoM change, avg daily, top categories, utilization, projection, month label. **Aggregates only** (A6 — no transaction text; the snapshot already excludes descriptions).
- Render time: no month drift — analyze the month shown in the selector, not whatever the calendar says now.
- Result → shared analysis card (summary + points), typed errors + Retry, pending state, response Zod-validated (012).
- Prompt context `'spending'` from the 012 registry; instructions: identify largest categories, significant MoM changes, unusual shifts, budget pressure, current pace vs projection — referencing supplied numbers only.

## Technical Design

- `app/(tabs)/analytics.tsx`: adds the action button next to the MoM chip; on tap → `AIService.analyze('spending', snapshotFromSelectedMonth)` via the same `AIAnalysisCard` flow as 013.
- `SpendingSnapshot` assembly already exists (011) — no new service. The button passes the *selected* month's snapshot (derive from the same state the screen renders, so the analysis always matches what's on screen).
- Provider: routed through the **active provider** (Gemini or DeepSeek, plan 013) via `AIService.analyze` — no provider logic or key handling here.
- Empty-month handling: if total = 0 and breakdown empty → hide the button ("nothing to analyze this month").

## Files / Components Likely Affected

- `app/(tabs)/analytics.tsx` (button + card placement)
- `src/components/AIAnalysisCard.tsx` (already shared from 013 — no change expected)
- `src/ai/prompts.ts` (spending template, 012 registry)

## API Changes

None new (reuses 012 + 011 APIs).

## Database Changes

None.

## Dependencies

012 (provider/errors/schema), 011 (snapshot).

## Decisions

None open — inherits Decisions from 011 (snapshot), 013 (provider plumbing, G1 model), 012 (contracts, hygiene).

## Edge Cases

- Selected month has no data → button hidden (not an error).
- MoM null (zero baseline) → snapshot carries `changePct: null`; prompt says "no comparison available" (no invented trends).
- Offline/timeout/invalid key → typed error + Retry (13's flow); Analytics numbers unaffected.
- Month changes while request in flight → result card labelled with the month it analyzed (snapshot taken at tap time; card header shows that month).

## Security Considerations

- Identical to 013: aggregates only, validated output, key handling inherited.
- Largest-expenses data is category-level (no descriptions) per 012's snapshot design.

## Tests

- Button visibility logic (empty month).
- Reuse coverage: snapshot → prompt payload mapping fixture (spending template receives exactly the snapshot fields).
- Provider error paths (inherited from 013 tests; re-run against spending context).
- Result card renders summary + ≤5 points for a canned fake response.

## Acceptance Criteria

1. "Analyze my spending" returns a sensible explanation referencing only supplied figures (real API on-device).
2. It analyzes the month displayed, not the current calendar month (test + review).
3. Empty month hides the action; every failure shows a typed error + Retry; DoD 15 & 16.
4. `npm test`, typecheck, lint green.

## Out of Scope

New analytics math, drill-down, chat follow-ups, caching AI results.