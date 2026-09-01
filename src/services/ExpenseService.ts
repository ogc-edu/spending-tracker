/**
 * ExpenseService (plan 005 / ARCHITECTURE §2, §10) — business rules for the
 * manual-expense loop: add/edit/delete with DETERMINISTIC account-balance
 * auto-adjustment (D1/ACC-2) inside one SQLite transaction per write, and
 * month-scoped reads. Editing updates the same row — never a duplicate —
 * and produces exactly the balances a single corrected record would (PRD
 * note 6). E7: linked expenses (commitment_payment_id set) are read-only here.
 *
 * Balance sign convention (plan 005 §Technical Design): asset accounts
 * (cash/bank/ewallet) lose `amountSen` on purchase; a credit card's stored
 * balance is the amount OWED (positive), so a purchase INCREASES it. The
 * service computes the signed delta (via balanceEffectFor) and the repository
 * applies it. Balance is never directly editable (ACC-4) — only via expenses.
 *
 * Outline:
 *   create  → txn { insert expense; adjustBalance(account, effect) }
 *   edit    → txn { read old; if account changed: reverse old account, apply new;
 *                   update row (same id) }
 *   delete  → txn { read row; reverse effect; delete row }
 *
 * Validation happens TWICE by design: the form schema (components/ExpenseForm)
 * rejects bad strings before they become sen; this service's Zod boundary
 * re-validates the parsed input — never trust the form (plan §Security).
 */
import { z } from 'zod';
import type { Account, Category, Expense } from '@/db/schema';
import { DATE_RE, isValidDateStr } from '@/utils/dates';
import {
  EXPENSE_LINKED_READ_ONLY_MESSAGE,
  type CategoryRepository,
  type ExpenseInput,
  type ExpenseRepository,
} from '@/repositories/types';
import type { CurrentUserSource } from './AccountService';

/** Service-boundary validation (sen already parsed). Rejects 0/negative/non-integer amounts, bad dates, oversize descriptions. */
export const expenseInputSchema = z.object({
  amountSen: z.number({ error: 'Amount required' }).int('Amount must be whole sen').positive('Amount must be greater than 0'),
  categoryId: z.number({ error: 'Category required' }).int().positive('Choose a category'),
  accountId: z.number({ error: 'Account required' }).int().positive('Choose an account'),
  date: z
    .string({ error: 'Date required' })
    .regex(DATE_RE, 'Date must be YYYY-MM-DD')
    .refine(isValidDateStr, 'Enter a real date'),
  description: z
    .string()
    .trim()
    .max(200, 'Description must be 200 characters or fewer')
    .optional()
    .default(''),
});

export type ValidatedExpenseInput = z.infer<typeof expenseInputSchema>;

function parseInput(input: ExpenseInput): ValidatedExpenseInput {
  const result = expenseInputSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(issue?.message ?? 'invalid expense input');
  }
  return result.data;
}

/**
 * The balance effect of an expense on its account (plan 005 sign convention):
 * asset accounts −amount, credit card +amount (owed increases).
 * Exported for the form's projected-balance preview — the single source of
 * the convention, shared by the service and the UI.
 */
export function balanceEffectFor(account: Pick<Account, 'type'>, amountSen: number): number {
  return account.type === 'credit_card' ? +amountSen : -amountSen;
}

export class ExpenseService {
  constructor(
    private readonly expenses: ExpenseRepository,
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
   * Record an expense and adjust the owning account in ONE transaction.
   * Category/account must exist (stale picker ids → friendly errors); unknown
   * refs would otherwise surface as raw FK errors. Never accepts a
   * commitmentPaymentId — linked expenses are created only by plan 008.
   */
  async create(input: ExpenseInput): Promise<Expense> {
    const userId = await this.requireUserId();
    const data = parseInput(input);
    return this.expenses.transaction((tx) => {
      this.requireCategory(tx.getCategory(data.categoryId));
      const account = this.requireAccount(tx.getAccount(userId, data.accountId));
      const expense = tx.insert({
        userId,
        amountSen: data.amountSen,
        categoryId: data.categoryId,
        accountId: data.accountId,
        date: data.date,
        description: data.description,
      });
      tx.adjustBalance(userId, account.id, balanceEffectFor(account, data.amountSen));
      return expense;
    });
  }

  /**
   * Edit the SAME row (never a duplicate, EXP-2). Balance math: reverse the
   * old expense's effect on its account, apply the new one — handles
   * amount-only changes (net delta), account moves (both sides), and
   * credit-card sign flips in one code path. Linked expenses: blocked (E7).
   */
  async edit(id: number, input: ExpenseInput): Promise<Expense> {
    const userId = await this.requireUserId();
    const data = parseInput(input);
    return this.expenses.transaction((tx) => {
      const old = tx.getById(userId, id);
      if (!old) throw new Error('expense not found');
      this.assertEditable(old);
      this.requireCategory(tx.getCategory(data.categoryId));
      const newAccount = this.requireAccount(tx.getAccount(userId, data.accountId));
      if (old.accountId !== null) {
        const oldAccount = tx.getAccount(userId, old.accountId);
        if (oldAccount) {
          tx.adjustBalance(userId, oldAccount.id, -balanceEffectFor(oldAccount, old.amountSen));
        }
      }
      tx.adjustBalance(userId, newAccount.id, balanceEffectFor(newAccount, data.amountSen));
      return tx.update(userId, id, {
        amountSen: data.amountSen,
        categoryId: data.categoryId,
        accountId: data.accountId,
        date: data.date,
        description: data.description,
      });
    });
  }

  /** Delete the row and reverse its balance effect (EXP-3) in one transaction. Linked: blocked (E7). */
  async delete(id: number): Promise<void> {
    const userId = await this.requireUserId();
    return this.expenses.transaction((tx) => {
      const old = tx.getById(userId, id);
      if (!old) throw new Error('expense not found');
      this.assertEditable(old);
      if (old.accountId !== null) {
        const account = tx.getAccount(userId, old.accountId);
        if (account) {
          tx.adjustBalance(userId, account.id, -balanceEffectFor(account, old.amountSen));
        }
      }
      tx.remove(userId, id);
    });
  }

  async byId(id: number): Promise<Expense | null> {
    return this.expenses.byId(await this.requireUserId(), id);
  }

  /** Expenses of the current LOCAL calendar month, newest first (listForMonth). */
  async listForMonth(year: number, month: number): Promise<Expense[]> {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('invalid month');
    }
    return this.expenses.listForMonth(await this.requireUserId(), year, month);
  }

  /** Map stale/unknown ids to friendly messages (plan §Edge cases); FK stays the backstop. */
  private requireCategory(category: Category | null): Category {
    if (!category) throw new Error('unknown category');
    return category;
  }

  private requireAccount(account: Account | null): Account {
    if (!account) throw new Error('unknown account');
    return account;
  }

  /** E7: a linked (auto-created) expense is read-only in the expense UI and service. */
  private assertEditable(expense: Expense): void {
    if (expense.commitmentPaymentId !== null) {
      throw new Error(EXPENSE_LINKED_READ_ONLY_MESSAGE);
    }
  }
}