/**
 * expo-sqlite client — the ONLY module that imports expo-sqlite (plan 002:
 * schema.ts and the Node harness must load without it).
 *
 * Startup sequence (plan 003 extends plan 002):
 *  1. openDatabaseSync('spending.db') + pragmas (WAL, foreign_keys per connection)
 *  2. runMigrations(): drizzle migrator over the committed drizzle/*.sql bundle
 *  3. seed default categories iff the table is empty
 *  4. seed default user iff users is empty (FEATURE 003 — Argon2id hash at seed time)
 * Any throw → the caller (root layout) shows the retry screen; initDb() resets
 * its single-flight promise on failure so Retry re-runs cleanly (migrations are
 * recorded, seed is idempotent). Concurrent callers share one init while it's
 * in flight — a double-tap/remount can never double-seed.
 */
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { runMigrations } from './migrate';
import { insertDefaultCategoriesIfEmpty } from './seed';
import { seedDefaultUserIfEmpty } from './seedUser';
import { Argon2IdHasher } from '@/auth/argon2Hasher';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let db: AppDatabase | null = null;
let initPromise: Promise<void> | null = null;

async function openAndInit(): Promise<AppDatabase> {
  const sqlite = openDatabaseSync('spending.db');
  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
  const client = drizzle(sqlite, { schema });
  await runMigrations(client);
  await insertDefaultCategoriesIfEmpty(client);
  // Default user seed — Argon2id via hash-wasm (pure WASM, decision A16).
  // If it fails the init gate shows the retry screen (same path as migration failure).
  await seedDefaultUserIfEmpty(client, new Argon2IdHasher());
  return client;
}

/** Initialize the singleton DB. Resolves once; rejects without caching on failure (Retry-friendly). */
export function initDb(): Promise<void> {
  if (!initPromise) {
    initPromise = openAndInit().then(
      (client) => {
        db = client;
      },
      (error: unknown) => {
        initPromise = null; // clear the cache so a retry re-runs openAndInit()
        throw error;
      },
    );
  }
  return initPromise;
}

/** The initialized client for repositories (003+). Throws when initDb() hasn't resolved. */
export function getDb(): AppDatabase {
  if (!db) {
    throw new Error('getDb() called before initDb() resolved');
  }
  return db;
}
