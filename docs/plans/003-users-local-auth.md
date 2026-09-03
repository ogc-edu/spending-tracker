# 003 — Users & Local Auth

| | |
|---|---|
| **Status** | Approved — decisions confirmed (2026-09-01) |
| **Version** | 1.0 |
| **Date** | 2026-09-01 |
| **Dependencies** | 002 |
| **PRD** | §7.8 Users & Login; §8.x financial rules scoping |
| **Plan doc** | IMPLEMENTATION_PLAN.md §1 row 003 |

## Objective

Local user accounts: **register, login, logout**, and an **auto-login session**, with **PBKDF2-SHA256** password hashing (A7 rev 2026-09-03) and a **seeded default user** (ooiguancheng18@gmail.com / 1234, confirmed by the user). The app is gated behind login, and every user's financial data is isolated via `user_id` — the exact separation a future cloud database + web client will need.

## Context

Scope change (user request, 2026-09-01): the PRD originally listed "no authentication" as a non-goal; that is now an MVP feature. This is a **local, offline** auth — there is no server. The user has separately built a production-grade AWS auth system (Argon2id, refresh tokens, etc.); the choices here are deliberately ported where sensible (hashing was Argon2id until the **A7 rev 2026-09-03** on-device WASM failure forced PBKDF2-SHA256) and documented as non-production where the local context demands it.

Confirmed decisions (2026-09-01):

- **A7 (rev 2026-09-03) — Hashing: PBKDF2-SHA256** via `@noble/hashes` (pure JS, no WASM, no native module): **10,000 iterations** (Hermes-measured ~1.5 s/hash — Hermes is ~100× slower than V8 at noble's SHA256, so 600,000 would take minutes; the `$i=` field is stored per hash so the work factor can be raised later), 16-byte random salt, 32-byte key. **Why (recorded):** Argon2id was the original A7 (mirroring the user's auth-system). The A16 cross-platform swap (hash-wasm, 2026-09-01) **failed on-device on 2026-09-03** — Hermes has no WebAssembly, so every Argon2 JS implementation throws ("WebAssembly is not supported in this environment!") and neither Expo Go nor any dev build with Hermes can run it. Stored format `$pbkdf2-sha256$i=10000$<salt-b64>$<hash-b64>`; verify() re-derives with the stored iteration count and compares in constant time; malformed/legacy `$argon2id$` hashes return false (dev DBs with them must clear `users`).
- **A8 — Session: auto-login across launches; explicit logout.** Current user id in `expo-secure-store`; boot validates the id still exists.
- **A9 — Password policy: none.** Any non-empty password; the seeded `1234` is a deliberate exception (test convenience).
- **A10 — Data scoping: user-scoped financial data, global categories.** `user_id` FK on accounts/expenses/budgets/commitments/commitment_payments; the 12 default categories are a global seed shared by all local users.

## Requirements

- **Register**: email (valid format) + password (any non-empty) → creates a user (PBKDF2-SHA256 hash), auto-signs in.
- **Login**: verify password against stored hash; wrong password → clear error; duplicate email → clear error (register).
- **Logout**: clears the session → login screen.
- **Auto-login**: session survives app restarts (SecureStore); stale id (user deleted) → treated as signed out.
- **Seed**: on first launch after migrations, when `users` is empty, create the default user (hash of `1234` computed at seed time with the real hasher).
- **Gate**: root layout renders Login/Register while signed out; tabs are unreachable until signed in.
- **User-scoped queries**: all financial repositories filter by the current user (enforced from plan 004 onward).
- Register/login fully offline (no network anywhere in this feature).

## Technical Design

### Hasher abstraction

```ts
interface PasswordHasher { hash(password: string): Promise<string>; verify(password: string, encoded: string): Promise<boolean>; }
class Pbkdf2Hasher implements PasswordHasher { /* @noble/hashes pbkdf2Async(sha256, …): c=600000, dkLen=32, asyncTick=5 (A7 rev) */ }
class FakeHasher implements PasswordHasher { /* deterministic, for Jest */ }
```

