/**
 * Category seed — PRD EXP-7 default categories (database entities, not
 * hardcoded UI strings). Global table (no user_id, A10): seeded exactly once,
 * idempotent on an empty table. The default *user* is NOT seeded here — that
 * belongs to feature 003 (needs the Argon2 hasher).
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { categories } from './schema';
import type { NewCategory } from './schema';

export const DEFAULT_CATEGORY_SEED: NewCategory[] = [
  { name: 'Food', icon: 'restaurant-outline', type: 'expense' },
  { name: 'Groceries', icon: 'cart-outline', type: 'expense' },
  { name: 'Transport', icon: 'car-outline', type: 'expense' },
  { name: 'Entertainment', icon: 'film-outline', type: 'expense' },
  { name: 'Shopping', icon: 'bag-handle-outline', type: 'expense' },
  { name: 'Bills', icon: 'receipt-outline', type: 'expense' },
  { name: 'Health', icon: 'medkit-outline', type: 'expense' },
  { name: 'Education', icon: 'school-outline', type: 'expense' },
  { name: 'Travel', icon: 'airplane-outline', type: 'expense' },
  { name: 'Gifts', icon: 'gift-outline', type: 'expense' },
  { name: 'Debt / Repayment', icon: 'card-outline', type: 'expense' },
  { name: 'Other', icon: 'ellipsis-horizontal-circle-outline', type: 'expense' },
];

type AnySQLiteDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('./schema')>;

/**
 * Insert the 12 default categories iff the categories table is empty.
 * Runs on the app's expo-sqlite client AND the Node harness (better-sqlite3).
 * Returns the number of rows written (0 when already seeded).
 */
export async function insertDefaultCategoriesIfEmpty(db: AnySQLiteDb): Promise<number> {
  const existing = await db.select({ id: categories.id }).from(categories).limit(1);
  if (existing.length > 0) {
    return 0;
  }
  await db.insert(categories).values(DEFAULT_CATEGORY_SEED);
  return DEFAULT_CATEGORY_SEED.length;
}