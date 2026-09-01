/**
 * CategoryBreakdown (plan 011, decision A3) — the month's per-category totals
 * as plain horizontal bar rows (zero chart dependencies, consistent with the
 * Dashboard). Each bar shows the category's SHARE of the month total — a
 * presentation ratio, not a financial figure (money math stays in the
 * engine). Reuses plan 007's ProgressBar as-is ("extend, don't reformat").
 */
import { StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ProgressBar';
import { categoryColor } from '@/components/categoryMeta';
import type { CategorySpend } from '@/services/AnalyticsService';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export function CategoryBreakdown({
  breakdown,
  totalSen,
}: {
  breakdown: CategorySpend[];
  totalSen: number;
}) {
  if (breakdown.length === 0) return null;
  return (
    <View style={styles.section} testID="analytics-breakdown">
      <Text style={styles.title}>Category breakdown</Text>
      {breakdown.map((row) => {
        // Share of the month total, one-decimal floored (mirrors engine pct floors).
        const share = totalSen === 0 ? 0 : Math.floor((row.amountSen * 1000) / totalSen) / 10;
        return (
          <View key={row.categoryId} style={styles.row} testID={`analytics-breakdown-row-${row.categoryId}`}>
            <View style={styles.rowHeader}>
              <Text style={styles.name}>{row.categoryName}</Text>
              <Text style={styles.amount}>{formatSen(row.amountSen)}</Text>
            </View>
            <ProgressBar pct={share} color={categoryColor(row.categoryId)} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: { marginBottom: spacing.md },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  name: { fontSize: typography.body, color: colors.text },
  amount: { fontSize: typography.body, color: colors.text, fontWeight: '600' },
});
