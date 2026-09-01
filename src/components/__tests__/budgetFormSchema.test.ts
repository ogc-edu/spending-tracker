/**
 * Plan 007 — Zod budget form schema (the single source of form validation).
 * Rejects 3-decimal amounts, malformed decimals, negatives, and any string
 * that parses to 0 sen (a budget must be > 0 — the service boundary enforces
 * the same rule on the parsed integer). Accepts whole ringgit and ≤2-decimal
 * sen amounts.
 */
import { describe, expect, it } from '@jest/globals';
import { budgetFormSchema } from '../BudgetForm';

describe('budgetFormSchema', () => {
  it('accepts whole ringgit and ≤2-decimal amounts', () => {
    for (const ok of ['100', '120.50', '0.50', '1000', '99.99', '1']) {
      expect(budgetFormSchema.safeParse({ amount: ok }).success).toBe(true);
    }
  });

  it('accepts a zero-prefixed edit prefill (formatSenInput output)', () => {
    // formatSenInput(12050) → "120.50"; formatSenInput(5) → "0.05" round-trips.
    expect(budgetFormSchema.safeParse({ amount: '0.05' }).success).toBe(true);
  });

  it('rejects 0 and 0.00 (budgets must be greater than 0 sen)', () => {
    for (const bad of ['0', '0.00', '0.0']) {
      expect(budgetFormSchema.safeParse({ amount: bad }).success).toBe(false);
    }
  });

  it('rejects >2 decimal places', () => {
    expect(budgetFormSchema.safeParse({ amount: '12.345' }).success).toBe(false);
  });

  it('rejects malformed decimal forms ("12.", ".", "1.2.3")', () => {
    for (const bad of ['12.', '.', '1.2.3']) {
      expect(budgetFormSchema.safeParse({ amount: bad }).success).toBe(false);
    }
  });

  it('rejects negative amounts and non-numeric input', () => {
    for (const bad of ['-5', '-0.50', '', 'abc', '1,000', '12 dollars']) {
      expect(budgetFormSchema.safeParse({ amount: bad }).success).toBe(false);
    }
  });
});