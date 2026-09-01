/**
 * Migration runner for the app runtime (expo-sqlite).
 *
 * Consumes the drizzle-kit generated bundle (drizzle/migrations.js — journal +
 * inlined .sql imports) through drizzle's expo migrator, which creates the
 * versioned `__drizzle_migrations` bookkeeping table and applies migrations in
 * order, transactionally, skipping already-applied ones (plan 002 startup
 * sequence).
 *
 * This module is NOT imported by the Node test harness — testing.ts runs the
 * same committed SQL via drizzle-orm/better-sqlite3/migrator instead.
 */
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import migrationsBundle from '../../drizzle/migrations';
import type * as schema from './schema';

export async function runMigrations(db: ExpoSQLiteDatabase<typeof schema>): Promise<void> {
  await migrate(db, migrationsBundle);
}
