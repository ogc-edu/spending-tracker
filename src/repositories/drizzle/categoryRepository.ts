/**
 * Drizzle CategoryRepository (plan 004) — read-only in the MVP; plan-016
 * follow-up adds create/delete so users can manage custom categories (the
 * expense form's "+" chip and long-press delete). Categories are GLOBAL
 * (no user_id, A10) — shared by all users, seeded exactly once by 002.
 * `list` returns seed order (by id). Delete reassigns expenses to the
 * caller-resolved fallback ('Other') and nulls per-category budget refs —
 * expenses.category_id is NOT NULL + FK, so reassignment must precede the
 * row delete.
 */
import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { budgets, categories, expenses, type Category } from '@/db/schema';
import type { CategoryRepository } from '../types';

type AnyDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof import('@/db/schema')>;

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly db: AnyDb) {}

  async list(): Promise<Category[]> {
    return (await this.db.select().from(categories).orderBy(categories.id)) as unknown as Category[];
  }

  async byId(id: number): Promise<Category | null> {
    const rows = (await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))) as unknown as Category[];
    return rows[0] ?? null;
  }

  async create(input: { name: string; icon: string }): Promise<Category> {
    const rows = (await this.db
      .insert(categories)
      .values({ name: input.name, icon: input.icon, type: 'expense' })
      .returning()) as unknown as Category[];
    if (!rows[0]) throw new Error('category insert returned no row');
    return rows[0];
  }

  async removeWithReassign(id: number, fallbackCategoryId: number): Promise<void> {
    // Expenses must NOT be orphaned (category_id NOT NULL + FK): move them
    // to the fallback first, then drop per-category budget refs (they become
    // overall), then the row itself. SYNCHRONOUS transaction (the driver
    // pattern used across the drizzle repos): any throw rolls back all three.
    const db = this.db as unknown as {
      transaction<T>(fn: (tx: {
        update(table: unknown): { set(v: unknown): { where(...a: unknown[]): { run(): void } } };
        delete(table: unknown): { where(...a: unknown[]): { run(): void } };
      }) => T): T;
    };
    db.transaction((tx) => {
      tx.update(expenses)
        .set({ categoryId: fallbackCategoryId })
        .where(eq(expenses.categoryId, id))
        .run();
      tx.update(budgets).set({ categoryId: null }).where(eq(budgets.categoryId, id)).run();
      tx.delete(categories).where(eq(categories.id, id)).run();
    });
  }
}