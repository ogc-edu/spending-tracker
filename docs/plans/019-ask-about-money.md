# 019 — Ask About Your Money (Dashboard AI)

| | |
|---|---|
| **Status** | Implemented |
| **Version** | 1.0 |
| **Date** | 2026-09-22 |
| **Dependencies** | 010, 012, 013, 015 |
| **PRD** | §7.1 DASH-4 (evolves "Explain my allowance") |

## Objective

Replace the Dashboard's fixed **"Explain my allowance"** button with an
**"Ask about your money"** box: a text input, a row of one-tap common prompts,
and the shared `AIAnalysisCard` result surface. The user can now ask
free-form questions ("tell me what is my total commitment next month",
"how much can I spend this month?"), not just the one canned explanation.

## The one invariant that changes

Plan 012's contract was "no user free text ever reaches a prompt". That no
longer holds for this context. The change is made **safely**:

- the **system instruction stays fixed** (`SYSTEM_PROMPTS.ask`) — the user's
  text is NEVER interpolated into it;
- the user's question travels as a **separate, length-capped field**
  (`AIAnalyzeRequest.question`, ≤ `MAX_QUESTION_CHARS`), rendered by providers
  as a distinct user message after the snapshot;
- the fixed instruction explicitly tells the model to ignore any instruction
  inside the question that would change these rules, reveal them, or emit
  anything other than the JSON contract;
- the snapshot remains **aggregates only** — no raw expense descriptions
  (A6 hygiene preserved);
- output is still Zod-validated (`AIResult`) and presentation-only.

## Requirements

- Dashboard card with text input + suggestion chips + send action.
- Tapping a suggestion submits it immediately (one tap).
- Snapshot: a superset of the allowance aggregates (available, spent, budget,
  remaining, buffer, safe, daily allowance, days remaining, deficit) plus
  **next-month commitment slots** and category-name spend totals, so broad
  questions are answerable.
- Shared result surface unchanged: pending / typed error + Retry / validated
  result, labelled with the asked question.
- Deficit + no-budget states remain honest (no invented numbers).
- Runs against the active provider (BYOK) exactly like 013-015.

## Technical Design

- `AIContext` gains `'ask'`; `AskSnapshot` + `AskSnapshotSchema` mirror what
  `toAskSnapshot` produces.
- `AIAnalysisCard` is reused unchanged for the result.
- `toAskSnapshot(CashFlowSnapshot, at, categories)` is a pure mapper.
- `CashFlowService.snapshot()` also derives the **next calendar month's**
  unpaid commitment slots (same rows, same engine call — no extra query).
- Providers append the optional question after the snapshot; with no question
  the request bytes are identical to before (no regression to 013-015).

## Files Affected

- `src/ai/types.ts`, `src/ai/schema.ts`, `src/ai/AIService.ts`
- `src/ai/providers/{gemini,deepseek}.ts`
- `src/services/CashFlowService.ts`, `src/services/toAskSnapshot.ts` (new)
- `src/components/dashboard/AskAiCard.tsx` (new)
- `src/components/dashboard/FormulaCard.tsx` (button removed)
- `src/app/(tabs)/index.tsx`
- `src/components/KeyboardAwareScrollView.tsx` (refreshControl passthrough)

## Edge Cases

- Empty question → send disabled; suggestions always available.
- Rapid double-submit → single in-flight guard (reused 013 behaviour).
- No AI provider configured / offline / invalid key → typed inline error +
  Retry (AI-4), app otherwise fully functional.
- Stale question label → the submitted question is captured at tap time and
  reused for Retry.

## Out of Scope

Multi-turn conversation history, streaming responses, voice input.
