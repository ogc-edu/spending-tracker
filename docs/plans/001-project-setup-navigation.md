# 001 — Project Setup & Navigation

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | none |
| **PRD** | §10 constraints; §7.9 navigation |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 001 |

## Objective

A buildable Expo + TypeScript Android app with the six-tab navigation shell from the PRD, base theme, lint/typecheck/test tooling, and no business logic. Everything else in the master plan lands on top of this.

## Context

The app is Android-first React Native via Expo. This plan stands up the skeleton only: tooling, router, theme tokens, and placeholder screens. No database, no services, no AI.

## Requirements

- Scaffold Expo app with TypeScript and Expo Router (file-based routing).
- Six tabs: **Dashboard** (index), **Expenses**, **Budgets**, **Commitments**, **Analytics**, **Settings**.
- Base UI theme: color tokens, spacing, typography — clean personal-finance look (PRD §UI/UX: low clutter, clear numbers, no gamification).
- Tooling: ESLint (expo config) + `tsc --noEmit` + Jest (jest-expo) wired; `npm run lint|typecheck|test`.
- Placeholder screens render the tab name; Dashboard placeholder shows where the cash-flow card will live.
- No financial logic, no SQL, no secrets anywhere in this plan.

## Technical Design

### Scaffold

- `npx create-expo-app` (default template: TypeScript + Expo Router + tabs already wired).
- Replace the template's example screens with our own minimal layout; delete leftover example code.
- Package manager: npm (default; no preference — lockfile committed).

### Router structure

```
app/
├── _layout.tsx            # root Stack (holds providers + migration gate later)
└── (tabs)/
    ├── _layout.tsx        # Tabs navigator, 6 screens, icons via @expo/vector-icons
    ├── index.tsx          # Dashboard
    ├── expenses.tsx       # Expenses (list entry — detail/add screens come in 004/005)
    ├── budgets.tsx
    ├── commitments.tsx
    ├── analytics.tsx
    └── settings.tsx
```

- Tab config in `(tabs)/_layout.tsx`: icons (Ionicons/Feather), titles, `headerShown` per tab.
- Dark/light: MVP uses a single light theme (decision D-t1); dark mode is future.

### Theme tokens (`src/theme/`)

- `colors.ts`: background, surface/card, text, muted, accent (single money-green), danger (over-budget/deficit red), border, category palette (12 colors for the default categories — used by category chips later).
- `spacing.ts`, `typography.ts`: tight scale; numbers rendered with tabular-nums so digits don't jiggle in dashboard.
- `src/theme/index.ts` barrel export.

### Tooling

- Jest: `jest-expo` preset; `testMatch` for `src/**/*.test.ts` — engine tests (and repo tests from 002) run in Node; component tests are out of scope until they're needed.
- ESLint: `eslint-config-expo`; TypeScript: `tsconfig.json` strict, `noUncheckedIndexedAccess` on.
- Scripts: `test`, `lint`, `typecheck` (the latter two wired to run in CI later).

## Files / Components Likely Affected

- `app/*` (router, 6 tab screens)
- `src/theme/*` (new)
- `package.json`, `tsconfig.json`, `eslint.config.js`, `jest.config.js` (new/changed)
- Template leftovers deleted (`app/(tabs)/index.tsx` example content, `components/*` examples, `app-example/` if present)

## API Changes

None (no app-level services yet).

## Database Changes

None.

## Dependencies

- Runtime: whatever the Expo default template ships (expo, expo-router, react, react-native, @expo/vector-icons).
- Dev: jest, jest-expo, eslint, eslint-config-expo, typescript (all template-bundled or added here).

## Edge Cases

- Non-empty directory during scaffold: docs/ already exists — `create-expo-app` must not clobber it (template files only).
- Metro + router entry: `"main": "expo-router/entry"` must be set (template default).
- Emulator vs device: no assumptions — dev via Expo Go for this plan.

## Security Considerations

- None: no credentials, no network, no data yet.

## Tests

- Smoke: a trivial Jest test asserting the test runner works (`src/theme/__tests__/tokens.test.ts` — colors export expected keys).
- Typecheck + lint clean.
- Manual QA: `npx expo start` boots; six tabs render and navigate.

## Acceptance Criteria

1. `npm install` clean; `npm run lint`, `npm run typecheck`, `npm test` all green.
2. App boots in Expo Go / emulator showing the 6 tabs; each placeholder screen renders its title.
3. Theme tokens exported and used by the tab navigator (no inline magic colors for chrome).
4. Template example code removed; no dead imports.
5. `docs/` untouched by the scaffold.

## Out of Scope

- Any feature logic (all later plans), dark mode, component test stack, CI pipeline, icons beyond tab icons.