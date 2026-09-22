/**
 * FormulaCard (plan 010 DASH-3) — the expandable safe-to-spend formula:
 * Available − Upcoming commitments − Remaining budget − Safety buffer = Safe.
 *
 * The rows come straight from engine.cashFlowBreakdown (plan 009): signed
 * labelled terms whose sum equals the safe headline — the plan's "formula
 * card data sums back to safe" acceptance criterion. Tapping the header
 * toggles the breakdown; the arithmetic is never performed here.
 *
 * "Explain my allowance" moved out of this card in plan 019 — the Dashboard's
 * dedicated AskAiCard now owns all AI interaction. This card is purely the
 * formula: tap the header to reveal the signed terms.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CashFlowBreakdownItem } from '@/engine/cashflow';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Card } from '@/components/ui/Card';

export function FormulaCard({
  breakdown,
  safeSen,
}: {
  /** Signed labelled terms from engine.cashFlowBreakdown (Σ = safeSen). */
  breakdown: CashFlowBreakdownItem[];
  safeSen: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card testID="formula-card">
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
                numberOfLines={1}
                accessibilityLabel={`${item.label}, ${spokenMoneyLabel(item.amountSen)}`}
              >
                {formatSen(item.amountSen)}
              </Text>
            </View>
          ))}
          <View style={styles.equalsRow} testID="formula-equals">
            <Text style={styles.equalsLabel}>Safe to spend</Text>
            <Text style={styles.equalsAmount} numberOfLines={1} accessibilityLabel={`Safe to spend, ${spokenMoneyLabel(safeSen)}`}>
              {formatSen(safeSen)}
            </Text>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  headerText: { flex: 1 },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  headerHint: { fontSize: typography.caption, color: colors.muted, marginTop: 2 },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  rowLabel: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  rowAmount: { fontSize: typography.body, fontWeight: '700', fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
  plus: { color: colors.text },
  minus: { color: colors.danger },
  equalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  equalsLabel: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  equalsAmount: { fontSize: typography.emphasis, fontWeight: '800', color: colors.accent, fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
});