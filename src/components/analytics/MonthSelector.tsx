/**
 * MonthSelector (Plan 007 / AN-4) — Month-over-Month cycle stepper for Analytics.
 * Driven by the shared uiStore selection (ARCH §5).
 * Tabular-nums typography, 44px mobile touch affordances, and preserved test contracts:
 *  - testID="analytics-month-bar"
 *  - testID="analytics-month-prev"
 *  - testID="analytics-month-next"
 *  - testID="analytics-month-label"
 */
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MonthSelection } from '@/store/uiStore';
import { formatMonthLabel } from '@/utils/dates';
import { TouchTarget } from '@/components/ui/TouchTarget';
import { colors } from '@/theme';

export function MonthSelector({
  month,
  onChange,
}: {
  month: MonthSelection;
  onChange(next: MonthSelection): void;
}) {
  const shift = (delta: number) => {
    const total = month.year * 12 + (month.month - 1) + delta;
    onChange({ month: (total % 12) + 1, year: Math.floor(total / 12) });
  };

  return (
    <View
      className="flex-row items-center justify-between px-4 py-2.5 bg-card border-b border-border/60"
      testID="analytics-month-bar"
    >
      <TouchTarget
        minHeight={44}
        onPress={() => shift(-1)}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        testID="analytics-month-prev"
      >
        <Ionicons name="chevron-back" size={22} color={colors.accent} />
      </TouchTarget>
      <View className="bg-primary/10 border border-primary/20 rounded-full py-1.5 px-4">
        <Text
          className="text-base font-extrabold text-primary tracking-tight font-mono"
          style={{ fontVariant: ['tabular-nums'] }}
          testID="analytics-month-label"
        >
          {formatMonthLabel(month.year, month.month)}
        </Text>
      </View>
      <TouchTarget
        minHeight={44}
        onPress={() => shift(1)}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        testID="analytics-month-next"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.accent} />
      </TouchTarget>
    </View>
  );
}
