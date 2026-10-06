/**
 * BudgetRow (Plan 005 — Category Allocation Tile)
 *
 * Modernized as a category allocation tile inside the 2-column allocations grid:
 * - 48px minimum touch target (TouchTarget).
 * - Category icon with category color token.
 * - Current spend vs target limit cap.
 * - Category-specific BudgetMeter with dynamic threshold transitions.
 * - Unset states present a clear "Set limit" action.
 * - Exceeded categories show crimson alert pill: "Over by RM XX.XX".
 * - Tapping a tile triggers the Budget Limit Sheet.
 * - Preserved test contracts:
 *     testID="category-card-{category.id}"
 *     testID="budget-row-{category.id}"
 *     testID="budget-row-{category.id}-spent"
 *     testID="budget-row-{category.id}-amount"
 *     testID="budget-row-{category.id}-over"
 *     testID="budget-row-{category.id}-progress"
 *     testID="budget-row-{category.id}-clear"
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Budget, Category } from '@/db/schema';
import { budgetMetrics } from '@/engine/budgets';
import { formatSen } from '@/utils/money';
import { categoryColor } from './categoryMeta';
import { moneyFontVariant } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { TouchTarget } from '@/components/ui/TouchTarget';
import { cn } from '@/lib/utils';

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
  const excess = budget ? Math.max(0, metrics.spent - budget.amountSen) : 0;

  return (
    <View
      testID={`category-card-${category.id}`}
      className="w-full mb-3 flex-1"
    >
      <TouchTarget
        minHeight={48}
        onPress={onPress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`${category.name} budget`}
        testID={`budget-row-${category.id}`}
        className="w-full min-h-[140px] justify-between bg-card rounded-2xl border border-border/60 p-3.5 items-stretch"
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {/* Top: Category Icon + Name + Over Badge */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2 flex-1 mr-1">
            <View
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: `${color}1A` }}
            >
              <Ionicons name={category.icon as never} size={15} color={color} />
            </View>
            <Text className="text-sm font-bold text-foreground flex-1" numberOfLines={1}>
              {category.name}
            </Text>
          </View>
          {metrics.overBudget ? (
            <Badge
              tone="danger"
              label={excess > 0 ? `Over by ${formatSen(excess)}` : 'Over'}
              testID={`budget-row-${category.id}-over`}
            />
          ) : null}
        </View>

        {/* Middle: Spent vs Cap */}
        <View className="my-1">
          <Text
            className="text-xs text-muted-foreground font-medium"
            testID={`budget-row-${category.id}-spent`}
          >
            Spent {formatSen(metrics.spent)}
          </Text>
          {budget ? (
            <Text
              className="text-sm font-bold text-foreground mt-0.5"
              style={{ fontVariant: moneyFontVariant }}
              testID={`budget-row-${category.id}-amount`}
            >
              Cap: {formatSen(budget.amountSen)}
            </Text>
          ) : (
            <View className="flex-row items-center justify-between mt-1">
              <Text
                className="text-xs font-semibold text-muted-foreground"
                testID={`budget-row-${category.id}-amount`}
              >
                No limit set
              </Text>
              <Text className="text-xs font-bold text-primary">
                + Set limit
              </Text>
            </View>
          )}
        </View>

        {/* Bottom: Progress meter & Clear action */}
        {budget ? (
          <View className="mt-2 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text
                className={cn(
                  'text-xs font-bold',
                  metrics.overBudget ? 'text-destructive' : 'text-muted-foreground'
                )}
                style={{ fontVariant: moneyFontVariant }}
              >
                {metrics.pctUsed !== null ? `${metrics.pctUsed.toFixed(1)}%` : ''}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onClear();
                }}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Clear ${category.name} budget`}
                testID={`budget-row-${category.id}-clear`}
              >
                <Text className="text-muted-foreground text-xs font-semibold underline">
                  Clear
                </Text>
              </Pressable>
            </View>
            <BudgetMeter
              spentSen={metrics.spent}
              totalSen={budget.amountSen}
              heightClass="h-1.5"
              customColor={
                metrics.overBudget
                  ? undefined
                  : metrics.pctUsed != null && metrics.pctUsed >= 80
                  ? undefined
                  : color
              }
              testID={`budget-row-${category.id}-progress`}
            />
          </View>
        ) : null}
      </TouchTarget>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
});