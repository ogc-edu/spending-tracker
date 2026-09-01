/**
 * UpcomingList (plan 010 DASH-1/10, PRD COM-5) — the next unpaid commitments
 * due before next-month start: up to 3 slots plus a total-due line. Items
 * arrive from CashFlowService already sorted by due date; names come from the
 * DB rows (UpcomingSnapshotItem).
 *
 * Empty state ("Nothing due before next month") is a first-class message, not
 * an error (plan §Edge cases).
 */
import { StyleSheet, Text, View } from 'react-native';
import type { UpcomingSnapshotItem } from '@/services/CashFlowService';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export function UpcomingList({
  items,
  totalSen,
  dueBeforeLabel,
}: {
  /** Unpaid slots, due-date ascending — show the first 3. */
  items: UpcomingSnapshotItem[];
  /** Σ of every item (incl. beyond the first 3) — the "total due" line. */
  totalSen: number;
  /** e.g. "01 Oct" — derived from next-month start by the screen. */
  dueBeforeLabel: string;
}) {
  return (
    <View style={styles.card} testID="upcoming-card">
      <Text style={styles.title}>Upcoming</Text>

      {items.length === 0 ? (
        <Text style={styles.empty} testID="upcoming-empty">
          Nothing due before next month
        </Text>
      ) : (
        <>
          {items.slice(0, 3).map((item) => (
            <View key={`${item.commitmentId}:${item.dueDate}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.date}>{formatDayLabel(item.dueDate)}</Text>
              </View>
              <Text style={styles.amount}>{formatSen(item.amountSen)}</Text>
            </View>
          ))}
          <View style={styles.footer} testID="upcoming-total">
            <Text style={styles.footerLabel}>Due before {dueBeforeLabel}</Text>
            <Text style={styles.footerAmount}>{formatSen(totalSen)}</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { fontSize: typography.body, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: { flex: 1, marginRight: spacing.md },
  name: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  date: { fontSize: typography.caption, color: colors.muted, marginTop: 2 },
  amount: { fontSize: typography.body, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  footerLabel: { fontSize: typography.caption, color: colors.muted },
  footerAmount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
});
