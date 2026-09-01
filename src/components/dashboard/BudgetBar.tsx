/**
 * BudgetBar (plan 010 DASH-1, 007 metrics) — the overall monthly budget shown
 * as a progress bar: spent vs budget, percentage, over-budget danger state
 * (color + label, never a notification — BUD-2..4). All metrics are
 * engine-computed (snapshot.budgetMetrics); no math here.
 *
 * No overall budget → a "Set a budget" prompt (PRD §8.4 treats a missing
 * budget as term 0 in the cash-flow math — this is the dashboard's prompt,
 * linking to the Budgets tab).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Budget } from '@/db/schema';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ProgressBar';

export function BudgetBar({
  budget,
  spentSen,
  remainingSen,
  pctUsed,
  overBudget,
  onSetBudget,
}: {
  /** The month's overall budget row, or null when unset. */
  budget: Budget | null;
  spentSen: number;
  /** Engine-computed max(0, budget − spent) — null/0 handled by caller. */
  remainingSen: number;
  /** Snapshot.budgetMetrics.pctUsed — null when no budget. */
  pctUsed: number | null;
  /** Snapshot.budgetMetrics.overBudget. */
  overBudget: boolean;
  /** "Set a budget" → Budgets tab (only when no budget). */
  onSetBudget(): void;
}) {
  if (!budget) {
    return (
      <View style={styles.card} testID="budget-bar-empty">
        <Text style={styles.title}>Monthly budget</Text>
        <Text style={styles.emptyBody}>
          No monthly budget set — cash flow treats it as RM0 reserved.
        </Text>
        <Pressable
          onPress={onSetBudget}
          style={({ pressed }) => [styles.setButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Set a monthly budget"
          testID="budget-bar-set"
        >
          <Text style={styles.setLabel}>Set a budget</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card} testID="budget-bar">
      <View style={styles.header}>
        <Text style={styles.title}>Monthly budget</Text>
        {overBudget ? (
          <View style={styles.overBadge} testID="budget-bar-over">
            <Text style={styles.overLabel}>Over budget</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.amount}>{formatSen(budget.amountSen)}</Text>
      <View style={styles.progressWrap}>
        <ProgressBar
          pct={pctUsed ?? 0}
          color={colors.accent}
          danger={overBudget}
          testID="budget-bar-progress"
        />
      </View>
      <Text style={styles.metrics}>
        Spent {formatSen(spentSen)}
        {' · '}Remaining {formatSen(remainingSen)}
        {pctUsed !== null ? <Text style={styles.pct}> · {pctUsed.toFixed(1)}%</Text> : null}
      </Text>
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
    marginBottom: spacing.xs,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  overBadge: {
    backgroundColor: colors.dangerSoft,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  overLabel: { color: colors.danger, fontSize: typography.caption, fontWeight: '700' },
  amount: {
    fontSize: typography.moneySmall,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  progressWrap: { marginBottom: spacing.sm },
  metrics: { fontSize: typography.body, color: colors.muted },
  pct: { fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: typography.body, color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  setButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.7 },
  setLabel: { color: colors.accent, fontSize: typography.body, fontWeight: '700' },
});
