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
  | 'modelUnavailable'
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
  /** Display label for the analyzed month, e.g. "September 2026" (plan 014). */
  monthLabel: string;
  totalSen: number;
  previousTotalSen: number;
  changeSen: number;
  changePct: number | null;
  avgDailySen: number;
  /** End-of-month projection, floored sen (AN-3) — pace context (plan 014). */
  projectionSen: number;
  /** Budget pressure: null = no OVERALL budget set for the month (plan 014). */
  utilization: { pct: number | null; overBudget: boolean } | null;
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
  /**
   * Whether an overall budget is set (plan 015). `false` when the UI shows
   * "—" for the remaining budget — the AI must never invent one. Present on
   * every allowance payload, so a missing flag is a shape error, not a gap.
   */
  hasBudget: boolean;
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
  /**
   * The credential to authenticate with (BYOK / AI-6). Held transiently in the
   * request object only — never logged, committed, or included in errors.
   */
  key: string;
  /**
   * The selected model id (plan 013 — discovery or manual entry). Optional in
   * the transport so the fake provider (and 012-era callers) stay simple; the
   * real providers reject its absence at generate time.
   */
  modelId?: string;
}

/* ------------------------------------------------------------------ *
 * Plan 013 — provider-configuration capability types (PRD AI-5/AI-7/AI-8)
 * ------------------------------------------------------------------ */

/** Distinct Test Connection outcomes (AI-7) — never the raw credential. */
export type TestResultReason =
  | 'invalidKey'
  | 'quota'
  | 'modelUnavailable'
  | 'network'
  | 'unknown';

/** `testConnection` result: ok, or a UI-able failure reason. */
export type TestResult = { ok: true } | { ok: false; reason: TestResultReason };

/** One discovered model (AI-8). `label` is optional — the UI shows id otherwise. */
export interface ModelInfo {
  id: string;
  label?: string;
}

/* ------------------------------------------------------------------ *
 * Plan 013 — Test Connection UX: live progress + cancellation (Stop).
 * ------------------------------------------------------------------ */

/** One live step of a running Test Connection, rendered by the config UI. */
export type TestStep =
  | { phase: 'discovering' }
  | { phase: 'testing'; modelId: string }
  | { phase: 'unavailable'; modelId: string };

/** Options for `AIProvider.testConnection` (and the facade passthrough). */
export interface TestOptions {
  /**
   * Abort the in-flight test. The provider rejects with RequestCancelledError
   * (never a TestResult) so the UI can distinguish Stop from a real failure.
   */
  signal?: AbortSignal;
  /** Live progress — called once per attempted model / discovery phase. */
  onStep?: (step: TestStep) => void;
}

/**
 * Implemented by every provider. The facade dispatches to the ACTIVE provider
 * only. Providers own their credentials (BYOK, plan 013); keys never touch the
 * AIService layer.
 *
 * Plan 013 extends the 012 interface: `testConnection` now RETURNS a TestResult
 * (ok / distinguishable failure) instead of throwing, and `listModels` returns
 * ModelInfo list entries — the capabilities the Settings config UI drives.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  /**
   * Minimal real request (AI-7): the first discovered suitable model. Returns
   * a typed TestResult rather than throwing — the config UI renders it inline.
   * Options add live progress (which model is being tested / skipped) and
   * cancellation (rejects with RequestCancelledError on abort).
   */
  testConnection(key: string, options?: TestOptions): Promise<TestResult>;
  /**
   * Official listing filtered to text-generation models suitable for financial
   * analysis (AI-8); no hardcoded model lists anywhere. Throws a typed
   * AIUnavailableError on failure (the UI falls back to manual model entry).
   */
  listModels(key: string): Promise<ModelInfo[]>;
  /** Return the RAW JSON text; the facade parses + Zod-validates it. */
  analyze(request: AIAnalyzeRequest): Promise<string>;
}
