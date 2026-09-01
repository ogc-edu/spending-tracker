# Spending Tracker

**iOS + Android** (cross-platform decision A16) personal finance app: manual
expense tracking, budgets, commitments/debt, and deterministic cash-flow
("safe-to-spend") awareness, with contextual AI analysis on top.

Built with **React Native + Expo + TypeScript + Expo Router + Drizzle ORM +
expo-sqlite** (local-first, fully offline for non-AI features).

## Source of truth

The design lives in `docs/` — the conversation is **not** the source of truth:

- [`docs/PRD.md`](docs/PRD.md) — product requirements (approved)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design (approved)
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — feature decomposition (approved)
- [`docs/plans/NNN-*.md`](docs/plans/) — per-feature implementation plans

## Status

Plans 001–007 shipped (navigation & theme, schema/migrations, local auth,
categories/accounts, expense CRUD, history/filters, budgets); plans
008+ (commitments engine, financial engine, dashboard, analytics, AI, cash
flow) in progress per `docs/plans/`.

Password hashing is Argon2id via **`hash-wasm` (pure WASM — decision A16)**:
no native module, so the app runs in **Expo Go on both Android and iOS** —
no development build (`npx expo run:android`) required.

## Commands

```bash
npm start        # Expo dev server (Expo Go on Android/iOS)
npm test         # Jest
npm run lint     # ESLint (expo config)
npm run typecheck
```