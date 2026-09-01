/**
 * CategoryService (plan 004) — read-only passthrough over CategoryRepository.
 * Categories are global + seeded; no user scoping (A10). Consumed by the
 * Settings categories preview now, and by the expense/budget forms (005/007).
 */
import type { Category } from '@/db/schema';
import type { CategoryRepository } from '@/repositories/types';

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  list(): Promise<Category[]> {
    return this.categories.list();
  }

  byId(id: number): Promise<Category | null> {
    return this.categories.byId(id);
  }
}