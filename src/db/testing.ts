/**
 * Node-side test harness (plan 002): an in-memory better-sqlite3 database with a
 * Drizzle instance that runs the SAME committed migration SQL (drizzle/*.sql,
 * read in journal order) as the app — repository/migration tests run in Jest
 * with no Android device. Does NOT import expo-sqlite.
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/** drizzle/* committed by drizzle-kit at the repo root (../.. from src/db). */
const MIGRATIONS_FOLDER = path.join(__dirname, '..', '..', 'drizzle');

export interface TestDb {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
}

/** Fresh in-memory DB with the same pragmas as the app client (foreign_keys must be per connection). */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/** Apply all committed generated migrations (idempotent; same SQL as the app). */
export function runMigrations(db: BetterSQLite3Database<typeof schema>): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** One-shot helper: fresh migrated DB, ready for repository tests. */
export function createMigratedTestDb(): TestDb {
  const test = createTestDb();
  runMigrations(test.db);
  return test;
}