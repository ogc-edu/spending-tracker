/**
 * BudgetRow (plan 007 UI) — one per-category budget indicator row: spent,
 * budget amount (or "—" when unset), progress bar, over-budget flag
 * (BUD-2/BUD-3). Tapping the row opens the set/edit form; a "Clear" action
 * removes the row. Every seeded category gets a row (12 in MVP) — the
 * Debt / Repayment category counts its auto-created D3 expenses like any
 * other (no special casing, plan §UI). Category budgets are informational
 * only — this row never feeds a financial formula (BUD-3, cash flow is 009).
 *
 * Metrics come ONLY from the pure engine (budgetMetrics) — no money math in
 * the UI. Over-budget is color + label, never a notification.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Budget, Category } from '@/db/schema';
import { budgetMetrics } from '@/engine/budgets';
import { formatSen } from '@/utils/money';
import { categoryColor } from './categoryMeta';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { ProgressBar } from './ProgressBar';
import { Badge } from '@/components/ui/Badge';

export function BudgetRow({
  category,
  spentSen,
  budget,
  onPress,
  onClear,
  busy = false,
}: {
  category: Category;
  /** This category's month spend (sen) — engine expenseTotalsByCategory. */
  spentSen: number;
  /** The category's budget row for the month, or null when unset. */
  budget: Budget | null;
  /** Tap the row: open the set/edit form. */
  onPress(): void;
  /** Remove this category's budget (only rendered when one exists). */
  onClear(): void;
  busy?: boolean;
}) {
  const color = categoryColor(category.id);
  const metrics = budgetMetrics(budget?.amountSen ?? null, spentSen);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name} budget`}
      testID={`budget-row-${category.id}`}
    >
      <View style={styles.leading}>
        <View style={[styles.iconBox, { backgroundColor: `${color}1A` }]}>
          <Ionicons name={category.icon as never} size={16} color={color} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleLine}>
            <Text style={styles.name}>{category.name}</Text>
            {metrics.overBudget ? (
              <Badge tone="danger" label="Over" testID={`budget-row-${category.id}-over`} />
            ) : null}
          </View>
          <Text style={styles.spent} testID={`budget-row-${category.id}-spent`}>
            Spent {formatSen(metrics.spent)}
          </Text>
        </View>
      </View>

      <View style={styles.trailing}>
        {budget ? (
          <Text style={styles.budgetAmount} testID={`budget-row-${category.id}-amount`}>
            {formatSen(budget.amountSen)}
          </Text>
        ) : (
          <Text style={styles.noBudget} testID={`budget-row-${category.id}-amount`}>
            —
          </Text>
        )}
        {budget ? (
          <Pressable
            onPress={onClear}
            disabled={busy}
            hitSlop={10}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${category.name} budget`}
            testID={`budget-row-${category.id}-clear`}
          >
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.progressColumn}>
        {metrics.pctUsed !== null ? (
          <Text style={[styles.pct, metrics.overBudget && styles.overText]}>{metrics.pctUsed.toFixed(1)}%</Text>
        ) : null}
        <ProgressBar
          pct={metrics.pctUsed ?? 0}
          color={color}
          danger={metrics.overBudget}
          testID={`budget-row-${category.id}-progress`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  rowPressed: { opacity: 0.85 },
  leading: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  info: { flex: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: typography.body, fontWeight: '700', color: colors.text },
  spent: { fontSize: typography.caption, color: colors.muted, marginTop: 2, fontWeight: '500' },
  trailing: { alignItems: 'flex-end', gap: 4, marginLeft: spacing.sm },
  budgetAmount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant },
  noBudget: { fontSize: typography.emphasis, fontWeight: '700', color: colors.muted },
  clearLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
  progressColumn: { marginTop: spacing.sm, gap: 4 },
  pct: { fontSize: typography.caption, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant },
  overText: { color: colors.danger },
});