# Spending Tracker

Android-first personal finance app: manual expense tracking, budgets,
commitments/debt, and deterministic cash-flow ("safe-to-spend") awareness,
with contextual AI analysis on top.

Built with **React Native + Expo + TypeScript + Expo Router + Drizzle ORM +
expo-sqlite** (local-first, fully offline for non-AI features).

## Source of truth

The design lives in `docs/` — the conversation is **not** the source of truth:

- [`docs/PRD.md`](docs/PRD.md) — product requirements (approved)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design (approved)
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — feature decomposition (approved)
- [`docs/plans/NNN-*.md`](docs/plans/) — per-feature implementation plans

## Status

Scaffold (plan 001) only: six-tab navigation shell + theme + tooling.
Feature implementation starts after plans are approved.

## Commands

```bash
npm start        # Expo dev server (Android via Expo Go)
npm test         # Jest
npm run lint     # ESLint (expo config)
npm run typecheck
```