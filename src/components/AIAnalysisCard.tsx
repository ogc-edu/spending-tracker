/**
 * AIAnalysisCard — the SHARED result surface for every contextual AI action
 * (plans 013–015 / PRD AI-2, AI-4).
 *
 * Three states, all non-blocking:
 *  - pending: a request is in flight (ActivityIndicator + caption);
 *  - typed error: an `AIUnavailableError` rendered inline with a Retry action
 *    (reason → fixed user-facing label, never raw provider text — AI-6);
 *  - result: a Zod-validated `AIResult` (summary + ≤5 points).
 *
 * Renders nothing when idle (no pending/error/result) so callers can mount it
 * unconditionally. REPOSITORY OWNER: plan 014 (the Analytics screen wires it);
 * plan 015 imports the same contract. The props ARE the shared contract:
 * `AIAnalysisState` (pending/error/result/onRetry) + an optional `label`
 * (the caller's context header, e.g. the analyzed month — so a stale result
 * is never ambiguous).
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AIErrorReason, AIResult } from '@/ai/types';
import { AIUnavailableError } from '@/ai/errors';
import { colors, spacing, typography } from '@/theme';

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

/** Label for a typed error: fixed per reason; `unknown` may carry context (e.g. "No AI provider configured"). */
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
 * Shared analysis card. Returns null when idle. `label` is an optional small
 * header (plan 014: the analyzed month, so a stale result is never ambiguous).
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
    <View style={styles.card} testID="ai-analysis-card">
      {label ? (
        <Text style={styles.label} testID="ai-analysis-label">
          {label}
        </Text>
      ) : null}

      {pending ? (
        <View style={styles.pendingRow} testID="ai-analysis-pending">
          <ActivityIndicator color={colors.muted} />
          <Text style={styles.pendingText}>Analyzing…</Text>
        </View>
      ) : null}

      {error ? (
        <View testID="ai-analysis-error">
          <Text style={styles.errorText} testID="ai-analysis-error-message">
            {errorMessage(error)}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry the analysis"
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            testID="ai-analysis-retry"
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!pending && !error && result ? (
        <View testID="ai-analysis-result">
          <Text style={styles.summary} testID="ai-analysis-summary">
            {result.summary}
          </Text>
          {result.points.map((point, index) => (
            <View key={index} style={styles.pointRow} testID={`ai-analysis-point-${index}`}>
              <View style={styles.pointDot} />
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.sm },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pendingText: { fontSize: typography.body, color: colors.muted },
  errorText: { fontSize: typography.body, color: colors.danger, lineHeight: 21 },
  retryButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.7 },
  retryLabel: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  summary: { fontSize: typography.body, color: colors.text, lineHeight: 21, fontWeight: '500' },
  pointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 7,
  },
  pointText: { flex: 1, fontSize: typography.body, color: colors.muted, lineHeight: 21 },
});