# 016 — Polish & Hardening

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 010, 011, 013, 014, 015 |
| **PRD** | §UI/UX direction; §11 DoD 1–17; NFR-1..8 |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 016 |

## Objective

The final cross-cutting pass: empty states, form/validation edge cases, error toasts, deficit-polish, accessibility, offline verification, and the full DoD acceptance sweep — making the MVP feel finished and proving every acceptance criterion on-device with the network off (except AI).

## Context

All features exist by the start of this plan. This is hardening + QA, not new functionality (PRD: "Do not add features not specified"). The Settings screen also receives its remaining promised surfaces: safety-buffer editing (PRD SET-1 — service exists since 010; only the UI is missing) and the AI status line (key status, already stored by 013).

## Requirements

- **Empty states everywhere**: Dashboard (no accounts → CTA; no data), Expenses (no expenses; no filter results), Budgets (no budgets), Commitments (none), Analytics (empty month), Settings (empty buffer default is fine) — consistent `EmptyState` component with action links.
- **Form/validation edge cases**: amount inputs reject junk (`parseMoneyToSen`, 004) with inline errors everywhere; double-submit guards on all save buttons; confirm dialogs for destructive actions (delete expense, un-pay, cancel commitment, clear budget).
- **Error toasts**: transient write failures surface as toasts (safe-area-aware); AI errors stay inline in their cards (013).
- **Deficit polish**: Dashboard deficit styling + copy fully consistent; analytics/allowance don't contradict it.
- **Accessibility**: readable contrast (theme tokens verified), minimum touch targets (≥44pt), screen-reader labels on key figures (money values read with currency context), form labels associated with inputs.
- **Offline verification**: full DoD sweep with airplane mode on (AI actions error, everything else works) — checklist result recorded.
- **iOS parity pass** (A16): keyboard avoiding + safe-area on notch/Dynamic Island devices; iOS font pairing for money figures (`Platform`-gated tabular figures in `typography.ts`); Keychain-reinstall handling for SecureStore session/API keys (iOS Keychain survives uninstall — clear stale session/keys on first launch or document the choice); iOS icon/splash confirmed present in `app.json`; `jest-expo` exercised with the ios preset.
- **Settings completion**: safety-buffer editor (number field, sen parse, save); AI section status ("Gemini · key configured/not configured", add/clear key already in 013).
- Housekeeping: final `npm test`/typecheck/lint; remove any leftover template or dead code; README run instructions (Expo Go on both platforms — no dev-build requirement post A16).

## Technical Design

- `src/components/EmptyState.tsx` (title, note, optional action) — reused by every tab.
- `src/components/ConfirmSheet.tsx` — native Alert-based or bottom-sheet wrapper for destructive confirms (single implementation).
- `ToastProvider` (lightweight context + timed snackbar) — write failures only; no toast spam (PRD UI/UX).
- Accessibility: `accessibilityLabel`/`accessibilityRole` pass on key elements; test on the numbers (e.g. "Safe to spend, one thousand nine hundred ringgit").
- QA matrix: `docs/QA_CHECKLIST.md` — DoD 1–17 mapped to steps + expected results (committed; not a code deliverable).

## Files / Components Likely Affected

- `src/components/EmptyState.tsx`, `ConfirmSheet.tsx`, `ToastProvider.tsx` (new)
- `app/(tabs)/settings.tsx` — buffer editor + AI status (completion of SET-1/2)
- Every tab screen: empty-state + confirm-dialog integration, accessibility pass
- `docs/QA_CHECKLIST.md` (new)

## API Changes

`SettingsService.setBuffer` (exists from 010) now surfaced in UI.

## Database Changes

None.

## Dependencies

All feature plans (010, 011, 013, 014, 015; implicitly everything downstream).

## Decisions (confirmed defaults — no open questions)

- Confirms use the system confirm dialog or a minimal sheet (no third-party dialog lib).
- Toasts are transient (≈2.5 s), non-modal, one at a time.
- No dark mode, no animations beyond system defaults (PRD: avoid unnecessary animations), no onboarding.

## Edge Cases

- Very long numbers / narrow screens: money text wraps safely or truncates with ellipsis (tabular-nums; tested on small emulator).
- Rapid consecutive destructive actions: confirms + pending guards.
- Buffer set to invalid/zero: zero accepted? — no: buffer must be ≥ 0 sen; 0 allowed (edge: user wants no buffer) — documented.
- AI key cleared mid-flight: next action shows key-missing state (013 handles).

## Security Considerations

- No new secrets; buffer is user preference data; confirm dialogs gate destructive ops.
- Offline sweep re-verifies nothing non-AI touches the network.

## Tests

- Component tests (following Jest setup): EmptyState renders actions; ConfirmSheet invokes on-confirm once; Toast auto-dismisses.
- Money reading fixture (formatSen → spoken label), touch-target constants asserted.
- Settings: buffer save/load round-trip; AI status reflects key presence.

## Acceptance Criteria (final — the whole DoD)

1. DoD 1–17 verified on-device per `docs/QA_CHECKLIST.md`, including: airplane-mode sweep (non-AI fully functional; AI shows clear errors), two-user isolation (DoD 17), deficit state, empty states, and destructive-confirm flows.
2. Accessibility pass done (contrast, touch targets, labels).
3. Settings completes SET-1 (buffer) and SET-2 (AI status).
4. `npm test`, typecheck, lint all green; no dead code from the template remains.
5. README documents running via development build (native Argon2id), seeding note, and the docs map.

## Out of Scope

Dark mode, animations, onboarding, notifications, localization, performance tooling beyond the obvious, Play Store packaging.