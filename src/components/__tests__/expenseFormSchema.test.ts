/**
 * Plan 005 — expense FORM schema + edit-screen mapping. Schema tests mirror
 * plan 004's accountFormSchema test: safeParse without mounting the
 * component. Covered: 0/negative/3-decimal amounts, missing pickers, bad
 * dates, oversize description, sen-parseable strings accepted. The mapping
 * test pins the E7 read-only flag (linked expense) and the amount
 * round-trip (12050 → "120.50").
 */
import { describe, expect, it } from '@jest/globals';
import type { Expense } from '@/db/schema';
import { expenseFormSchema, expenseToFormValues } from '@/components/ExpenseForm';

const validValues = {
  amount: '12.50',
  categoryId: 1,
  accountId: 1,
  date: '2026-09-05',
  description: 'lunch',
};

describe('expenseFormSchema — amount', () => {
  it('accepts sen-parseable strings ("12.5", "12.50", "0.01")', () => {
    expect(expenseFormSchema.safeParse({ ...validValues, amount: '12.5' }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...validValues, amount: '12.50' }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...validValues, amount: '0.01' }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...validValues, amount: '120' }).success).toBe(true);
  });

  it('rejects zero, negative and >2-decimal amounts', () => {
    for (const amount of ['0', '0.00', '-5', '12.345', '12.', '.', '', '1,900']) {
      expect(expenseFormSchema.safeParse({ ...validValues, amount }).success).toBe(false);
    }
  });

  it('zero/negative surface the "greater than 0" message', () => {
    const zero = expenseFormSchema.safeParse({ ...validValues, amount: '0' });
    expect(zero.success).toBe(false);
    if (!zero.success) {
      expect(zero.error.issues.some((i) => i.message === 'Amount must be greater than 0')).toBe(true);
    }
  });
});

describe('expenseFormSchema — pickers, date, description', () => {
  it('requires a category and an account (empty pickers rejected)', () => {
    const noCategory = expenseFormSchema.safeParse({ ...validValues, categoryId: undefined });
    expect(noCategory.success).toBe(false);
    const noAccount = expenseFormSchema.safeParse({ ...validValues, accountId: undefined });
    expect(noAccount.success).toBe(false);
    const zeroCategory = expenseFormSchema.safeParse({ ...validValues, categoryId: 0 });
    expect(zeroCategory.success).toBe(false);
  });

  it('rejects malformed and impossible dates', () => {
    for (const date of ['2026-13-01', '2026-02-30', '2026-9-1', '20260905', '']) {
      expect(expenseFormSchema.safeParse({ ...validValues, date }).success).toBe(false);
    }
  });

  it('caps the description at 200 characters; empty is fine', () => {
    expect(expenseFormSchema.safeParse({ ...validValues, description: 'x'.repeat(201) }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...validValues, description: 'x'.repeat(200) }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...validValues, description: '' }).success).toBe(true);
  });
});

describe('expenseToFormValues — edit-screen row → form mapping', () => {
  const base: Expense = {
    id: 7,
    userId: 1,
    amountSen: 12050,
    categoryId: 2,
    description: 'grab',
    date: '2026-09-05',
    accountId: 3,
    commitmentPaymentId: null,
    createdAt: 0,
    updatedAt: 0,
  };

  it('maps an editable expense: amount round-trips as an input string, readOnly false', () => {
    const mapped = expenseToFormValues(base);
    expect(mapped.readOnly).toBe(false);
    expect(mapped.values.amount).toBe('120.50'); // formatSenInput round-trip
    expect(mapped.values.categoryId).toBe(2);
    expect(mapped.values.accountId).toBe(3);
    expect(mapped.values.date).toBe('2026-09-05');
    expect(mapped.values.description).toBe('grab');
  });

  it('flags auto-created (linked) expenses as read-only for the UI (E7)', () => {
    const linked = expenseToFormValues({ ...base, commitmentPaymentId: 42 });
    expect(linked.readOnly).toBe(true);
  });
});