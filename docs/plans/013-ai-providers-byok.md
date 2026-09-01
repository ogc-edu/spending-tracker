# 013 — AI Providers & Configuration (BYOK: Gemini + DeepSeek)

| | |
|---|---|
| **Status** | Approved — decisions confirmed (rewritten for BYOK, 2026-09-01) |
| **Version** | 2.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 012 |
| **PRD** | §7.6 AI-1..11; §7.9 SET-2 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 013 |

## Objective

**Bring Your Own Key** AI configuration: the user configures **Gemini** and/or **DeepSeek** with their own API keys (masked input), tests the connection, discovers + selects a model, and picks the **active provider**. Provider-specific API handling is fully encapsulated behind the 012 abstraction. The financial app works completely without any AI provider configured.

> Supersedes the Gemini-only plan 013 v1 (2026-09-01): multi-provider BYOK was pulled into the MVP (user decision). Approved decisions superseded: A13's pinned `gemini-3.6-flash` → **no pinned models — discovery only** (the DeepSeek catalog already replaced `deepseek-chat` with `deepseek-v4-*`: any hardcoded list would be stale); "bundled dev key" → eliminated (users bring keys).

## Requirements (user spec ¶1–13)

- **Provider settings section** (Settings): two cards — Gemini, DeepSeek — each showing **Not configured** / configured (masked suffix, e.g. `••••••••••••ABCD`).
- **Key input**: masked; add / replace / remove; never display the full key after save; never log, print, or include keys in errors/analytics/crash reports; never commit keys; keys never in SQLite, AsyncStorage, or persistent app state — **SecureStore only**.
- **Test Connection** (per provider): minimal real request → success: "✓ Gemini/DeepSeek connection successful"; failures distinguished: invalid/unauthorized credential, quota/rate limit, model unavailable, network. No raw credential in results.
- **Model discovery** (per provider): fetch models from the provider's official listing API; filter to text-generation suitable for financial analysis (**not** image/speech/embedding); show a model selector. If discovery fails but the credential is valid → **manual model-ID entry**.
- **Active provider**: user-selectable among *configured* providers only; if none configured → "No AI provider configured"; every AI action (013/014/015) routes through the active provider; **no automatic fallback** between providers (explicit user choice only).
- **Model stored separately from credential** (settings row, not SecureStore).
- **BYOK privacy**: keys go only to the provider's own auth mechanism; never to an app-owned server; never exposed to the model itself.
- Rest of the app unaffected when nothing is configured (offline rule preserved).

## Technical Design

### Provider capability interface (extends 012)

```ts
interface AIProvider {
  id: 'gemini' | 'deepseek';
  testConnection(key: string): Promise<TestResult>;        // uses first discovered suitable model
  listModels(key: string): Promise<ModelInfo[]>;           // ModelInfo { id, label? }
  generate(snapshot, modelId: string): Promise<AIResult>;  // prompt registry (012) + provider serialization
}
type TestResult = { ok: true } | { ok: false; reason: 'invalidKey' | 'quota' | 'modelUnavailable' | 'network' | 'unknown' };
```

`AIService` (012) gains `testConnection/listModels/setActiveProvider/getActiveProvider/analyze` — `analyze` dispatches to the **active** provider with its selected model. UI never touches providers directly (spec ¶10).

### GeminiProvider (verified mechanism, 2026-09-01)

- Auth: **API-key only** — `x-goog-api-key` header; **never OAuth**. AQ-format Google AI Studio keys verified live against v1beta.
- Base: `https://generativelanguage.googleapis.com/v1beta`.
- Discovery: `GET /models` (same header) → filter `supportedGenerationMethods.includes('generateContent')` and name not matching `embedding|image|audio|video|imagen|tts|speech` → sorted list.
- Test: `generateContent` with `maxOutputTokens: 1` on the first suitable model → HTTP/JSON mapped to TestResult (401/403 → invalidKey; 429 → quota; 404 model → modelUnavailable; network → network).
- Generate: `generateContent` with `responseMimeType: 'application/json'`; Zod-validate via 012 schema.

### DeepSeekProvider (API shape verified from official docs, 2026-09-01)

