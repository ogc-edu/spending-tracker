/**
 * BudgetBar (plan 010 DASH-1, redesigned Plan 003) — Monthly budget snapshot:
 * Progress bar of spent vs overall budget cap with BudgetMeter.tsx,
 * percentage utilization, remaining budget, and over-budget indicator.
 *
 * Plan 003 Bento redesign:
 * - Retains testID="budget-overall-card", budget-bar, budget-bar-progress, budget-bar-over.
 * - Embeds BudgetMeter.tsx with semantic progress bar.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Budget } from '@/db/schema';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { BentoCard } from '@/components/ui/BentoCard';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { cn } from '@/lib/utils';

export interface BudgetBarProps {
  /** The month's overall budget row, or null when unset. */
  budget: Budget | null;
  spentSen: number;
  /** Engine-computed max(0, budget − spent). */
  remainingSen: number;
  /** Snapshot.budgetMetrics.pctUsed — null when no budget. */
  pctUsed: number | null;
  /** Snapshot.budgetMetrics.overBudget. */
  overBudget: boolean;
  /** "Set a budget" → Budgets tab (only when no budget). */
  onSetBudget(): void;
}

export function BudgetBar({
  budget,
  spentSen,
  remainingSen,
  pctUsed,
  overBudget,
  onSetBudget,
}: BudgetBarProps) {
  if (!budget) {
    return (
      <View testID="budget-overall-card">
        <BentoCard testID="budget-bar-empty" className="p-5 border border-border/60 bg-card mb-4">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider" style={styles.title}>
            Monthly budget
          </Text>
          <Text className="text-sm text-muted-foreground mt-1 leading-relaxed" style={styles.emptyBody}>
            No monthly budget set — cash flow treats it as RM0 reserved.
          </Text>
          <Pressable
            onPress={onSetBudget}
            className="self-start mt-3 bg-primary/10 rounded-full min-h-[44px] justify-center py-2 px-4 border border-primary/20"
            style={({ pressed }) => [styles.setButton, pressed && styles.pressed]}
            android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
            accessibilityRole="button"
            accessibilityLabel="Set a monthly budget"
            testID="budget-bar-set"
          >
            <Text className="text-primary text-sm font-bold" style={styles.setLabel}>
              Set a budget
            </Text>
          </Pressable>
        </BentoCard>
      </View>
    );
  }

  return (
    <View testID="budget-overall-card">
      <BentoCard testID="budget-bar" className="p-5 border border-border/60 bg-card mb-4">
        <View className="flex-row items-center justify-between mb-1" style={styles.header}>
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider" style={styles.title}>
            Monthly budget
          </Text>
          {overBudget ? <Badge tone="danger" label="Over budget" testID="budget-bar-over" /> : null}
        </View>

        <Text
          className={cn(
            'text-2xl font-black font-mono my-1 tracking-tight',
            overBudget ? 'text-destructive' : 'text-foreground'
          )}
          style={styles.amount}
          numberOfLines={1}
          accessibilityLabel={`Monthly budget, ${spokenMoneyLabel(budget.amountSen)}`}
        >
          {formatSen(budget.amountSen)}
        </Text>

        <View className="my-2" style={styles.progressWrap}>
          <BudgetMeter
            spentSen={spentSen}
            totalSen={budget.amountSen}
            heightClass="h-2.5"
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
          {pctUsed !== null ? (
            <Text className="font-bold text-foreground" style={styles.pct}>
              {' · '}{pctUsed.toFixed(1)}%
            </Text>
          ) : null}
        </Text>
      </BentoCard>
    </View>
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
    borderRadius: 999,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.75 },
  setLabel: { color: colors.primary, fontSize: typography.body, fontWeight: '700' },
});
