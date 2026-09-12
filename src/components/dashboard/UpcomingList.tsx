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
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

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
              <Text style={styles.amount} numberOfLines={1} accessibilityLabel={`${item.name}, ${spokenMoneyLabel(item.amountSen)}`}>
                {formatSen(item.amountSen)}
              </Text>
            </View>
          ))}
          <View style={styles.footer} testID="upcoming-total">
            <Text style={styles.footerLabel}>Due before {dueBeforeLabel}</Text>
            <Text style={styles.footerAmount} numberOfLines={1} accessibilityLabel={`Due before ${dueBeforeLabel}, ${spokenMoneyLabel(totalSen)}`}>
              {formatSen(totalSen)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: { flex: 1, marginRight: spacing.md },
  name: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  date: { fontSize: typography.caption, color: colors.muted, marginTop: 2, fontWeight: '500' },
  amount: { fontSize: typography.body, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  footerLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '500' },
  footerAmount: { fontSize: typography.emphasis, fontWeight: '800', color: colors.text, fontVariant: moneyFontVariant, flexShrink: 1, marginLeft: spacing.md },
});
