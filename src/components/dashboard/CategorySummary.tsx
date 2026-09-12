/**
 * CategorySummary (plan 010 DASH-2) — spending grouped by category for the
 * month, top 5 by amount plus a "Show all" affordance → Analytics (011).
 * Rows arrive already sorted (engine topCategories); names resolve here from
 * the global categories list; no aggregation in the UI.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category } from '@/db/schema';
import type { CategorySummaryItem } from '@/services/CashFlowService';
import { categoryColor } from '@/components/categoryMeta';
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

  return (
    <View style={styles.card} testID="category-summary">
      <Text style={styles.title}>By category</Text>
      {summary.map((item) => (
        <View key={item.categoryId} style={styles.row} testID={`category-row-${item.categoryId}`}>
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
          </Text>
        </View>
      ))}
      <Pressable
        onPress={onShowAll}
        style={({ pressed }) => [styles.showAll, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Show all categories in Analytics"
        testID="category-show-all"
      >
        <Text style={styles.showAllLabel}>Show all</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  name: { fontSize: typography.body, color: colors.text, fontWeight: '500' },
  amount: { fontSize: typography.body, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
  showAll: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  showAllLabel: { fontSize: typography.body, fontWeight: '700', color: colors.accent },
  pressed: { opacity: 0.7 },
});
