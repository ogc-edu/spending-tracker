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
import { BentoCard } from '@/components/ui/BentoCard';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

export function CategorySummary({
  summary,
  categories,
  onShowAll,
  onOpenCategory,
}: {
  /** Top 5 category totals, descending (pre-sliced by the screen). */
  summary: CategorySummaryItem[];
  /** Global categories, for names + colors. */
  categories: Category[];
  /** "Show all" → Analytics tab (011). */
  onShowAll(): void;
  /** Plan 018: rows open Expenses filtered to the category. */
  onOpenCategory(categoryId: number): void;
}) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  /** Σ of the top-5 rows — the bars' denominator (shares of what's shown). */
  const shownTotal = summary.reduce((sum, item) => sum + item.totalSen, 0);

  return (
    <BentoCard testID="category-summary" className="p-5 border border-border/60 bg-card mb-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3" style={styles.title}>
        By Category
      </Text>
      {summary.map((item) => {
        const share = shownTotal === 0 ? 0 : Math.floor((item.totalSen * 1000) / shownTotal) / 10;
        const label = nameById.get(item.categoryId) ?? `Category ${item.categoryId}`;
        return (
          <Pressable
            key={item.categoryId}
            onPress={() => onOpenCategory(item.categoryId)}
            className="py-2.5 min-h-[44px] justify-center"
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: false }}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${spokenMoneyLabel(item.totalSen)} this month`}
            testID={`category-row-${item.categoryId}`}
          >
            <View className="flex-row items-center justify-between mb-1.5" style={styles.rowTop}>
              <View className="flex-1 flex-row items-center mr-3" style={styles.rowMain}>
                <View className="w-2.5 h-2.5 rounded-full mr-3" style={[styles.dot, { backgroundColor: categoryColor(item.categoryId) }]} />
                <Text className="text-sm text-foreground font-medium flex-shrink" style={styles.name} numberOfLines={1}>
                  {label}
                </Text>
              </View>
              <Text
                className="text-sm font-bold text-foreground flex-shrink ml-3"
                style={styles.amount}
                numberOfLines={1}
                accessibilityLabel={`${label}, ${spokenMoneyLabel(item.totalSen)}`}
              >
                {formatSen(item.totalSen)}
                {share > 0 ? <Text className="text-xs text-muted-foreground font-semibold" style={styles.share}>  ·  {share.toFixed(0)}%</Text> : null}
              </Text>
            </View>
            <ProgressBar pct={share} color={categoryColor(item.categoryId)} />
          </Pressable>
        );
      })}
      <Pressable
        onPress={onShowAll}
        className="border-t border-border mt-1 pt-3 pb-1 items-center justify-center min-h-[44px]"
        style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
        accessibilityRole="button"
        accessibilityLabel="Show all categories in Analytics"
        testID="category-show-all"
      >
        <Text className="text-sm font-bold text-accent" style={styles.showAllLabel}>Show all</Text>
      </Pressable>
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: { paddingVertical: spacing.sm + 2 },
  pressed: { opacity: 0.7, backgroundColor: colors.background },
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
});
