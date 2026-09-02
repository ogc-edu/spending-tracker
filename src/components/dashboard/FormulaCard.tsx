/**
 * FormulaCard (plan 010 DASH-3) — the expandable safe-to-spend formula:
 * Available − Upcoming commitments − Remaining budget − Safety buffer = Safe.
 *
 * The rows come straight from engine.cashFlowBreakdown (plan 009): signed
 * labelled terms whose sum equals the safe headline — the plan's "formula
 * card data sums back to safe" acceptance criterion. Tapping the header
 * toggles the breakdown; the arithmetic is never performed here.
 *
 * "Explain my allowance" (015 / DASH-4) sits below the card, always visible
 * while the card is; tapping it expands the breakdown and the shared
 * AIAnalysisCard (pending / typed error + Retry / validated result) renders
 * inside the expanded body.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CashFlowBreakdownItem } from '@/engine/cashflow';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { AIAnalysisCard, type AIAnalysisState } from '@/components/AIAnalysisCard';

export function FormulaCard({
  breakdown,
  safeSen,
  onExplain,
  ai,
}: {
  /** Signed labelled terms from engine.cashFlowBreakdown (Σ = safeSen). */
  breakdown: CashFlowBreakdownItem[];
  safeSen: number;
  /** "Explain my allowance" → 015: start a fresh analysis (guarded upstream). */
  onExplain(): void;
  /** The analysis UI state (015) — rendered inside the expanded card. */
  ai: AIAnalysisState;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card} testID="formula-card">
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse the formula' : 'Expand the formula'}
        accessibilityState={{ expanded }}
        style={styles.header}
        testID="formula-toggle"
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>The formula</Text>
          <Text style={styles.headerHint}>{expanded ? 'Tap to collapse' : 'Tap to see why'}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.muted}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body} testID="formula-breakdown">
          {breakdown.map((item) => (
            <View key={item.label} style={styles.row} testID={`formula-row-${item.label}`}>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text
                style={[
                  styles.rowAmount,
                  item.amountSen < 0 ? styles.minus : styles.plus,
                ]}
              >
                {formatSen(item.amountSen)}
              </Text>
            </View>
          ))}
          <View style={styles.equalsRow} testID="formula-equals">
            <Text style={styles.equalsLabel}>Safe to spend</Text>
            <Text style={styles.equalsAmount}>{formatSen(safeSen)}</Text>
          </View>

          <AIAnalysisCard {...ai} />
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          // The analysis lives inside the expanded card — reveal it (015).
          setExpanded(true);
          onExplain();
        }}
        style={({ pressed }) => [styles.explainButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Explain my allowance"
        testID="explain-allowance-button"
      >
        <Ionicons name="sparkles-outline" size={16} color={colors.text} />
        <Text style={styles.explainLabel}>Explain my allowance</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerText: { flex: 1 },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  headerHint: { fontSize: typography.caption, color: colors.muted, marginTop: spacing.xs },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: spacing.xs,
  },
  rowLabel: { fontSize: typography.body, color: colors.muted },
  rowAmount: { fontSize: typography.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  plus: { color: colors.text },
  minus: { color: colors.danger },
  equalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  equalsLabel: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  equalsAmount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  explainLabel: { fontSize: typography.body, fontWeight: '600', color: colors.text },
});