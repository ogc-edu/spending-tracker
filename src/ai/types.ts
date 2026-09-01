/**
 * Plan 012 — AI service abstraction: shared types.
 *
 * The snapshot types below are the SOURCE OF TRUTH for what the application
 * services (008/011/010) produce and hand to AIService.analyze. They are pure
 * JSON-serializable records: no functions, no classes, no Date objects —
 * dates are plain `YYYY-MM-DD` strings, money is integer sen. Per A6,
 * SpendingSnapshot carries NO free-text expense descriptions anywhere.
 *
 * The AIProvider capability interface (PRD AI-5) lives here so every provider
 * (fake / gemini / deepseek) can implement it without importing the facade.
 */

/** Fixed set of contextual AI actions (PRD AI-2 / ARCH §9). */
export type AIContext = 'debt' | 'spending' | 'allowance';

/** Providers behind the facade (AI-5). Only `fake` is real in plan 012. */
export type AIProviderName = 'fake' | 'gemini' | 'deepseek';

/** Typed failure reasons surfaced as clear, non-blocking inline errors (AI-4). */
export type AIErrorReason =
  | 'offline'
  | 'timeout'
  | 'http'
  | 'invalidKey'
  | 'invalidResponse'
  | 'unknown';

/** Analyzer output — summary + bullet points. Presentation only, never financial state. */
export interface AIResult {
  summary: string;
  points: string[];
}

/** Capped response size to keep the UI tight (plan Decisions). */
export const MAX_SUMMARY_CHARS = 2000;
export const MAX_POINTS = 5;

/* ------------------------------------------------------------------ *
 * Debt context — produced by CommitmentService (plan 008).
 * ------------------------------------------------------------------ */

export interface DebtCommitmentItem {
  name: string;
  /** Commitment frequency, matching the engine's `frequency`. */
  type: 'monthly' | 'one_time';
  remainingSen: number;
  /** `YYYY-MM-DD` of the next due slot, if any. */
  nextDue?: string;
  /** Progress within a fixed installment plan (absent for ongoing/one-time). */
  paidCount?: number;
  totalCount?: number;
}

export interface DebtSnapshot {
  commitments: DebtCommitmentItem[];
  upcomingBeforeNextMonthSen: number;
  overdueSen: number;
  totalRemainingSen: number;
}

/* ------------------------------------------------------------------ *
 * Spending context — produced by AnalyticsService (plan 011).
 * ------------------------------------------------------------------ */

export interface TopCategory {
  /** Category name — category-level only, no free-text descriptions (A6). */
  name: string;
  amountSen: number;
}

export interface SpendingSnapshot {
  /** `YYYY-MM` of the analyzed month. */
  month: string;
  totalSen: number;
  previousTotalSen: number;
  changeSen: number;
  changePct: number | null;
  avgDailySen: number;
  topCategories: TopCategory[];
  /** Category-level "largest" breakdown — NO free-text descriptions (A6). */
  largest?: TopCategory[];
}

/* ------------------------------------------------------------------ *
 * Allowance context — produced by CashFlowService (plan 010).
 * ------------------------------------------------------------------ */

export interface AllowanceSnapshot {
  availableSen: number;
  upcomingSen: number;
  remainingBudgetSen: number;
  bufferSen: number;
  safeSen: number;
  dailyAllowanceSen: number;
  daysRemaining: number;
}

/** Snapshot associated with each context. */
export interface AIContextSnapshotMap {
  debt: DebtSnapshot;
  spending: SpendingSnapshot;
  allowance: AllowanceSnapshot;
}

/* ------------------------------------------------------------------ *
 * Provider capability interface (AI-5, ARCH §9).
 * ------------------------------------------------------------------ */

/** What a provider receives to generate one analysis. */
export interface AIAnalyzeRequest {
  context: AIContext;
  /** Fixed system instruction from the prompt registry — never user free text. */
  systemPrompt: string;
  /** Snapshot serialized as JSON — pure data, never raw rows (A6). */
  snapshot: string;
}

/**
 * Implemented by every provider. The facade dispatches to the ACTIVE provider
 * only. Providers own their credentials (BYOK, plan 013); keys never touch the
 * AIService layer.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  /** Minimal real request; throws AIUnavailableError on failure (AI-7). */
  testConnection(key: string): Promise<void>;
  /** Official listing filtered to text-generation models (AI-8); no hardcoding. */
  listModels(key: string): Promise<string[]>;
  /** Return the RAW JSON text; the facade parses + Zod-validates it. */
  analyze(request: AIAnalyzeRequest): Promise<string>;
}
