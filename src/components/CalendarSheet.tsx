/**
 * CalendarSheet (plan 016 follow-up) — the aesthetic calendar date picker
 * for commitment dates. Replaces pure typing: tapping a date field opens
 * this themed bottom-sheet month calendar, so the keyboard never covers the
 * field (the "keyboard blocks the input" complaint) and dates are picked,
 * not typed. Values stay `YYYY-MM-DD` (the engine/DB contract); display is
 * DD-MM-YYYY via formatDDMMYYYY in the owning form.
 *
 * - Week starts MONDAY (plan 006 `weekStartLocal` convention).
 * - Month navigation via ≥44pt chevron targets; day cells ≥44pt.
 * - Days outside [minDate, maxDate] are disabled (ISO strings compare
 *   lexicographically, so the component never needs Date math for bounds).
 * - `monthGrid` is exported pure so tests can pin the Monday-start layout
 *   (leading nulls + exact day strings).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, radius, spacing, typography } from '@/theme';
import { daysInMonth, formatMonthLabel, toLocalDateString } from '@/utils/dates';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * The month grid as a flat `YYYY-MM-DD` array with null leading/trailing
 * cells so the first of the month lands on Monday's column and the row count
 * is a whole number of weeks. Pure — tests pin the layout.
 */
export function monthGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0 = Sun
  const lead = (firstDow + 6) % 7; // Monday-start offset (Sun gets 6)
  const dim = daysInMonth(year, month);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= dim; day += 1) {
    cells.push(`${year}-${pad(month)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

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
  // The displayed month is captured at MOUNT (the parent remounts the sheet
  // per open via a `key`, so every open anchors to value/today — no effect
  // needed to resync state with props).
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

  const isToday = (iso: string): boolean => iso === toLocalDateString();
  const isSelected = (iso: string): boolean => iso === value;
  const isDisabled = (iso: string): boolean =>
    (minDate !== undefined && iso < minDate) || (maxDate !== undefined && iso > maxDate);

  if (!visible) return null;

  const cells = monthGrid(view.year, view.month);

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

          {/* Month navigator */}
          <View style={styles.monthBar}>
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
          </View>

          {/* Weekday header (Monday-first) */}
          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={styles.weekLabel}>
                {label}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((iso, index) =>
              iso === null ? (
                <View key={`blank-${index}`} style={styles.dayCell} />
              ) : (
                <Pressable
                  key={iso}
                  onPress={() => onSelect(iso)}
                  disabled={isDisabled(iso)}
                  style={[styles.dayCell, isSelected(iso) && styles.daySelected, isToday(iso) && styles.dayToday]}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(iso.slice(8, 10))} ${formatMonthLabel(view.year, view.month)}`}
                  accessibilityState={{ selected: isSelected(iso), disabled: isDisabled(iso) }}
                  testID={`calendar-day-${iso}`}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected(iso) && styles.dayTextSelected,
                      isToday(iso) && styles.dayTextToday,
                      isDisabled(iso) && styles.dayTextDisabled,
                    ]}
                  >
                    {Number(iso.slice(8, 10))}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

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

const DAY_SIZE = (1080 - spacing.xl * 2) / 7; // full-width grid on phones

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
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.accent },
  daySelected: { backgroundColor: colors.accent },
  dayText: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  dayTextSelected: { color: colors.surface, fontWeight: '700' },
  dayTextToday: { color: colors.accent, fontWeight: '700' },
  dayTextDisabled: { color: colors.border, fontWeight: '400' },
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