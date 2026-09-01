/**
 * Plan 004 — Zod account form schema (the single source of form validation).
 * Rejects 3-decimal amounts, malformed decimals, negatives, empty names, unknown
 * account types, and empty balances. Accepts valid inputs incl. "0" (valid default).
 */
import { describe, expect, it } from '@jest/globals';
import { accountFormSchema } from '../AccountForm';

describe('accountFormSchema', () => {
  it('accepts a valid account', () => {
    const r = accountFormSchema.safeParse({
      name: 'Maybank',
      type: 'bank',
      initialBalance: '120.50',
    });
    expect(r.success).toBe(true);
  });

  it('accepts a zero initial balance (valid default, prefill "0")', () => {
    const r = accountFormSchema.safeParse({ name: 'Wallet', type: 'cash', initialBalance: '0' });
    expect(r.success).toBe(true);
  });

  it('accepts all four account types', () => {
    for (const type of ['cash', 'bank', 'ewallet', 'credit_card']) {
      expect(accountFormSchema.safeParse({ name: 'X', type, initialBalance: '1' }).success).toBe(true);
    }
  });

  it('rejects >2 decimal places', () => {
    const r = accountFormSchema.safeParse({ name: 'X', type: 'cash', initialBalance: '12.345' });
    expect(r.success).toBe(false);
  });

  it('rejects malformed decimal forms ("12.", ".", "1.2.3")', () => {
    for (const bad of ['12.', '.', '1.2.3']) {
      expect(accountFormSchema.safeParse({ name: 'X', type: 'cash', initialBalance: bad }).success).toBe(false);
    }
  });

  it('rejects negative amounts', () => {
    const r = accountFormSchema.safeParse({ name: 'X', type: 'cash', initialBalance: '-5' });
    expect(r.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const r = accountFormSchema.safeParse({ name: '   ', type: 'cash', initialBalance: '1' });
    expect(r.success).toBe(false);
  });

  it('rejects an unknown account type', () => {
    const r = accountFormSchema.safeParse({ name: 'X', type: 'checking', initialBalance: '1' });
    expect(r.success).toBe(false);
  });

  it('rejects an empty / non-numeric balance', () => {
    expect(accountFormSchema.safeParse({ name: 'X', type: 'cash', initialBalance: '' }).success).toBe(false);
    expect(accountFormSchema.safeParse({ name: 'X', type: 'cash', initialBalance: 'abc' }).success).toBe(false);
  });
});