/**
 * AuthService — register/login/logout/currentUser (plan 003 / ARCHITECTURE §2).
 *
 * - Email normalized: trim + lowercase; UNIQUE violation → "email already registered".
 * - Password: any non-empty string (A9); hashing via injected PasswordHasher
 *   (Argon2IdHasher on-device, FakeHasher in Jest).
 * - Session: persisted via injected SessionStore (SecureStore on-device,
 *   in-memory in Jest); stale id → signed out (null).
 */

import type { PasswordHasher } from '@/auth/passwordHasher';
import type { SessionStore } from '@/auth/sessionStore';
import type { User } from '@/db/schema';
import type { UserRepository } from '@/repositories/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmailAndPassword(email: string, password: string): void {
  const normalized = normalizeEmail(email);
  if (!normalized || !EMAIL_RE.test(normalized)) {
    throw new Error('invalid email');
  }
  if (!password) {
    throw new Error('password required');
  }
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly session: SessionStore,
  ) {}

  /** Register → hash → insert → setSession; duplicate email → friendly error. */
  async register(email: string, password: string): Promise<User> {
    validateEmailAndPassword(email, password);
    const normalized = normalizeEmail(email);
    const passwordHash = await this.hasher.hash(password);
    try {
      const user = await this.users.create({ email: normalized, passwordHash });
      await this.session.setCurrentUserId(user.id);
      return user;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE/i.test(message)) {
        throw new Error('email already registered');
      }
      throw error;
    }
  }

  /** Login: NOCASE lookup → verify; mismatch → "wrong email or password". */
  async login(email: string, password: string): Promise<User> {
    const normalized = normalizeEmail(email);
    if (!normalized || !EMAIL_RE.test(normalized)) {
      throw new Error('wrong email or password');
    }
    if (!password) {
      throw new Error('wrong email or password');
    }
    const user = await this.users.byEmail(normalized);
    if (!user) {
      throw new Error('wrong email or password');
    }
    const ok = await this.hasher.verify(password, user.passwordHash);
    if (!ok) {
      throw new Error('wrong email or password');
    }
    await this.session.setCurrentUserId(user.id);
    return user;
  }

  async logout(): Promise<void> {
    await this.session.clearCurrentUserId();
  }

  /** Returns the current user from the persisted id, or null (incl. stale id). */
  async currentUser(): Promise<User | null> {
    const id = await this.session.getCurrentUserId();
    if (id == null) return null;
    const user = await this.users.byId(id);
    if (!user) {
      // Stale session: user was deleted — treat as signed out (and clear).
      await this.session.clearCurrentUserId();
      return null;
    }
    return user;
  }
}
