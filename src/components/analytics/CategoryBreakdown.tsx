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
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

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
              <View style={styles.amountWrap}>
                <Text style={styles.amount}>{formatSen(row.amountSen)}</Text>
                <Text style={styles.share}>{share.toFixed(1)}%</Text>
              </View>
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: typography.emphasis,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: -0.2,
  },
  row: { marginBottom: spacing.md },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  name: { fontSize: typography.body, color: colors.text, fontWeight: '600', flexShrink: 1 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1, marginLeft: spacing.md },
  amount: { fontSize: typography.body, color: colors.text, fontWeight: '700', fontVariant: moneyFontVariant },
  share: { fontSize: typography.caption, color: colors.muted, fontWeight: '700' },
});
