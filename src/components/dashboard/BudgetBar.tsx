/**
 * BudgetBar (plan 010 DASH-1, 007 metrics; restyled by plan 017) — the
 * overall monthly budget shown as a progress bar: spent vs budget,
 * percentage, over-budget danger state (color + label, never a notification
 * — BUD-2..4). All metrics are engine-computed (snapshot.budgetMetrics); no
 * math here. The over-budget badge is the shared soft Badge; the progress
 * bar is 8 px with the shared ProgressBar.
 *
 * No overall budget → a "Set a budget" prompt (PRD §8.4 treats a missing
 * budget as term 0 in the cash-flow math — this is the dashboard's prompt,
 * linking to the Budgets tab).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Budget } from '@/db/schema';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { ProgressBar } from '@/components/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
      <Card testID="budget-bar-empty">
        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider" style={styles.title}>Monthly budget</Text>
        <Text className="text-sm text-muted-foreground mt-1 leading-relaxed" style={styles.emptyBody}>
          No monthly budget set — cash flow treats it as RM0 reserved.
        </Text>
        <Pressable
          onPress={onSetBudget}
          className="self-start mt-3 bg-accent/10 rounded-full min-h-[44px] justify-center py-2 px-4 border border-accent/20"
          style={({ pressed }) => [styles.setButton, pressed && styles.pressed]}
          android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
          accessibilityRole="button"
          accessibilityLabel="Set a monthly budget"
          testID="budget-bar-set"
        >
          <Text className="text-accent text-sm font-bold" style={styles.setLabel}>Set a budget</Text>
        </Pressable>
      </Card>
    );
  }

  return (
    <Card testID="budget-bar">
      <View className="flex-row items-center justify-between mb-1" style={styles.header}>
        <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider" style={styles.title}>Monthly budget</Text>
        {overBudget ? <Badge tone="danger" label="Over budget" testID="budget-bar-over" /> : null}
      </View>
      <Text className="text-2xl font-extrabold text-foreground mb-2" style={styles.amount} numberOfLines={1} accessibilityLabel={`Monthly budget, ${spokenMoneyLabel(budget.amountSen)}`}>
        {formatSen(budget.amountSen)}
      </Text>
      <View className="mb-2" style={styles.progressWrap}>
        <ProgressBar
          pct={pctUsed ?? 0}
          color={colors.accent}
          danger={overBudget}
          testID="budget-bar-progress"
        />
      </View>
      <Text
        className="text-sm text-muted-foreground font-medium"
        style={styles.metrics}
        accessibilityLabel={`Spent ${spokenMoneyLabel(spentSen)}, remaining ${spokenMoneyLabel(remainingSen)}`}
      >
        Spent {formatSen(spentSen)}
        {' · '}Remaining {formatSen(remainingSen)}
        {pctUsed !== null ? <Text className="font-bold text-foreground" style={styles.pct}> · {pctUsed.toFixed(1)}%</Text> : null}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: { fontSize: typography.caption, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: {
    fontSize: typography.title,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
    fontVariant: moneyFontVariant,
    letterSpacing: -0.3,
  },
  progressWrap: { marginBottom: spacing.sm },
  metrics: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  pct: { fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: typography.body, color: colors.muted, marginTop: spacing.xs, lineHeight: 21 },
  setButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.75 },
  setLabel: { color: colors.accent, fontSize: typography.body, fontWeight: '700' },
});
