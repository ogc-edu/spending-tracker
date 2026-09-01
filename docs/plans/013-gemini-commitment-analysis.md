# 013 — Gemini — Commitment Analysis

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 012, 008 |
| **PRD** | §7.4 COM-7; §7.6 AI-1..6 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 013 |

## Objective

The first **real** provider: `GeminiProvider` behind the 012 abstraction, wired as the **"Analyze my debt"** action in Commitments. The app computes a deterministic `DebtSnapshot` (008 + engine), Gemini explains it in plain language, and the result renders as validated presentation — never as financial state.

## Context

This proves the AIService contract end-to-end: snapshot assembly (service side) → prompt (012 registry) → Gemini API → Zod validation → UI panel, with every failure mapped to a typed, retryable error (AI-4). The Gemini API key becomes a real dependency: stored in SecureStore, entered once in Settings (PRD AI-6: dev tradeoff, documented insecure for distribution).

## Requirements

- **Settings → AI section**: Gemini API key input → saved to SecureStore; read-only status line ("Provider: Gemini · key configured/not configured"); "coming from 013".
- **Commitments tab**: "Analyze my debt" button (contextual action, PRD §7.6) → builds the snapshot → calls `AIService.analyze('debt', snapshot)`.
- `DebtSnapshot` (per 012): per-commitment {name, type, remaining, nextDue?, paid/total}, upcoming-before-next-month total, overdue total, grand total remaining — all engine-computed (008 `upcomingCommitments` + `commitmentSchedule`). **Zero calculation by AI** (core principle).
- Rendering: analysis card under the button — summary paragraph + up to 5 bullet points; loading spinner; inline error with Retry (typed reason → message); collapse/expand.
- Response is Zod-validated (`AIResult`); anything malformed → `invalidResponse` error, nothing rendered.
- Model per decision **G1** (see Decisions).

## Technical Design

### GeminiProvider (012's first real implementation)

```
class GeminiProvider implements AIService {
  constructor(private key: SecureStore | string, private model: GeminiModel)
  async analyze(context, snapshot):
    instructions = promptRegistry[context]                 // fixed template (012)
    payload      = { instructions, snapshot }              // structured, no free text
    raw          = await genAI(model).generateContent(JSON payload)   // @google/generative-ai SDK
    text         = raw.response.text()
    aiResult     = AIResultSchema.parse(text)              // Zod; throw invalidResponse on failure
    return aiResult
}
```

- SDK: official `@google/generative-ai` (ARCH §15 decision; dependency added here). Constructed with the API key via `new GoogleGenerativeAI(apiKey)` — **API-key auth** (`x-goog-api-key` header), never OAuth (see Decisions G1).
- Dev-key fallback: read `EXPO_PUBLIC_GEMINI_API_KEY` from a **gitignored** `.env` only for emulator convenience; the runtime path is SecureStore via Settings. The key is never committed to the repo.
- JSON mode: request `responseMimeType: 'application/json'` so the SDK returns parseable JSON; Zod still validates shape.
- Timeouts and abort: request wrapped with a 20 s timeout → `AIUnavailableError('timeout')`.
- Network/HTTP error mapping per 012 errors.ts (fetch failures → offline/http; 401/403 → invalidKey).

### Snapshot assembly: `CommitmentAnalysisService.buildDebtSnapshot(userId, now)`

Reads commitments + paid payments (008 repos), calls engine `commitmentSchedule`/`upcomingCommitments` for: upcoming-before-next-month (incl. overdue), overdue subset, per-commitment remaining (`total − paid sum`), paid/total counts, next due. Returns the 012-typed DebtSnapshot. Pure assembly — no math beyond the engine.

### UI

- Settings: `app/(tabs)/settings.tsx` gains an **AI** section (key input with show/hide, save → SecureStore, clear; status line). Uses no provider logic directly — just stores the key for 013's provider.
- Commitments: analysis card component (`AIAnalysisCard` — shared with 014/015: spinner, error+retry, expandable result) + "Analyze my debt" button in the Commitments tab header.

