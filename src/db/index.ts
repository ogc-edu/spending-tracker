/** Database barrel (plan 002 file layout): client + migrations + seed + types. */
export { initDb, getDb } from './client';
export type { AppDatabase } from './client';
export { runMigrations } from './migrate';
export { insertDefaultCategoriesIfEmpty, DEFAULT_CATEGORY_SEED } from './seed';
export * from './schema';