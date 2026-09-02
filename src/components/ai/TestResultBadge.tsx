/**
 * Plan 013 — TestResultBadge: the inline Test Connection outcome (AI-7).
 * Distinct, user-addressable failure labels per reason — never the raw
 * credential and never raw error text from the provider.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { TestResult, TestResultReason } from '@/ai/types';

export const TEST_RESULT_LABELS: Record<TestResultReason, string> = {
  invalidKey: 'Invalid API key — check it and try again',
  quota: 'Quota or rate limit reached — try again later',
  modelUnavailable: 'Model unavailable — pick another model',
  network: 'Network error — check your connection',
  unknown: 'Unexpected error — try again',
};

export function TestResultBadge({
  result,
  providerLabel,
}: {
  result: TestResult | null;
  providerLabel: string;
}) {
  if (!result) return null;

  if (result.ok) {
    return (
      <View style={[styles.badge, styles.ok]} testID="ai-test-result-ok">
        <Text style={styles.okText}>✓ {providerLabel} connection successful</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.badge, styles.fail]}
      testID={`ai-test-result-${result.reason}`}
    >
      <Text style={styles.failText}>✕ {TEST_RESULT_LABELS[result.reason]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  ok: { backgroundColor: colors.accentSoft },
  okText: { color: colors.accent, fontSize: typography.body, fontWeight: '600' },
  fail: { backgroundColor: colors.dangerSoft },
  failText: { color: colors.danger, fontSize: typography.body, fontWeight: '600' },
});