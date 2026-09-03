/**
 * Default-user seed — plan 003 seed (ARCHITECTURE A11, PRD USR-4).
 *
 * Idempotent: only writes when `users` is empty (first launch after
 * migrations). The password hash is computed at seed time with the
 * injected hasher (Pbkdf2Hasher on-device, FakeHasher in Jest), so no
 * hash is ever committed.
 *
 * Seeded credentials (user-confirmed 2026-09-01):
 *  email   = ooiguancheng18@gmail.com
 *  password = 1234   (intentionally weak — test convenience, documented)
 */

import type { PasswordHasher } from '@/auth/passwordHasher';
import { DrizzleUserRepository } from '@/repositories/drizzle/userRepository';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

export const DEFAULT_USER_EMAIL = 'ooiguancheng18@gmail.com';
export const DEFAULT_USER_PASSWORD = '1234';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;

export async function seedDefaultUserIfEmpty(db: AnyDb, hasher: PasswordHasher): Promise<number> {
  const repo = new DrizzleUserRepository(db);
  const count = await repo.count();
  if (count > 0) return 0;

  const passwordHash = await hasher.hash(DEFAULT_USER_PASSWORD);
  const normalized = DEFAULT_USER_EMAIL.trim().toLowerCase();
  await repo.create({ email: normalized, passwordHash });
  return 1;
}
