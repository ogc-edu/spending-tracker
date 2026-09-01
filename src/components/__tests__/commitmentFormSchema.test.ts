/**
 * Plan 008 — Zod commitment form schema (the single source of form
 * validation). Shape matrix per kind: fixed needs total + start (+ optional
 * end); ongoing needs payment + start; one-time needs payment + due date.
 * Money strings: whole ringgit / ≤2 decimals, > 0 sen. Dates real YYYY-MM-DD,
 * end ≥ start.
 */
import { describe, expect, it } from '@jest/globals';
import { commitmentFormSchema } from '../CommitmentForm';

const base = {
  name: 'Phone installment',
  type: 'installment',
  kind: 'fixed',
  total: '1200.00',
  payment: '400.00',
  startDate: '2026-09-01',
  endDate: '',
  dueDate: '',
} as const;

describe('commitmentFormSchema', () => {
  it('accepts a valid fixed installment (total + payment + start + optional end)', () => {
    expect(commitmentFormSchema.safeParse(base).success).toBe(true);
    expect(commitmentFormSchema.safeParse({ ...base, endDate: '2026-11-01' }).success).toBe(true);
  });

  it('accepts an ongoing monthly (payment + start; total/end unused)', () => {
    expect(
      commitmentFormSchema.safeParse({ ...base, kind: 'ongoing', total: '' }).success,
    ).toBe(true);
  });

  it('accepts a one-time (payment + due date; total/start unused)', () => {
    const parsed = commitmentFormSchema.safeParse({
      ...base,
      kind: 'one_time',
      total: '',
      startDate: '',
      dueDate: '2026-09-30',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty/whitespace names and >100-char names', () => {
    expect(commitmentFormSchema.safeParse({ ...base, name: '' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('rejects unknown type/kind values', () => {
    expect(commitmentFormSchema.safeParse({ ...base, type: 'mystery' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, kind: 'weekly' }).success).toBe(false);
  });

  it('rejects bad money: fixed missing total, zero/3-decimal payment, malformed decimals', () => {
    expect(commitmentFormSchema.safeParse({ ...base, total: '' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, payment: '0.00' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, payment: '12.345' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, payment: '12.' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, payment: '-5' }).success).toBe(false);
  });

  it('rejects bad dates: missing start (fixed/ongoing), impossible dates, inverted end', () => {
    expect(commitmentFormSchema.safeParse({ ...base, startDate: '' }).success).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(false);
    expect(
      commitmentFormSchema.safeParse({ ...base, startDate: '2026-09-01', endDate: '2026-08-31' }).success,
    ).toBe(false);
    expect(commitmentFormSchema.safeParse({ ...base, endDate: 'not-a-date' }).success).toBe(false);
  });

  it('rejects a one-time without a due date and an ongoing without a start date', () => {
    expect(
      commitmentFormSchema.safeParse({ ...base, kind: 'one_time', total: '', startDate: '', dueDate: '' }).success,
    ).toBe(false);
    expect(
      commitmentFormSchema.safeParse({ ...base, kind: 'ongoing', total: '', startDate: '' }).success,
    ).toBe(false);
  });
});