Encoded format: `$pbkdf2-sha256$i=600000$<salt-b64>$<hash-b64>` (stored as-is in `users.password_hash`). The hasher is injected into AuthService so Jest runs on `FakeHasher` while devices run PBKDF2. **On-device verification is mandatory** — the A16 hash-wasm swap passed Jest but failed on a real phone (Hermes/WASM); the A7-rev hasher is verified on-device (2026-09-03: seed + login on the user's phone).

### AuthService

```
register(email, password) → { normalize email (trim, lowercase); UNIQUE violation → "email already registered"; hash; insert; setSession(user) }
login(email, password)     → { lookup by email (NOCASE); verify; mismatch → "wrong email or password"; setSession(user) }
logout()                   → { delete SecureStore key }
currentUser(): Promise<User|null> → { read id from SecureStore; lookup; null if missing/unknown }
```

### Routing gate

`app/_layout.tsx`: `initDb()` → `AuthProvider` (status: `loading | signedOut | signedIn`) → `<Redirect>` from login/register to `/(tabs)` when signed in, and from `/(tabs)` to `/login` when signed out. Screens:

```
app/login.tsx          # email + password (RHF + Zod), "Register" link, error display
app/register.tsx       # email + password + confirm, "Login" link
```

### Schema usage

`users` + `user_id` columns land in 002's migration (schema only); 003 delivers the service layer, seed, screens, and session. Repository user-scoping convention: every financial repository method takes `userId` (from `AuthService.currentUser()` at the service layer) and filters `WHERE user_id = ?`.

## Files / Components Likely Affected

- `src/services/AuthService.ts`, `src/auth/passwordHasher.ts` (hasher + fake), `src/auth/argon2Hasher.ts`
- `src/components/LoginForm.tsx`, `app/login.tsx`, `app/register.tsx`
- `src/auth/AuthProvider.tsx` (context: status + currentUser + login/logout/register)
- `app/_layout.tsx` — gate integration
- `src/db/seedUser.ts` — default-user seed (called after migrations when `users` empty)
- `src/repositories/drizzle/userRepository.ts` + `src/repositories/types.ts` (UserRepository)

## API Changes

Internal: `AuthService.{register,login,logout,currentUser}`, `UserRepository.{create,byEmail,byId,count}`. Repository interfaces for financial tables gain `userId` scoping from 004.

## Database Changes

Consumes 002's `users` table + `user_id` columns (no new schema here beyond the seed write).

## Dependencies

002 (schema, migrations, harness).

## Edge Cases

- **Stale session**: SecureStore id no longer in DB → signed out (validated at boot, no crash).
- **Duplicate email**: UNIQUE violation → friendly register error.
- **Case sensitivity**: emails stored/compared NOCASE (foo@x.com == Foo@x.com).
- **First-run order**: migrations → category seed → user seed → gate → login. If the user seed fails (hasher error), show the retry screen (same path as migration failure).
- **Expo Go**: works (hash-wasm, no native module — amended 2026-09-01); update the README accordingly.
- **Hashing latency**: 2-iter/64MiB Argon2id is ~tens of ms — acceptable; UI shows a busy state on login/register.
- **Two users on one device**: switching = logout → login as other user; data separation verified by tests.

## Security Considerations

- Argon2id with auth-system-equivalent parameters + per-user random salt — but SQLite is unencrypted at rest inside the device sandbox and this is **not** production auth. PRD §7.8 documents it as a local gate superseded by a future web backend (where the user's real auth system applies).
- No password recovery, no MFA, no rate limiting (local, offline, single device — brute force requires device access anyway).
- Seed user is intentionally weak; documented in Settings? No — documented in docs only.

## Tests

- `PasswordHasher` contract against `FakeHasher` (round-trip, mismatch).
- AuthService (harness DB): register→auto-login; duplicate email; login ok/wrong password; logout clears session; `currentUser` resolves/returns null on stale id; email case-insensitivity.
- Seed: default user exists exactly once after double-seed.
- Scoping: with two users, `userRepository`-level fixtures prove `userId` filtering (deep per-repository assertions land in 004+).

## Acceptance Criteria

1. Fresh install → login screen; default user `ooiguancheng18@gmail.com` / `1234` logs in.
2. Register creates a user and signs in; logout returns to login; login as the other user shows **their** (empty) data, not the first user's.
3. Session survives a full app restart (auto-login).
4. Wrong password and duplicate email produce clear errors; nothing crashes on stale sessions.
5. Tabs are unreachable while signed out (gate verified).
6. `npm test` green (FakeHasher path + hash-wasm known-vector/round-trip tests), typecheck/lint green; Argon2id verified by known-vector test and a hash captured from a native build (A16 swap verification).

## Out of Scope

Password recovery/reset, MFA, email verification, profile editing, roles, multiple simultaneous sessions, cloud/remote auth, forced logout, biometric unlock (future).