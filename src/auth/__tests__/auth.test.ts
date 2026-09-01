/**
 * Plan 003 tests — AuthService flows against the better-sqlite3 harness
 * with FakeHasher (plan's Tests section). No native module / device needed.
 *
 * Covers:
 * - FakeHasher contract (round-trip, mismatch)
 * - AuthService: register→auto-login, duplicate email (case-insensitive),
 *   login ok / wrong password, logout, stale-session, case-insensitivity
 * - Seed default user idempotency
 * - Two-user isolation smoke (users separate; financial scoping deep in 004+)
 */

import { describe, expect, it } from '@jest/globals';
import { FakeHasher } from '../passwordHasher';
import { InMemorySessionStore } from '../sessionStore';
import { DrizzleUserRepository } from '@/repositories/drizzle/userRepository';
import { AuthService } from '@/services/AuthService';
import { DEFAULT_USER_EMAIL, DEFAULT_USER_PASSWORD, seedDefaultUserIfEmpty } from '@/db/seedUser';
import { createMigratedTestDb } from '@/db/testing';

function makeAuth() {
  const test = createMigratedTestDb();
  const repo = new DrizzleUserRepository(test.db as unknown as never);
  const hasher = new FakeHasher();
  const session = new InMemorySessionStore();
  const service = new AuthService(repo, hasher, session);
  return { test, repo, hasher, session, service };
}

describe('FakeHasher contract', () => {
  it('round-trips', async () => {
    const hasher = new FakeHasher();
    const encoded = await hasher.hash('secret');
    expect(encoded).not.toBe('secret');
    expect(await hasher.verify('secret', encoded)).toBe(true);
  });

  it('mismatch returns false', async () => {
    const hasher = new FakeHasher();
    const encoded = await hasher.hash('correct');
    expect(await hasher.verify('wrong', encoded)).toBe(false);
  });
});

describe('AuthService', () => {
  it('register auto-logins (session + currentUser)', async () => {
    const { service, session } = makeAuth();
    const user = await service.register('alice@example.com', 'pw1');
    expect(user.email).toBe('alice@example.com');
    expect(await session.getCurrentUserId()).toBe(user.id);
    const current = await service.currentUser();
    expect(current?.id).toBe(user.id);
    expect(current?.email).toBe('alice@example.com');
  });

  it('register normalizes email (trim + lowercase)', async () => {
    const { service } = makeAuth();
    const user = await service.register('  Alice@Example.COM  ', 'pw1');
    expect(user.email).toBe('alice@example.com');
    // Login with differently-cased email also works
    await service.logout();
    const logged = await service.login('ALICE@example.com', 'pw1');
    expect(logged.id).toBe(user.id);
  });

  it('register rejects duplicate email (case-insensitive) with friendly message', async () => {
    const { service } = makeAuth();
    await service.register('foo@example.com', 'a');
    await expect(service.register('foo@example.com', 'b')).rejects.toThrow('email already registered');
    await expect(service.register('FOO@example.com', 'c')).rejects.toThrow('email already registered');
    await expect(service.register('  Foo@Example.COM  ', 'd')).rejects.toThrow('email already registered');
  });

  it('register rejects invalid email and empty password', async () => {
    const { service } = makeAuth();
    await expect(service.register('not-an-email', 'pw')).rejects.toThrow('invalid email');
    await expect(service.register('', 'pw')).rejects.toThrow('invalid email');
    await expect(service.register('ok@example.com', '')).rejects.toThrow('password required');
  });

  it('login succeeds and auto-logins', async () => {
    const { service, session } = makeAuth();
    const registered = await service.register('bob@example.com', 'hunter2');
    await service.logout();
    expect(await session.getCurrentUserId()).toBeNull();
    const logged = await service.login('bob@example.com', 'hunter2');
    expect(logged.id).toBe(registered.id);
    expect(await session.getCurrentUserId()).toBe(registered.id);
  });

  it('login is case-insensitive on email', async () => {
    const { service } = makeAuth();
    await service.register('Carol@Example.com', 'pw');
    await service.logout();
    const u = await service.login('carol@example.com', 'pw');
    expect(u.email).toBe('carol@example.com');
    await service.logout();
    const u2 = await service.login('CAROL@EXAMPLE.COM', 'pw');
    expect(u2.email).toBe('carol@example.com');
  });

  it('login with wrong password or unknown email gives clear error', async () => {
    const { service } = makeAuth();
    await service.register('dave@example.com', 'correct');
    await service.logout();
    await expect(service.login('dave@example.com', 'wrong')).rejects.toThrow('wrong email or password');
    await expect(service.login('unknown@example.com', 'any')).rejects.toThrow('wrong email or password');
    // invalid-shaped email on login also maps to the same generic message (no leak)
    await expect(service.login('not-an-email', 'any')).rejects.toThrow('wrong email or password');
    await expect(service.login('dave@example.com', '')).rejects.toThrow('wrong email or password');
  });

  it('logout clears session and currentUser becomes null', async () => {
    const { service, session } = makeAuth();
    await service.register('eve@example.com', 'pw');
    expect(await service.currentUser()).not.toBeNull();
    await service.logout();
    expect(await session.getCurrentUserId()).toBeNull();
    expect(await service.currentUser()).toBeNull();
  });

  it('stale session (deleted user) resolves to null and clears the store', async () => {
    const { test, service, session } = makeAuth();
    const user = await service.register('frank@example.com', 'pw');
    // Simulate user deleted externally
    test.sqlite.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    // Session still holds the old id
    expect(await session.getCurrentUserId()).toBe(user.id);
    const current = await service.currentUser();
    expect(current).toBeNull();
    // Store should have been cleared
    expect(await session.getCurrentUserId()).toBeNull();
  });

  it('currentUser returns null when never signed in', async () => {
    const { service } = makeAuth();
    expect(await service.currentUser()).toBeNull();
  });

  it('two users are isolated; switching via logout→login shows empty vs own data boundary', async () => {
    const { service, repo } = makeAuth();
    const alice = await service.register('alice@example.com', 'pw');
    await service.logout();
    const bob = await service.register('bob@example.com', 'pw2');
    expect(bob.id).not.toBe(alice.id);
    expect(await repo.count()).toBe(2);
    // currentUser is bob now
    expect((await service.currentUser())?.email).toBe('bob@example.com');
    await service.logout();
    const back = await service.login('alice@example.com', 'pw');
    expect(back.id).toBe(alice.id);
  });
});

