/**
 * CalendarSheet (plan 016 follow-up) — the themed bottom-sheet date picker
 * used by commitment dates. Replaces pure typing: tapping a date field opens
 * this sheet, so the keyboard never covers the input and dates are picked,
 * not typed. Values stay `YYYY-MM-DD` (the engine/DB contract); DD-MM-YYYY
 * display lives in the owning form (formatDDMMYYYY).
 *
 * The sheet is chrome only (title, close, month/year navigation, Cancel); the
 * actual calendar is the reusable CalendarGrid (responsive — fits any
 * screen width). The displayed month is captured at MOUNT — the owner
 * remounts per open via a `key` so every open anchors to value/today.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, radius, spacing, typography } from '@/theme';
import { formatMonthLabel, toLocalDateString } from '@/utils/dates';
import { CalendarGrid, type CalendarGridProps } from './CalendarGrid';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <Pressable
          style={styles.scrim}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close calendar"
        />
        <View style={styles.card} testID="calendar-sheet">
          <View style={styles.header}>
            <Text style={styles.title} testID="calendar-sheet-title">
              {title}
            </Text>
            <Pressable
              onPress={onCancel}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close calendar"
              testID="calendar-sheet-close"
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {/* Month + year navigator */}
          <View style={styles.monthBar}>
            <Pressable
              onPress={() => shiftYear(-1)}
              style={styles.monthArrow}
              accessibilityRole="button"
              accessibilityLabel="Previous year"
              testID="calendar-prev-year"
            >
              <Ionicons name="play-skip-back" size={16} color={colors.muted} />
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
            <Text style={styles.monthLabel} testID="calendar-month-label">
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
              <Ionicons name="play-skip-forward" size={16} color={colors.muted} />
            </Pressable>
          </View>

          <CalendarGrid {...gridProps} />

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="calendar-cancel"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  monthArrow: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  cancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.background,
  },
  cancelLabel: { color: colors.text, fontSize: typography.body, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});