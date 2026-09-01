/**
 * Drizzle UserRepository — the only UserRepository impl in the MVP.
 * Compatible with both the app's expo-sqlite AppDatabase (async) and the
 * Node harness BetterSQLite3Database (sync): every query is awaited, which
 * works on both (sync returns a plain value, async a Promise).
 */

import { sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { users, type User } from '@/db/schema';
import type { UserRepository } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: AnyDb) {}

  async create(input: { email: string; passwordHash: string }): Promise<User> {
    // .returning() is supported on both drivers.
    const rows = (await (
      this.db.insert(users).values({ email: input.email, passwordHash: input.passwordHash }).returning() as unknown as Promise<User[]>
    )) as User[];
    if (rows.length > 0 && rows[0]) return rows[0];
    // Fallback for drivers where returning() is not populated (rare): re-read by email.
    const fallback = await this.byEmail(input.email);
    if (!fallback) throw new Error('User insert failed — row not found after insert');
    return fallback;
  }

  async byEmail(email: string): Promise<User | null> {
    // Emails stored normalized (lowercase); compare COLLATE NOCASE for safety
    // across both drivers. Use a raw SQL predicate so either driver handles it.
    const rows = (await this.db
      .select()
      .from(users)
      .where(sql`${users.email} = ${email} COLLATE NOCASE`)) as unknown as User[];
    return rows[0] ?? null;
  }

  async byId(id: number): Promise<User | null> {
    const rows = (await this.db
      .select()
      .from(users)
      .where(sql`${users.id} = ${id}`)) as unknown as User[];
    return rows[0] ?? null;
  }

  async count(): Promise<number> {
    const rows = (await this.db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(users)) as unknown as { n: number }[];
    return rows[0]?.n ?? 0;
  }
}
