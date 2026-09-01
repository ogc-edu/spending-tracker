/**
 * BudgetService (plan 007 / ARCHITECTURE §2 application services) — business
 * rules for monthly + category budgets: upsert (REPLACE per month+category),
 * clear, and month reads shaped for the Budgets UI. User-scoping comes from
 * the current user resolved via the injected auth handle (AuthService).
 *
 * Constraint discipline matches the other services: no SQL, no money math
 * beyond validation here — metrics are produced by the pure engine
 * (src/engine/budgets.ts budgetMetrics) from service-fetched rows, never
 * computed in the UI. Validation happens TWICE by design (form schema rejects
 * bad strings first; this boundary re-validates the parsed input — never
 * trust the caller). Amounts are sen, positive; month 1–12; year an integer;
 * categoryId null (overall) or a real category id.
 *
 * Category budgets are informational (BUD-3) — only the overall budget feeds
 * cash flow (PRD §8.4), so nothing here plumbs category rows into any
 * financial formula. Editing/clearing past months is allowed (no
 * retroactive restrictions — plan §Requirements).
 */
import { z } from 'zod';
import type { Budget } from '@/db/schema';
import type {
  BudgetInput,
  BudgetKey,
  BudgetRepository,
  CategoryRepository,
} from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

/** Row identity validation — shared by upsert and clear. */
export const budgetKeySchema = z.object({
  categoryId: z
    .number({ error: 'Category required' })
    .int()
    .nullable()
    .refine((v) => v === null || v > 0, 'Category required'),
  month: z.number({ error: 'Month required' }).int().min(1, 'Invalid month').max(12, 'Invalid month'),
  year: z.number({ error: 'Year required' }).int(),
});

/** Service-boundary validation (sen already parsed by the form) — amounts > 0. */
export const budgetInputSchema = budgetKeySchema.extend({
  amountSen: z
    .number({ error: 'Amount required' })
    .int('Amount must be whole sen')
    .positive('Amount must be greater than 0'),
});

export type ValidatedBudgetInput = z.infer<typeof budgetInputSchema>;
export type ValidatedBudgetKey = z.infer<typeof budgetKeySchema>;

function parseInput(input: BudgetInput): ValidatedBudgetInput {
  const result = budgetInputSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? 'invalid budget input');
  }
  return result.data;
}

function parseKey(key: BudgetKey): ValidatedBudgetKey {
  const result = budgetKeySchema.safeParse(key);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? 'invalid budget key');
  }
  return result.data;
}

function assertMonthYear(month: number, year: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('invalid month');
  if (!Number.isInteger(year)) throw new Error('invalid year');
}

/** Month view for the Budgets UI: the overall row + one row per category. */
export interface BudgetMonthView {
  overall: Budget | null;
  /** Category id → budget row. Absent = "no budget" ("—" in the UI). */
  byCategory: Map<number, Budget>;
}

export class BudgetService {
  constructor(
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryRepository,
    private readonly auth: CurrentUserSource,
  ) {}

  /** Resolve the signed-in user; reject if none (gate enforced upstream, defended here). */
  private async requireUserId(): Promise<number> {
    const user = await this.auth.currentUser();
    if (!user) throw new Error('not signed in');
    return user.id;
  }

  /**
   * Set or REPLACE the budget for (categoryId, month, year) — categoryId null
   * is the overall monthly budget (BUD-1). A category budget must reference a
   * real category (stale picker ids → friendly error; the FK stays the
   * backstop).
   */
  async upsert(input: BudgetInput): Promise<Budget> {
    const userId = await this.requireUserId();
    const data = parseInput(input);
    if (data.categoryId !== null) {
      const category = await this.categories.byId(data.categoryId);
      if (!category) throw new Error('unknown category');
    }
    return this.budgets.upsert(userId, data);
  }

  /** DELETE the budget row for (categoryId, month, year) — clearing is removal. */
  async clear(key: BudgetKey): Promise<void> {
    const userId = await this.requireUserId();
    return this.budgets.clear(userId, parseKey(key));
  }

  /** The month's overall budget, or null — the ONLY budget that feeds cash flow (PRD §8.4). */
  async overallFor(month: number, year: number): Promise<Budget | null> {
    const userId = await this.requireUserId();
    assertMonthYear(month, year);
    return this.budgets.overallFor(userId, month, year);
  }

  /**
   * The month's full budget view: overall + per-category rows, independent of
   * each other (either can exist alone). Other months never leak in.
   */
  async forMonthWithCategories(month: number, year: number): Promise<BudgetMonthView> {
    const userId = await this.requireUserId();
    assertMonthYear(month, year);
    const rows = await this.budgets.forMonth(userId, month, year);
    const byCategory = new Map<number, Budget>();
    let overall: Budget | null = null;
    for (const row of rows) {
      if (row.categoryId === null) overall = row;
      else byCategory.set(row.categoryId, row);
    }
    return { overall, byCategory };
  }
}