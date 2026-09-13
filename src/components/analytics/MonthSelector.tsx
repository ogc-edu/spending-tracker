/**
 * MonthSelector (plan 011, AN-4) — the ‹ month › navigation bar for the
 * Analytics tab, driven by the SHARED uiStore selection (Budgets 007 +
 * Analytics 011, ARCH §5). No range limit: the shift formula
 * `year×12 + (month−1) + delta` rolls over years in both directions, so any
 * month with data is reachable. Navigation is the only job here — the
 * screen re-reads SQLite on month change.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MonthSelection } from '@/store/uiStore';
import { formatMonthLabel } from '@/utils/dates';
import { colors, spacing, typography } from '@/theme';

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
    <View style={styles.bar} testID="analytics-month-bar">
      <Pressable
        onPress={() => shift(-1)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        testID="analytics-month-prev"
      >
        <Ionicons name="chevron-back" size={22} color={colors.accent} />
      </Pressable>
      <View style={styles.labelPill}>
        <Text style={styles.label} testID="analytics-month-label">
          {formatMonthLabel(month.year, month.month)}
        </Text>
      </View>
      <Pressable
        onPress={() => shift(1)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        testID="analytics-month-next"
      >
        <Ionicons name="chevron-forward" size={22} color={colors.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: typography.emphasis, fontWeight: '700', color: colors.accent },
  labelPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
});
