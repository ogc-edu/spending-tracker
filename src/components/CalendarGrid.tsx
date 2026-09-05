/**
 * CalendarGrid (plan 016 follow-up) — the REUSABLE month-grid calendar:
 * weekday header (Monday-first, plan 006) + responsive day cells. Consumed
 * by CalendarSheet (and any future inline picker — e.g. a committed date
 * range). Pure presentation + the exported `monthGrid` math; no modal, no
 * navigation chrome (the owner provides those).
 *
 * Responsive sizing: cells are `width: 100/7%` + aspectRatio 1 — the grid
 * ALWAYS fits its parent's width (the earlier fixed-pixel DAY_SIZE broke on
 * narrow phones, spilling a full-page-wide grid with a few stray day
 * numbers). Days outside [minDate, maxDate] are disabled (ISO strings
 * compare lexicographically — no Date math needed for bounds).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { daysInMonth, formatMonthLabel, todayLocal } from '@/utils/dates';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** One column's width share — 7 columns → 100/7%. */
const COLUMN_WIDTH = `${100 / 7}%`;

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

export interface CalendarGridProps {
  year: number;
  month: number;
  /** Currently selected ISO date (highlighted when it is in view). */
  value?: string | null;
  /** ISO `YYYY-MM-DD`; days before this are disabled. */
  minDate?: string;
  /** ISO `YYYY-MM-DD`; days after this are disabled. */
  maxDate?: string;
  /** Called with the picked `YYYY-MM-DD`. */
  onSelect(iso: string): void;
}

export function CalendarGrid({ year, month, value, minDate, maxDate, onSelect }: CalendarGridProps) {
  const todayIso = todayLocal();
  const monthLabel = formatMonthLabel(year, month);

  const isToday = (iso: string): boolean => iso === todayIso;
  const isSelected = (iso: string): boolean => iso === value;
  const isDisabled = (iso: string): boolean =>
    (minDate !== undefined && iso < minDate) || (maxDate !== undefined && iso > maxDate);

  const cells = monthGrid(year, month);

  return (
    <View>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>
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
              accessibilityLabel={`${Number(iso.slice(8, 10))} ${monthLabel}`}
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
    </View>
  );
}

const styles = StyleSheet.create({
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: { width: COLUMN_WIDTH, textAlign: 'center', fontSize: typography.caption, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: COLUMN_WIDTH,
    aspectRatio: 1,
    minHeight: 44, // touch target floor (plan 016 a11y)
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
});