/**
 * CategorySummary (plan 010 DASH-2; restyled by plan 017) — spending grouped
 * by category for the month, top 5 by amount plus a "Show all" affordance →
 * Analytics (011). Rows arrive already sorted (engine topCategories); names
 * resolve here from the global categories list; no aggregation in the UI.
 *
 * Plan 017: each row now shows its SHARE of the month's spend as a thin
 * colored bar + percentage — the presentation ratio mirrors
 * CategoryBreakdown on Analytics (a ratio, not financial math). Bars reuse
 * the shared ProgressBar.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/db/schema';
import type { CategorySummaryItem } from '@/services/CashFlowService';
import { categoryColor } from '@/components/categoryMeta';
import { ProgressBar } from '@/components/ProgressBar';
import { Card } from '@/components/ui/Card';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

export function CategorySummary({
  summary,
  categories,
  onShowAll,
}: {
  /** Top 5 category totals, descending (pre-sliced by the screen). */
  summary: CategorySummaryItem[];
  /** Global categories, for names + colors. */
  categories: Category[];
  /** "Show all" → Analytics tab (011). */
  onShowAll(): void;
}) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  /** Σ of the top-5 rows — the bars' denominator (shares of what's shown). */
  const shownTotal = summary.reduce((sum, item) => sum + item.totalSen, 0);

  return (
    <Card testID="category-summary">
      <Text style={styles.title}>By category</Text>
      {summary.map((item) => {
        const share = shownTotal === 0 ? 0 : Math.floor((item.totalSen * 1000) / shownTotal) / 10;
        return (
          <View key={item.categoryId} style={styles.row} testID={`category-row-${item.categoryId}`}>
            <View style={styles.rowTop}>
              <View style={styles.rowMain}>
                <View style={[styles.dot, { backgroundColor: categoryColor(item.categoryId) }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {nameById.get(item.categoryId) ?? `Category ${item.categoryId}`}
                </Text>
              </View>
              <Text
                style={styles.amount}
                numberOfLines={1}
                accessibilityLabel={`${nameById.get(item.categoryId) ?? `Category ${item.categoryId}`}, ${spokenMoneyLabel(item.totalSen)}`}
              >
                {formatSen(item.totalSen)}
                {share > 0 ? <Text style={styles.share}>  ·  {share.toFixed(0)}%</Text> : null}
              </Text>
            </View>
            <ProgressBar pct={share} color={categoryColor(item.categoryId)} />
          </View>
        );
      })}
      <Pressable
        onPress={onShowAll}
        style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        accessibilityRole="button"
        accessibilityLabel="Show all categories in Analytics"
        testID="category-show-all"
      >
        <Text style={styles.showAllLabel}>Show all</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { paddingVertical: spacing.sm + 2 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  name: { fontSize: typography.body, color: colors.text, fontWeight: '500', flexShrink: 1 },
  amount: { fontSize: typography.body, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
  share: { fontSize: typography.caption, color: colors.muted, fontWeight: '600' },
  showAll: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    alignItems: 'center',
  },
  showAllLabel: { fontSize: typography.body, fontWeight: '700', color: colors.accent },
  pressed: { opacity: 0.7 },
});
