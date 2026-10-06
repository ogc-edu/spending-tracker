/**
 * AIAnalysisCard — SHARED result surface for every contextual AI action
 * (plans 013–015 / PRD AI-2, AI-4).
 *
 * Three states, all non-blocking:
 *  - pending: a request is in flight (ActivityIndicator + caption);
 *  - typed error: an AIUnavailableError rendered inline with a Retry action;
 *  - result: a Zod-validated AIResult (summary + points).
 *
 * Renders nothing when idle so callers can mount it unconditionally.
 * Preserves test contracts:
 *  - testID="ai-analysis-card"
 *  - testID="ai-analysis-label"
 *  - testID="ai-analysis-pending"
 *  - testID="ai-analysis-error"
 *  - testID="ai-analysis-error-message"
 *  - testID="ai-analysis-retry"
 *  - testID="ai-analysis-result"
 *  - testID="ai-analysis-summary"
 *  - testID="ai-analysis-point-{index}"
 */
import { ActivityIndicator, Text, View } from 'react-native';
import type { AIErrorReason, AIResult } from '@/ai/types';
import { AIUnavailableError } from '@/ai/errors';
import { TouchTarget } from '@/components/ui/TouchTarget';

/** Fixed user-facing message per typed failure reason — never raw provider text. */
export const AI_ERROR_LABELS: Record<AIErrorReason, string> = {
  offline: "You're offline — check your connection and try again.",
  timeout: 'The request timed out — please retry.',
  http: 'The provider returned an error — please retry.',
  invalidKey: 'The API key was rejected — check it in Settings.',
  modelUnavailable: 'The selected model is unavailable — pick another in Settings.',
  invalidResponse: 'The AI returned an unexpected response — please retry.',
  unknown: 'Something went wrong — please retry.',
};

/** Label for a typed error: fixed per reason; `unknown` may carry context. */
function errorMessage(error: AIUnavailableError): string {
  if (error.reason === 'unknown' && error.message) return error.message;
  return AI_ERROR_LABELS[error.reason];
}

/** One analysis action's UI state — owned by the caller, driven by AIService. */
export interface AIAnalysisState {
  /** A request is in flight; callers must ignore further taps while true. */
  pending: boolean;
  /** Typed failure (AI-4) — rendered inline with Retry, nothing else blocks. */
  error: AIUnavailableError | null;
  /** Validated provider output (summary + points) — presentation only. */
  result: AIResult | null;
  /** Re-run the analysis (clears the error, starts a fresh request). */
  onRetry(): void;
}

/**
 * Shared analysis card. Returns null when idle.
 * `label` is an optional small header (e.g. the analyzed month).
 */
export function AIAnalysisCard({
  pending,
  error,
  result,
  onRetry,
  label = null,
}: AIAnalysisState & { label?: string | null }) {
  if (!pending && !error && !result) return null;

  return (
    <View className="mt-3 pt-3 border-t border-border/60" testID="ai-analysis-card">
      {label ? (
        <Text className="text-xs text-muted-foreground mb-2 font-medium" testID="ai-analysis-label">
          {label}
        </Text>
      ) : null}

      {pending ? (
        <View className="flex-row items-center gap-2 py-1" testID="ai-analysis-pending">
          <ActivityIndicator color="#06b6d4" />
          <Text className="text-sm text-muted-foreground font-medium">Analyzing…</Text>
        </View>
      ) : null}

      {error ? (
        <View testID="ai-analysis-error">
          <Text className="text-sm text-destructive leading-5 font-medium" testID="ai-analysis-error-message">
            {errorMessage(error)}
          </Text>
          <TouchTarget
            minHeight={44}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry the analysis"
            className="self-start mt-2 border border-border/80 rounded-xl px-4 justify-center items-center active:opacity-70 bg-card"
            testID="ai-analysis-retry"
          >
            <Text className="text-sm font-semibold text-foreground">Retry</Text>
          </TouchTarget>
        </View>
      ) : null}

      {!pending && !error && result ? (
        <View testID="ai-analysis-result">
          <Text className="text-sm text-foreground font-semibold leading-5 mb-2" testID="ai-analysis-summary">
            {result.summary}
          </Text>
          {result.points.map((point, index) => (
            <View key={index} className="flex-row items-start gap-2.5 mt-2" testID={`ai-analysis-point-${index}`}>
              <View className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2" />
              <Text className="flex-1 text-sm text-muted-foreground leading-5">{point}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}