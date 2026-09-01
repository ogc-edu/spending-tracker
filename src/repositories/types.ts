/**
 * Repository contracts (ARCHITECTURE §2 — repositories are interfaces so a
 * future cloud backend can reuse them). 003 introduces UserRepository;
 * financial repositories (004+) add userId scoping.
 */

import type { User } from '@/db/schema';

export interface UserRepository {
  /**
   * Insert a user. Caller normalizes email (trim + lowercase); the DB
   * enforces UNIQUE + COLLATE NOCASE. Returns the created row.
   */
  create(input: { email: string; passwordHash: string }): Promise<User>;
  /** Lookup by email, case-insensitive (NOCASE). */
  byEmail(email: string): Promise<User | null>;
  byId(id: number): Promise<User | null>;
  count(): Promise<number>;
}