## Files / Components Likely Affected

- `src/ai/providers/gemini.ts` (new; registers into `createAIService`)
- `src/ai/providers/fake.ts` — same shape (already 012)
- `src/services/CommitmentAnalysisService.ts` (new — snapshot assembly)
- `src/components/AIAnalysisCard.tsx` (new, shared)
- `app/(tabs)/commitments.tsx` (action button), `app/(tabs)/settings.tsx` (AI key section)
- `package.json`: `@google/generative-ai`

## API Changes

Internal: `CommitmentAnalysisService.buildDebtSnapshot`, `AIService.analyze('debt', …)` now real.

## Database Changes

None (key lives in SecureStore, not the DB).

## Dependencies

012 (abstraction, schemas, errors, fake), 008 (commitments/engine).

## Decisions

- **G1 — Gemini model: `gemini-3.6-flash` (confirmed 2026-09-01, live-verified).** Pinned to a concrete version for determinism; `gemini-flash-latest` is the documented alias fallback if 3.6 is ever deprecated. (`gemini-2.0-flash` is retired on the v1beta endpoint — verified by API probe.)
- **Auth mechanism (confirmed 2026-09-01, live-verified):** the provider uses **API-key authentication only** — the `x-goog-api-key` header (the `GEMINI_API_KEY` / Google AI Studio mechanism) via the official SDK's `GoogleGenerativeAI(apiKey)`; **never OAuth bearer-token auth**. The user's **AQ-format** Google AI Studio key was live-tested against the v1beta REST endpoint with this header and returned 200-level content (2026-09-01); the SDK default endpoint matches the probed one. If a future SDK version ever drifts, the fallback is a raw REST call to `generativelanguage.googleapis.com/v1beta/models/<model>:generateContent` with the same header — guaranteed mechanism.
- (Confirmed defaults, no question): key via SecureStore + Settings entry; 20 s timeout; JSON response mode; one manual Retry per error state; no history/caching of AI results (re-run is the retry).

## Edge Cases

- No key configured → button shows "Set your Gemini key in Settings" state (not a generic error).
- Offline → typed `offline` error; expense/commitment features unaffected (AI-4).
- Snapshot empty (no commitments) → button hidden or disabled with "No commitments to analyze".
- Deficit/negative numbers in snapshot → AI instructed to reference them as supplied (012 prompt) — no recalculation.
- Malformed/empty Gemini response → `invalidResponse`, retry offered.
- Rapid double-tap → button disabled while pending.

## Security Considerations

- Key only ever in SecureStore; never logged; Settings UI masks input.
- Payload = aggregates only (A6): commitment names/types/amounts are structured numbers — no free-text descriptions exist on commitments; still no raw expense text is included.
- AI output untrusted → validated, rendered as presentation only (PRD AI-3).
- Documented: key + snapshot leave the device to Google — the agreed MVP tradeoff (PRD AI-6).

## Tests

- Snapshot assembly vs harness fixtures (upcoming/overdue/remaining/paid-count correct).
- GeminiProvider with a mocked SDK client: success → validated AIResult; JSON-mode flag set; timeout → timeout error; 401 → invalidKey; garbage → invalidResponse.
- UI logic (Fake provider): pending/error/retry/success states; key-missing state; button disabled without commitments.
- SecureStore save/load/clear round-trip (with expo-secure-store mock in Jest).

## Acceptance Criteria

1. With a configured key, "Analyze my debt" returns a sensible plain-language summary + points referencing only supplied figures (verified with real API on-device).
2. No key / offline / timeout / invalid-key each produce the correct typed error + Retry; nothing else breaks (DoD 14, 16).
3. Analysis never alters financial state or re-creates figures (code review + tests).
4. Settings shows key status; key persists via SecureStore.
5. `npm test`, typecheck, lint green (Gemini calls mocked).

## Out of Scope

Provider selection, fallback providers, streaming, general chatbot, AI history, key management beyond SecureStore.