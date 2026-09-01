/** Database barrel (plan 002 file layout): client + migrations + seed + types + repository factory. */
export { initDb, getDb } from './client';
export type { AppDatabase } from './client';
export { runMigrations } from './migrate';
export { insertDefaultCategoriesIfEmpty, DEFAULT_CATEGORY_SEED } from './seed';
export { seedDefaultUserIfEmpty, DEFAULT_USER_EMAIL, DEFAULT_USER_PASSWORD } from './seedUser';
export { repositories, type Repositories } from './repositories';
export * from './schema';
