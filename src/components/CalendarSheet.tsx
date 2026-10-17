import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, geistWeights, useTheme } from '@/theme';
import { formatMonthLabel, toLocalDateString } from '@/utils/dates';
import { CalendarGrid, type CalendarGridProps } from './CalendarGrid';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

export interface CalendarSheetProps {
  visible: boolean;
  title: string;
  /** Currently selected ISO date (highlighted when it is in view). */
  value?: string | null;
  /** Month (YYYY-MM) to open on when no value — defaults to today's month. */
  initialMonth?: string;
  /** ISO `YYYY-MM-DD`; days before this are disabled. */
  minDate?: string;
  /** ISO `YYYY-MM-DD`; days after this are disabled. */
  maxDate?: string;
  /** Called with the picked `YYYY-MM-DD` — the sheet closes itself. */
  onSelect(iso: string): void;
  onCancel(): void;
}

export function CalendarSheet({
  visible,
  title,
  value,
  initialMonth,
  minDate,
  maxDate,
  onSelect,
  onCancel,
}: CalendarSheetProps) {
  const { colors } = useTheme();
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const anchor =
      (value && value >= '0001-01-01' && value) ||
      (initialMonth ? `${initialMonth}-01` : toLocalDateString());
    return { year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) };
  });

  const shiftMonth = (delta: number): void => {
    const total = view.year * 12 + (view.month - 1) + delta;
    setView({ year: Math.floor(total / 12), month: (total % 12) + 1 });
  };

  /** Year jump — reaching a date a year away shouldn't take twelve taps. */
  const shiftYear = (delta: number): void => {
    setView((current) => ({ year: current.year + delta, month: current.month }));
  };

  if (!visible) return null;

  const gridProps: CalendarGridProps = {
    year: view.year,
    month: view.month,
    value,
    minDate,
    maxDate,
    onSelect,
  };

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      showClose
      closeLabel="Close calendar"
      titleTestID="calendar-sheet-title"
      closeButtonTestID="calendar-sheet-close"
      cardTestID="calendar-sheet"
    >
      {/* Month + year navigator */}
      <View style={[styles.monthBar, { backgroundColor: colors.fill }]}>
        <Pressable
          onPress={() => shiftYear(-1)}
          style={styles.monthArrow}
          accessibilityRole="button"
          accessibilityLabel="Previous year"
          testID="calendar-prev-year"
        >
          <Ionicons name="play-skip-back" size={16} color={colors.textTertiary} />
        </Pressable>
        <Pressable
          onPress={() => shiftMonth(-1)}
          style={styles.monthArrow}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="calendar-prev-month"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.text }]} testID="calendar-month-label">
          {formatMonthLabel(view.year, view.month)}
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          style={styles.monthArrow}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="calendar-next-month"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => shiftYear(1)}
          style={styles.monthArrow}
          accessibilityRole="button"
          accessibilityLabel="Next year"
          testID="calendar-next-year"
        >
          <Ionicons name="play-skip-forward" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>

      <CalendarGrid {...gridProps} />

      <View style={styles.cancelContainer}>
        <Button
          label="Cancel"
          variant="secondary"
          onPress={onCancel}
          testID="calendar-cancel"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  monthArrow: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  cancelContainer: {
    marginTop: 12,
  },
});