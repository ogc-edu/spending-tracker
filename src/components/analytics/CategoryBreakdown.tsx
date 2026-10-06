/**
 * CategoryBreakdown (Plan 007) — Ranked category expenditure list.
 * Features:
 *  - Dynamic proportional fill bars showing exact percentage share of total month spend.
 *  - Category icon badge with subtle tinted background.
 *  - Tabular currency amounts via MoneyDisplay.
 *  - Share percentage chip with tabular-nums typography.
 *
 * Preserved test contracts:
 *  - testID="analytics-categories"
 *  - testID="analytics-breakdown"
 *  - testID="analytics-breakdown-row-{id}"
 */
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '@/components/ui/BentoCard';
import { BudgetMeter } from '@/components/ui/BudgetMeter';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { categoryColor } from '@/components/categoryMeta';
import type { CategorySpend } from '@/services/AnalyticsService';

const DEFAULT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Food: 'restaurant-outline',
  Groceries: 'cart-outline',
  Transport: 'car-outline',
  Entertainment: 'film-outline',
  Shopping: 'bag-handle-outline',
  Bills: 'receipt-outline',
  Health: 'medkit-outline',
  Education: 'school-outline',
  Travel: 'airplane-outline',
  Gifts: 'gift-outline',
  'Debt / Repayment': 'card-outline',
  Other: 'ellipsis-horizontal-circle-outline',
};

export function CategoryBreakdown({
  breakdown,
  totalSen,
}: {
  breakdown: CategorySpend[];
  totalSen: number;
}) {
  if (breakdown.length === 0) return null;

  return (
    <BentoCard testID="analytics-categories" className="bg-card mb-4 p-4">
      <View testID="analytics-breakdown">
        <Text className="text-base font-bold text-foreground mb-3 tracking-tight">
          Category Breakdown
        </Text>
        {breakdown.map((row) => {
          const share = totalSen === 0 ? 0 : Math.floor((row.amountSen * 1000) / totalSen) / 10;
          const color = categoryColor(row.categoryId);
          const iconName = DEFAULT_ICONS[row.categoryName] ?? 'pricetag-outline';

          return (
            <View
              key={row.categoryId}
              className="mb-3.5"
              testID={`analytics-breakdown-row-${row.categoryId}`}
            >
              <View className="flex-row justify-between items-center mb-1.5">
                <View className="flex-row items-center gap-2.5 flex-1 mr-2">
                  <View
                    className="w-7 h-7 rounded-full items-center justify-center border border-border/40"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Ionicons name={iconName} size={14} color={color} />
                  </View>
                  <Text className="text-sm font-semibold text-foreground flex-shrink" numberOfLines={1}>
                    {row.categoryName}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <MoneyDisplay
                    amountInSen={row.amountSen}
                    size="sm"
                  />
                  <View className="bg-muted/40 rounded-full px-2 py-0.5 border border-border/40">
                    <Text
                      className="text-xs font-bold text-muted-foreground font-mono"
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {share.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>

              <BudgetMeter
                spentSen={row.amountSen}
                totalSen={totalSen}
                customColor={color}
                heightClass="h-2"
              />
            </View>
          );
        })}
      </View>
    </BentoCard>
  );
}
