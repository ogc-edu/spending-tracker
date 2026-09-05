/**
 * Drizzle CategoryRepository (plan 004) — read-only in the MVP; plan-016
 * follow-up adds create/delete so users can manage custom categories (the
 * pickers' "+" chip and the Settings multi-select manager). Categories are
 * GLOBAL (no user_id, A10) — shared by all users, seeded exactly once by 002.
 * `list` returns seed order (by id). Delete is LIST-ONLY (user rule):
 * expenses/budgets that reference the row are NEVER touched — SQLite FK
 * enforcement is suspended for the single delete statement.
 */
import { eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { categories, type Category } from '@/db/schema';
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

  async remove(id: number): Promise<void> {
    // List-only deletion (user rule, 016 follow-up): removing a category
    // NEVER cascades — expenses and budgets keep their category_id (their
    // rows are left untouched; dangling ids render with a generic label).
    // SQLite FKs are ON per connection, so enforcement is suspended for this
    // single statement (SQLite disallows toggling foreign_keys inside a
    // transaction; a bare DELETE is atomic on its own). Re-enabled in
    // `finally` so any throw can't leave the connection permissive.
    const pragma = this.db as unknown as { run(sql: unknown): unknown };
    try {
      await (pragma.run(sql`PRAGMA foreign_keys = OFF;`) as Promise<unknown>);
      await this.db.delete(categories).where(eq(categories.id, id));
    } finally {
      await (pragma.run(sql`PRAGMA foreign_keys = ON;`) as Promise<unknown>);
    }
  }
}