# Spending Tracker

**iOS + Android** (cross-platform decision A16) personal finance app: manual
expense tracking, budgets, commitments/debt, and deterministic cash-flow
("safe-to-spend") awareness, with contextual AI analysis on top.

Built with **React Native + Expo + TypeScript + Expo Router + Drizzle ORM +
expo-sqlite** (local-first, fully offline for non-AI features).

## Run it

**Expo Go on both platforms — no development build required.** Argon2id
hashing runs via `hash-wasm` (pure WASM, decision A16), so the app works in
Expo Go on Android **and** iOS; `npx expo run:android` / `run:ios` (dev
builds) are optional, for native tooling only.

```bash
npm install
npm start        # Expo dev server → open in Expo Go (Android/iOS)
npm test         # Jest (jest-expo, ios preset)
npm run test:ios # explicit ios-preset run
npm run lint     # ESLint (expo config)
npm run typecheck
```

## First run / seeding

The first launch creates a default local user — **`ooiguancheng18@gmail.com`
/ `1234`** — plus the 12 default categories. Register any additional local
accounts from the login screen; each user's data is isolated (`user_id`
scoping).

iOS Keychain note (deliberate): SecureStore entries **survive app reinstall
on iOS** (the Keychain outlives the app). A stale session id is validated
against the local `users` table at boot and treated as signed-out; AI API
keys are deliberately left in place across reinstalls — they belong to the
user's provider account, not to an app install. If you want a truly clean
slate, clear the keychain entry for the app between installs.

## Source of truth

The design lives in `docs/` — the conversation is **not** the source of truth:

- [`docs/PRD.md`](docs/PRD.md) — product requirements (approved)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design (approved)
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — feature decomposition (approved)
- [`docs/plans/NNN-*.md`](docs/plans/) — per-feature implementation plans
- [`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md) — MVP DoD 1–17 acceptance sweep (plan 016)

## Status

Plans 001–016 shipped — **MVP complete** (plans 001–012 features, 013–015 AI
BYOK/analysis, 016 polish & hardening: empty states everywhere, destructive
confirm sheets, write-failure toasts, complete Settings (SET-1/2),
accessibility pass, iOS parity, offline QA sweep). See `docs/plans/` for the
per-plan record.