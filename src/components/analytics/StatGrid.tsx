/**
 * StatGrid (Plan 007 / AN-2/AN-3) — 2x2 Metrics Bento Matrix for Analytics.
 * Renders four executive cash flow KPI tiles using BentoCard & MoneyDisplay:
 *  - Cell 1: Total monthly spend + MoM percentage change chip (MoMChip)
 *  - Cell 2: Daily average spend (spent / days elapsed)
 *  - Cell 3: Peak spending day (highest spend day, primary driver, date)
 *  - Cell 4: Top spending category (amount and percentage share)
 *
 * Preserved test contracts:
 *  - testID="analytics-kpi-grid"
 *  - testID="analytics-stats"
 *  - testID="analytics-total-card"
 *  - testID="analytics-total"
 *  - testID="analytics-stat-avg"
 *  - testID="analytics-stat-largest"
 *  - testID="analytics-stat-utilization"
 *  - testID="analytics-stat-projection"
 */
import { Text, View } from 'react-native';
import type { SpendingSnapshot } from '@/services/AnalyticsService';
import { BentoCard } from '@/components/ui/BentoCard';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { MoMChip } from '@/components/analytics/MoMChip';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';

export function StatGrid({ snapshot }: { snapshot: SpendingSnapshot }) {
  const largest = snapshot.largest[0] ?? null;
  const topCategory = snapshot.topCategories[0] ?? null;
  const utilization = snapshot.utilization;

  const topCategoryShare =
    snapshot.totalSen > 0 && topCategory
      ? Math.floor((topCategory.amountSen * 1000) / snapshot.totalSen) / 10
      : 0;

  return (
    <View testID="analytics-kpi-grid" className="mb-4">
      <View testID="analytics-stats" className="flex-row flex-wrap justify-between gap-3">
        {/* Cell 1: Total Monthly Spend */}
        <BentoCard
          testID="analytics-total-card"
          className="flex-1 min-w-[46%] p-3.5 bg-card border-border/80 justify-between"
        >
          <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Total Spent
          </Text>
          <View className="my-1.5">
            <MoneyDisplay
              amountInSen={snapshot.totalSen}
              size="lg"
              testID="analytics-total"
            />
          </View>
          <View className="mt-1">
            <MoMChip changeSen={snapshot.changeSen} changePct={snapshot.changePct} />
          </View>
          <View testID="analytics-stat-projection" className="mt-2 pt-2 border-t border-border/40">
            <Text className="text-[11px] text-muted-foreground font-medium" numberOfLines={1}>
              Proj: {formatSen(snapshot.projectionSen)}
            </Text>
          </View>
        </BentoCard>

        {/* Cell 2: Daily Average Spend */}
        <BentoCard
          testID="analytics-stat-avg"
          className="flex-1 min-w-[46%] p-3.5 bg-card border-border/80 justify-between"
        >
          <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Daily Average
          </Text>
          <View className="my-1.5">
            <MoneyDisplay
              amountInSen={snapshot.avgDailySen}
              size="lg"
            />
          </View>
          <Text className="text-xs text-muted-foreground font-medium mt-1">
            {snapshot.elapsedDays} {snapshot.elapsedDays === 1 ? 'day' : 'days'} elapsed
          </Text>
          <View className="mt-2 pt-2 border-t border-border/40">
            <Text className="text-[11px] text-muted-foreground/80 font-mono" style={{ fontVariant: ['tabular-nums'] }}>
              of {snapshot.daysInMonth} cycle days
            </Text>
          </View>
        </BentoCard>

        {/* Cell 3: Peak Spending Day */}
        <BentoCard
          testID="analytics-stat-largest"
          className="flex-1 min-w-[46%] p-3.5 bg-card border-border/80 justify-between"
        >
          <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Peak Expense
          </Text>
          <View className="my-1.5">
            {largest ? (
              <MoneyDisplay
                amountInSen={largest.amountSen}
                size="lg"
              />
            ) : (
              <Text className="text-xl font-bold text-foreground tracking-tight">—</Text>
            )}
          </View>
          <Text className="text-xs text-muted-foreground font-medium mt-1" numberOfLines={1}>
            {largest ? `${formatDayLabel(largest.date)} · ${largest.categoryName}` : 'No expenses'}
          </Text>
          <View className="mt-2 pt-2 border-t border-border/40">
            <Text className="text-[11px] text-muted-foreground/80 font-medium" numberOfLines={1}>
              {largest ? 'Largest transaction' : 'Zero activity'}
            </Text>
          </View>
        </BentoCard>

        {/* Cell 4: Top Spending Category */}
        <BentoCard
          className="flex-1 min-w-[46%] p-3.5 bg-card border-border/80 justify-between"
        >
          <Text className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Top Category
          </Text>
          <View className="my-1.5">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {topCategory ? topCategory.categoryName : '—'}
            </Text>
            {topCategory ? (
              <View className="flex-row items-baseline gap-1 mt-0.5">
                <MoneyDisplay
                  amountInSen={topCategory.amountSen}
                  size="sm"
                />
                <Text className="text-xs text-muted-foreground font-semibold">
                  ({topCategoryShare.toFixed(1)}%)
                </Text>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground font-medium mt-0.5">—</Text>
            )}
          </View>
          <View testID="analytics-stat-utilization" className="mt-2 pt-2 border-t border-border/40">
            <Text
              className={`text-[11px] font-medium ${
                utilization?.overBudget ? 'text-destructive font-bold' : 'text-muted-foreground'
              }`}
              numberOfLines={1}
            >
              {utilization === null
                ? 'No budget set'
                : utilization.overBudget
                  ? `Budget: ${utilization.pct?.toFixed(1)}% (Over)`
                  : `Budget: ${utilization.pct?.toFixed(1)}% used`}
            </Text>
          </View>
        </BentoCard>
      </View>
    </View>
  );
}
