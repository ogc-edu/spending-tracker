/**
 * CategoryService (plan 004, extended plan-016 follow-up) — passthrough over
 * CategoryRepository plus category management: create (validated name +
 * icon) and delete (guarded: 'Other' — the fallback every delete reassigns
 * to — can never be deleted). Categories are global + seeded; user-created
 * rows share the same table (A10). Consumed by the expense form's "+" chip
 * and long-press delete.
 */
import type { Category } from '@/db/schema';
import type { CategoryRepository } from '@/repositories/types';

export const CATEGORY_NAME_MAX = 24;
export const CANNOT_DELETE_OTHER_MESSAGE =
  "'Other' is the built-in fallback category and can't be deleted";

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  list(): Promise<Category[]> {
    return this.categories.list();
  }

  byId(id: number): Promise<Category | null> {
    return this.categories.byId(id);
  }

  /**
   * Create a custom category. Name: trimmed, non-empty, ≤ 24 chars,
   * case-insensitively unique against existing categories. Icon: any
   * Ionicons name (the UI offers a curated set). Returns the created row.
   */
  async create(name: string, icon: string): Promise<Category> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name required');
    if (trimmed.length > CATEGORY_NAME_MAX) {
      throw new Error(`Category name must be ${CATEGORY_NAME_MAX} characters or fewer`);
    }
    const existing = await this.categories.list();
    if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Category "${trimmed}" already exists`);
    }
    return this.categories.create({ name: trimmed, icon });
  }

  /**
   * Delete a category. Expenses are reassigned to 'Other'; per-category
   * budgets lose their category (become overall). 'Other' itself is
   * protected — it is the reassignment target.
   */
  async delete(id: number): Promise<void> {
    const all = await this.categories.list();
    const target = all.find((c) => c.id === id);
    if (!target) return; // already gone — idempotent
    const fallback = all.find((c) => c.name.toLowerCase() === 'other');
    if (!fallback) {
      throw new Error("The built-in 'Other' category is missing — can't delete categories");
    }
    if (target.id === fallback.id) {
      throw new Error(CANNOT_DELETE_OTHER_MESSAGE);
    }
    await this.categories.removeWithReassign(id, fallback.id);
  }
}