describe('seed default user', () => {
  it('creates the default user exactly once (idempotent)', async () => {
    const test = createMigratedTestDb();
    const hasher = new FakeHasher();

    const n1 = await seedDefaultUserIfEmpty(test.db as unknown as never, hasher);
    expect(n1).toBe(1);
    const n2 = await seedDefaultUserIfEmpty(test.db as unknown as never, hasher);
    expect(n2).toBe(0);

    const repo = new DrizzleUserRepository(test.db as unknown as never);
    expect(await repo.count()).toBe(1);
    const user = await repo.byEmail(DEFAULT_USER_EMAIL);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(DEFAULT_USER_EMAIL.toLowerCase());
    // Password verifies (hash was computed with the injected hasher)
    expect(await hasher.verify(DEFAULT_USER_PASSWORD, user!.passwordHash)).toBe(true);
    expect(await hasher.verify('wrong', user!.passwordHash)).toBe(false);
  });

  it('does not seed when users already exist', async () => {
    const test = createMigratedTestDb();
    const hasher = new FakeHasher();
    const repo = new DrizzleUserRepository(test.db as unknown as never);
    await repo.create({ email: 'existing@example.com', passwordHash: await hasher.hash('x') });
    const n = await seedDefaultUserIfEmpty(test.db as unknown as never, hasher);
    expect(n).toBe(0);
    expect(await repo.count()).toBe(1);
    expect(await repo.byEmail(DEFAULT_USER_EMAIL)).toBeNull();
  });

  it('seed email lookup is case-insensitive', async () => {
    const test = createMigratedTestDb();
    const hasher = new FakeHasher();
    await seedDefaultUserIfEmpty(test.db as unknown as never, hasher);
    const repo = new DrizzleUserRepository(test.db as unknown as never);
    expect(await repo.byEmail('OOIGUANCHENG18@GMAIL.COM')).not.toBeNull();
    expect(await repo.byEmail('Ooiguancheng18@gmail.com')).not.toBeNull();
  });
});

describe('UserRepository case-insensitivity at the DB level', () => {
  it('byEmail finds user regardless of casing', async () => {
    const test = createMigratedTestDb();
    const repo = new DrizzleUserRepository(test.db as unknown as never);
    const hasher = new FakeHasher();
    await repo.create({ email: 'Mixed@Example.com', passwordHash: await hasher.hash('pw') });
    expect(await repo.byEmail('mixed@example.com')).not.toBeNull();
    expect(await repo.byEmail('MIXED@EXAMPLE.COM')).not.toBeNull();
    expect(await repo.byEmail('MiXeD@eXaMpLe.CoM')).not.toBeNull();
  });
});
