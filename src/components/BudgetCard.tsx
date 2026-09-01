/**
 * BudgetCard (plan 007 UI) — the OVERALL monthly budget card: amount,
 * spent/remaining, percentage, progress bar, over-budget state in danger
 * color (BUD-2..4). Tapping the card opens the edit form (set or replace,
 * BUD-1); a "Clear" action removes the row (clearing is deletion — plan
 * §Decisions). With no overall budget the card shows the "set a budget"
 * prompt (plan §Requirements — PRD §8.4 treats a missing budget as term 0 in
 * cash flow, which is the dashboard's concern in 010, never rendered here).
 *
 * Metrics come ONLY from the pure engine (budgetMetrics) — no money math in
 * the UI. No notifications anywhere: over-budget is color + label.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Budget } from '@/db/schema';
import { budgetMetrics, type BudgetMetrics } from '@/engine/budgets';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { ProgressBar } from './ProgressBar';

function MetricsRow({ metrics }: { metrics: BudgetMetrics }) {
  return (
    <View style={styles.metricsRow}>
      <Text style={styles.metricText}>
        Spent {formatSen(metrics.spent)}
        {metrics.remaining !== null ? <> · Remaining {formatSen(metrics.remaining)}</> : null}
      </Text>
      {metrics.pctUsed !== null ? (
        <Text style={[styles.pctText, metrics.overBudget && styles.overText]}>{metrics.pctUsed.toFixed(1)}%</Text>
      ) : null}
    </View>
  );
}

export function BudgetCard({
  spentSen,
  budget,
  onPress,
  onClear,
  busy = false,
}: {
  /** Month spend (sen) — engine monthlyTotals over the selected month. */
  spentSen: number;
  /** The month's overall budget row, or null when unset. */
  budget: Budget | null;
  /** Tap anywhere on the card: open the set/edit form. */
  onPress(): void;
  /** Remove the overall budget (only rendered when one exists). */
  onClear(): void;
  /** True while an upsert/clear is in flight (disables taps). */
  busy?: boolean;
}) {
  const metrics = budgetMetrics(budget?.amountSen ?? null, spentSen);

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={budget ? 'Edit monthly budget' : 'Set monthly budget'}
      testID="budget-overall-card"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Monthly budget</Text>
        {metrics.overBudget ? (
          <View style={styles.overBadge} testID="budget-overall-over">
            <Text style={styles.overBadgeLabel}>Over budget</Text>
          </View>
        ) : null}
      </View>

      {budget ? (
        <>
          <Text style={styles.amount}>{formatSen(budget.amountSen)}</Text>
          <MetricsRow metrics={metrics} />
          {metrics.pctUsed !== null ? (
            <View style={styles.progressWrap}>
              <ProgressBar
                pct={metrics.pctUsed}
                color={colors.accent}
                danger={metrics.overBudget}
                testID="budget-overall-progress"
              />
            </View>
          ) : null}
          <Pressable
            onPress={onClear}
            disabled={busy}
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="budget-overall-clear"
          >
            <Text style={styles.clearLabel}>Clear budget</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyBox} testID="budget-overall-empty">
          <Text style={styles.emptyTitle}>No monthly budget set</Text>
          <Text style={styles.emptyBody}>Tap to set a budget for this month and see your remaining funds.</Text>
        </View>
      )}
    </Pressable>
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
  cardPressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: typography.body, fontWeight: '700', color: colors.muted },
  overBadge: {
    backgroundColor: colors.dangerSoft,
    borderRadius: spacing.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  overBadgeLabel: { color: colors.danger, fontSize: typography.caption, fontWeight: '700' },
  amount: { fontSize: typography.money, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, fontVariant: ['tabular-nums'] },
  metricsRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm },
  metricText: { fontSize: typography.body, color: colors.muted },
  pctText: { fontSize: typography.body, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  overText: { color: colors.danger },
  progressWrap: { marginBottom: spacing.md },
  clearButton: { alignSelf: 'flex-start', marginTop: spacing.xs },
  clearLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
  emptyBox: { paddingVertical: spacing.sm },
  emptyTitle: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyBody: { fontSize: typography.body, color: colors.muted, lineHeight: 21 },
});