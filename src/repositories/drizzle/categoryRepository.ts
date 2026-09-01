/**
 * Drizzle CategoryRepository (plan 004) — read-only in the MVP (customization
 * is future, PRD §3). Categories are GLOBAL (no user_id, A10) — shared by all
 * users, seeded exactly once by 002. `list` returns seed order (by id).
 */
import { eq } from 'drizzle-orm';
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
}