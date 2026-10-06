/**
 * BudgetCard (Plan 005 — Overall Monthly Budget Bento Card)
 *
 * Visual allocation control hero card featuring:
 * - BentoCard hairline framing and Obsidian/Porcelain theming.
 * - Multi-tier BudgetMeter with dynamic threshold transitions:
 *     <80%: Electric Mint
 *     80-99%: Warning Amber
 *     >=100%: Destructive Rose with excess badge
 * - Tabular monospace numeric display for zero layout shift (tabular-nums).
 * - Total spent vs budget target cap via MoneyDisplay.
 * - Remaining funds pool and remaining daily buffer (S_safe / D_rem).
 * - Preserved test contracts:
 *     testID="budget-overall-card"
 *     testID="budget-overall-over"
 *     testID="budget-overall-progress"
 *     testID="budget-overall-clear"
 *     testID="budget-overall-empty"
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Budget } from '@/db/schema';
import { budgetMetrics } from '@/engine/budgets';
import { formatSen } from '@/utils/money';
import {
  daysInMonth,
  daysRemainingInMonthInclusive,
  isSameLocalMonth,
  monthEndDate,
  todayLocal,
} from '@/utils/dates';
import { moneyFontVariant } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { BentoCard } from '@/components/ui/BentoCard';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { cn } from '@/lib/utils';

export interface BudgetCardProps {
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
  /** Optional year context (defaults to current year). */
  year?: number;
  /** Optional month context (defaults to current month). */
  month?: number;
}

export function BudgetCard({
  spentSen,
  budget,
  onPress,
  onClear,
  busy = false,
  year,
  month,
}: BudgetCardProps) {
  const metrics = budgetMetrics(budget?.amountSen ?? null, spentSen);

  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? (now.getMonth() + 1);
  const today = todayLocal();
  const monthEnd = monthEndDate(targetYear, targetMonth);
  const isCurrentMonth = isSameLocalMonth(today, targetMonth, targetYear);
  const isFutureMonth = new Date(targetYear, targetMonth - 1, 1) > now;
  const daysRem = isCurrentMonth
    ? daysRemainingInMonthInclusive(today, monthEnd)
    : isFutureMonth
    ? daysInMonth(targetYear, targetMonth)
    : 0;

  const dailyBufferSen =
    metrics.remaining !== null && daysRem > 0
      ? Math.floor(metrics.remaining / daysRem)
      : null;

  const excessSen = budget ? Math.max(0, metrics.spent - budget.amountSen) : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={budget ? 'Edit monthly budget' : 'Set monthly budget'}
      testID="budget-overall-card"
      className="mb-4"
      style={({ pressed }) => [pressed && styles.cardPressed]}
    >
      <BentoCard className="p-5 border-border/60 bg-card">
        {/* Header row */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Monthly Budget
          </Text>
          {metrics.overBudget ? (
            <Badge
              tone="danger"
              label={excessSen > 0 ? `Over by ${formatSen(excessSen)}` : 'Over budget'}
              testID="budget-overall-over"
            />
          ) : null}
        </View>

        {budget ? (
          <>
            {/* Spent vs Cap */}
            <View className="flex-row items-baseline justify-between my-1">
              <View>
                <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                  Spent
                </Text>
                <MoneyDisplay
                  amountInSen={metrics.spent}
                  size="xl"
                  className={metrics.overBudget ? 'text-destructive font-black' : 'text-foreground font-black'}
                />
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">
                  Target Cap
                </Text>
                <MoneyDisplay
                  amountInSen={budget.amountSen}
                  size="lg"
                  className="text-muted-foreground font-bold"
                />
              </View>
            </View>

            {/* Multi-tier BudgetMeter */}
            <View className="my-3">
              <BudgetMeter
                spentSen={metrics.spent}
                totalSen={budget.amountSen}
                heightClass="h-2.5"
                testID="budget-overall-progress"
              />
            </View>

            {/* Metrics Breakdown (Remaining Pool & Daily Buffer) */}
            <View className="flex-row items-center justify-between pt-2 border-t border-border/40">
              <View>
                <Text className="text-xs text-muted-foreground font-medium">Remaining Pool</Text>
                <MoneyDisplay
                  amountInSen={metrics.remaining ?? 0}
                  size="sm"
                  className="font-bold text-foreground"
                />
              </View>

              {dailyBufferSen !== null && dailyBufferSen > 0 ? (
                <View className="items-center">
                  <Text className="text-xs text-muted-foreground font-medium">Daily Buffer</Text>
                  <View className="flex-row items-baseline">
                    <MoneyDisplay
                      amountInSen={dailyBufferSen}
                      size="sm"
                      className="font-bold text-primary"
                    />
                    <Text className="text-xs text-muted-foreground font-medium">/day</Text>
                  </View>
                </View>
              ) : null}

              {metrics.pctUsed !== null ? (
                <View className="items-end">
                  <Text className="text-xs text-muted-foreground font-medium">Utilization</Text>
                  <Text
                    className={cn(
                      'text-sm font-extrabold',
                      metrics.overBudget ? 'text-destructive' : 'text-foreground'
                    )}
                    style={{ fontVariant: moneyFontVariant }}
                  >
                    {metrics.pctUsed.toFixed(1)}%
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Clear budget action */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                onClear();
              }}
              disabled={busy}
              hitSlop={8}
              className="self-start mt-3 min-h-[36px] justify-center"
              accessibilityRole="button"
              accessibilityLabel="Clear budget"
              testID="budget-overall-clear"
            >
              <Text className="text-muted-foreground text-xs font-semibold underline">
                Clear budget
              </Text>
            </Pressable>
          </>
        ) : (
          <View className="py-2" testID="budget-overall-empty">
            <Text className="text-base font-bold text-foreground mb-1">
              No monthly budget set
            </Text>
            <Text className="text-sm text-muted-foreground leading-5">
              Tap to set a budget for this month and see your remaining funds.
            </Text>
          </View>
        )}
      </BentoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardPressed: { opacity: 0.85 },
});