- Auth: `Authorization: Bearer <key>` — DeepSeek-native (their own key format; **not** OAuth).
- Base: `https://api.deepseek.com` (hardcoded — no custom base URL, decision).
- Discovery: `GET /models` (Bearer) → returns OpenAI-style list (2026 catalog: `deepseek-v4-flash`, `deepseek-v4-pro`, `deepseek-v4-flash-vision-exp` — filter out `*-vision-*` and reasoning-only? keep flash/pro; label from id). List is used verbatim + manual entry fallback.
- Test: `POST /chat/completions` with `max_tokens: 1`, first model.
- Generate: `POST /chat/completions` — system prompt from 012 registry + JSON snapshot; request `response_format: { type: 'json_object' }` if supported by the model (verify at implementation against the user's key), else prompt-embedded JSON + **tolerant parse** (extract first `{...}` block) → Zod-validate.
- Raw REST (no SDK) — the format is simple and the SDK surface adds nothing.

### Configuration & credential stores

```
SecureStore (per local user — A10):  key:gemini:{userId}   key:deepseek:{userId}
settings table (010, per user):     ai_active_provider, ai_model_gemini, ai_model_deepseek
```

Keys never touch SQLite/Zustand/AsyncStorage; models/active-provider are non-secret preferences → settings table (persisted, user-scoped). Removing the active provider's key also clears `ai_active_provider` (→ "No AI provider configured", never a silent switch).

### Settings UI

- `app/(tabs)/settings.tsx` — AI Provider section: two provider rows (`Not configured` / masked suffix), "Active AI Provider" selector (configured only).
- `src/components/ai/ProviderConfigScreen.tsx` — per provider: masked key field (paste/add/replace), Test Connection button + inline result (✓/✕/⚠ with reason), model row: discovered picker or manual-ID input (shown when discovery fails), Remove key.
- Keys are held in component state only while editing; written straight to SecureStore on save.

## Files / Components Likely Affected

- `src/ai/providers/gemini.ts` (rewrite from v1), `src/ai/providers/deepseek.ts` (new), `src/ai/AIService.ts` (capabilities per 012 amendment)
- `src/services/AiConfigService.ts` (new: SecureStore ops scoped by user + settings-table prefs)
- `src/components/ai/*` (ProviderConfigScreen, ProviderRow, TestResultBadge, ModelPicker)
- `app/(tabs)/settings.tsx` (AI section)
- 014/015 consume via `AIService.analyze` (active provider) — no direct provider imports

## API Changes

Internal: `AIProvider` capabilities; `AIService.{testConnection, listModels, setActiveProvider, getActiveProvider, analyze}`; `AiConfigService.{getKey, setKey, removeKey, getModel, setModel, getActiveProvider, setActiveProvider}`.

## Database Changes

Settings table gains up to three pref **rows** per user (`ai_active_provider`, `ai_model_gemini`, `ai_model_deepseek`) — values only, no secrets. No schema change (settings table exists from 010).

## Dependencies

012 (abstraction, schemas, errors, prompt registry, fake). 008 (debt snapshot), 011 (spending snapshot), 010 (allowance snapshot) supply payloads — 013 itself assembles none.

## Decisions (confirmed 2026-09-01)

- **BYOK for Gemini + DeepSeek; no other providers** (spec ¶13).
- **Per-user keys** in SecureStore (`key:{provider}:{userId}`) — multi-user isolation (user decision).
- **Discovery-only models** — no hardcoded model lists/defaults anywhere (user decision). Test Connection uses the first discovered suitable model; discovery failure + valid key → manual model-ID entry. Rationale: provider catalogs churn (Gemini 2.0-flash retired; DeepSeek renamed chat→v4-*).
- Hardcoded provider endpoints (no custom base URL) (user decision).
- No automatic fallback; active provider explicit; removal of the active key clears the active selection.
- Gemini test/discovery verified live 2026-09-01 with the user's AQ key. **DeepSeek verification pending a user-supplied DeepSeek key at implementation time** (implemented against the documented API shape).

## Edge Cases

- Discovery fails but test succeeds → manual model-ID field appears (spec ¶6).
- Model unavailable at generate time → typed `modelUnavailable` error → UI directs to Settings re-pick (spec ¶11).
- Key removed while active → active cleared → analysis actions show "No AI provider configured" (013's button states).
- Both configured, one active → other remains configured (switchable one tap).
- Two local users → completely separate keys/models/active choice.
- Offline → test/generate give `network` reason; everything else works.
- `response_format` unsupported (some DeepSeek models) → prompt-JSON + tolerant parse, still Zod-validated.

## Security Considerations

- Keys: SecureStore only, per user; masked; never logged/committed/in errors/in telemetry (no telemetry exists); sent only to the provider's auth mechanism (spec ¶12).
- Provider abstraction keeps both credential formats isolated from the engine and UI.
- AI output remains untrusted presentation data (012).

## Tests

- Both providers against a mocked fetch/HTTP layer: auth header correctness (Gemini `x-goog-api-key`; DeepSeek `Bearer`), request-body fixtures (generateContent vs chat/completions), discovery filtering (Gemini excludes embeddings/images; DeepSeek excludes `*-vision-*`), TestResult mapping (401/403/429/404/network).
- AiConfigService: per-user SecureStore round-trips (mock), settings-pref persistence, active-provider clearing on key removal.
- UI states with the 012 fake provider: not-configured → configured, masked display, test states, manual-ID fallback, active selector lists only configured, "No AI provider configured".
- 014/015 route through the active provider (integration with fake).

## Acceptance Criteria

1. On-device: configure Gemini with a real key → test ✓ → models listed → select → set active → "Analyze my debt/spending" uses it (DoD 14/15 via active provider).
2. Same flow for DeepSeek once the user adds a DeepSeek key (mechanism verified against API docs; live check at implementation).
3. Key masking, replace, remove all work; removing the active key clears active state gracefully.
4. With nothing configured, every AI action shows "No AI provider configured" and the financial app works fully (DoD 16).
5. No key ever appears in logs, errors, git, or the DB (grep-asserted in CI script + review).
6. `npm test`, typecheck, lint green.

## Out of Scope

Other providers, automatic fallback, multiple keys per provider, load balancing, OAuth, cloud credential storage, marketplace, custom base URLs, general chatbot (spec ¶13).