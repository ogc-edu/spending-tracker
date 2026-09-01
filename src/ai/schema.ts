/**
 * Plan 012 — Zod schemas: the validation boundary for AI input/output.
 *
 * AIResultSchema validates provider output before any UI renders it; a
 * malformed response becomes an `invalidResponse` error, never a crash.
 * The per-context snapshot schemas mirror exactly what the application
 * services produce (and therefore what the facade accepts).
 */
import { z } from 'zod';
import { MAX_POINTS, MAX_SUMMARY_CHARS, type AIContext } from './types';

/* ------------------------------------------------------------------ *
 * AI output
 * ------------------------------------------------------------------ */

/** Validated provider output — the ONLY thing the UI renders. */
export const AIResultSchema = z.object({
  summary: z.string().max(MAX_SUMMARY_CHARS),
  points: z.array(z.string()).max(MAX_POINTS),
});

export type AIResultOutput = z.infer<typeof AIResultSchema>;

/* ------------------------------------------------------------------ *
 * Snapshots (money = integer sen; dates = plain strings)
 * ------------------------------------------------------------------ */

const sen = z.number().int();
const optionalSen = z.number().int().optional();
const optionalDate = z.string().optional();

export const DebtSnapshotSchema = z.object({
  commitments: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['monthly', 'one_time']),
      remainingSen: sen,
      nextDue: optionalDate,
      paidCount: optionalSen,
      totalCount: optionalSen,
    }),
  ),
  upcomingBeforeNextMonthSen: sen,
  overdueSen: sen,
  totalRemainingSen: sen,
});

export const SpendingSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalSen: sen,
  previousTotalSen: sen,
  changeSen: sen,
  changePct: z.number().nullable(),
  avgDailySen: sen,
  topCategories: z.array(z.object({ name: z.string(), amountSen: sen })),
  // Category-level only — no free-text descriptions (A6).
  largest: z.array(z.object({ name: z.string(), amountSen: sen })).optional(),
});

export const AllowanceSnapshotSchema = z.object({
  availableSen: sen,
  upcomingSen: sen,
  remainingBudgetSen: sen,
  bufferSen: sen,
  safeSen: sen,
  dailyAllowanceSen: sen,
  daysRemaining: z.number().int(),
});

/** Snapshot schema for each context. */
export const AIContextSnapshotSchema: Record<AIContext, z.ZodType> = {
  debt: DebtSnapshotSchema,
  spending: SpendingSnapshotSchema,
  allowance: AllowanceSnapshotSchema,
};

export function getSnapshotSchema(context: AIContext): z.ZodType {
  return AIContextSnapshotSchema[context];
}
