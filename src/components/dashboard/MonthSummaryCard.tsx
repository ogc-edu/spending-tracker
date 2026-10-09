/**
 * MonthSummaryCard (plan 020) — Home's two headline figures, replacing the
 * daily-allowance hero: what was spent this month, and what is due by the end
 * of it (unpaid commitments, overdue included). Both values come straight
 * from CashFlowService; no arithmetic here.
 */
import { Text, View } from 'react-native';
import { BentoCard } from '@/components/ui/BentoCard';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';

export interface MonthSummaryCardProps {
  spentSen: number;
  dueSen: number;
  /** e.g. "October 2026". */
  monthLabel: string;
}

export function MonthSummaryCard({ spentSen, dueSen, monthLabel }: MonthSummaryCardProps) {
  return (
    <BentoCard testID="month-summary-card" className="p-5 mb-4 border border-border/60 bg-card">
      <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {monthLabel}
      </Text>
      <View className="flex-row">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-semibold text-muted-foreground mb-1">Spent this month</Text>
          <MoneyDisplay amountInSen={spentSen} size="xl" numberOfLines={1} testID="summary-spent" />
        </View>
        <View className="flex-1 pl-3 border-l border-border/40">
          <Text className="text-xs font-semibold text-muted-foreground mb-1">Due by end of month</Text>
          <MoneyDisplay amountInSen={dueSen} size="xl" numberOfLines={1} testID="summary-due" />
        </View>
      </View>
    </BentoCard>
  );
}
