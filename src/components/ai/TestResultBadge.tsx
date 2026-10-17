/**
 * Plan 013 — TestResultBadge: the inline Test Connection outcome (AI-7).
 * Distinct, user-addressable failure labels per reason — never the raw
 * credential and never raw error text from the provider.
 */
import { StyleSheet, Text, View } from 'react-native';
import { geistWeights, useTheme } from '@/theme';
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
  const { colors } = useTheme();

  if (!result) return null;

  if (result.ok) {
    return (
      <View
        style={[
          styles.badge,
          {
            backgroundColor: colors.fillStrong,
            borderColor: colors.accent,
          },
        ]}
        testID="ai-test-result-ok"
      >
        <Text
          numberOfLines={1}
          style={[styles.text, { color: colors.accent }]}
        >
          ✓ {providerLabel} connection successful
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.fillStrong,
          borderColor: colors.danger,
        },
      ]}
      testID={`ai-test-result-${result.reason}`}
    >
      <Text
        numberOfLines={1}
        style={[styles.text, { color: colors.danger }]}
      >
        ✕ {TEST_RESULT_LABELS[result.reason]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
});