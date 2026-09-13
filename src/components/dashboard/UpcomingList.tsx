/**
 * UpcomingList (plan 010 DASH-1/10, PRD COM-5; restyled by plan 017) — the
 * next unpaid commitments due before next-month start: up to 3 slots plus a
 * total-due line. Items arrive from CashFlowService already sorted by due
 * date; names come from the DB rows (UpcomingSnapshotItem).
 *
 * Plan 017: per-row leading icon circles (per-type glyphs), and an OVERDUE
 * tone — a due date in the past gets the danger color + an "Overdue" badge,
 * mirroring the commitments tab's urgency language. The engine's snapshot
 * already carries the data; "overdue" here is the same presentation
 * comparison the commitments tab makes (dueDate < today, local strings).
 *
 * Empty state ("Nothing due before next month") is a first-class message, not
 * an error (plan §Edge cases).
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UpcomingSnapshotItem } from '@/services/CashFlowService';
import { formatDayLabel, todayLocal } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

/** Per-kind glyph for the leading circle (plan 017 — data from the snapshot). */
const KIND_ICONS = {
  monthly: 'repeat-outline',
  one_time: 'flag-outline',
} as const;
const DEFAULT_KIND_ICON: keyof typeof Ionicons.glyphMap = 'calendar-outline';

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
  const today = todayLocal();
  return (
    <Card testID="upcoming-card">
      <Text style={styles.title}>Upcoming</Text>

      {items.length === 0 ? (
        <Text style={styles.empty} testID="upcoming-empty">
          Nothing due before next month
        </Text>
      ) : (
        <>
          {items.slice(0, 3).map((item) => {
            const overdue = item.dueDate < today;
            return (
              <View key={`${item.commitmentId}:${item.dueDate}`} style={styles.row}>
                <View style={[styles.iconWrap, overdue && styles.iconWrapOverdue]}>
                  <Ionicons
                    name={(KIND_ICONS[item.frequency] ?? DEFAULT_KIND_ICON) as never}
                    size={18}
                    color={overdue ? colors.danger : colors.accent}
                  />
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.dateRow}>
                    {overdue ? <Badge tone="danger" label="Overdue" /> : null}
                    <Text style={[styles.date, overdue && styles.dateOverdue]}>
                      {formatDayLabel(item.dueDate)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.amount, overdue && styles.amountOverdue]}
                  numberOfLines={1}
                  accessibilityLabel={`${item.name}, ${spokenMoneyLabel(item.amountSen)}`}
                >
                  {formatSen(item.amountSen)}
                </Text>
              </View>
            );
          })}
          <View style={styles.footer} testID="upcoming-total">
            <Text style={styles.footerLabel}>Due before {dueBeforeLabel}</Text>
            <Text style={styles.footerAmount} numberOfLines={1} accessibilityLabel={`Due before ${dueBeforeLabel}, ${spokenMoneyLabel(totalSen)}`}>
              {formatSen(totalSen)}
            </Text>
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOverdue: { backgroundColor: colors.dangerSoft },
  rowMain: { flex: 1, marginRight: spacing.xs },
  name: { fontSize: typography.body, fontWeight: '600', color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  date: { fontSize: typography.caption, color: colors.muted, fontWeight: '500' },
  dateOverdue: { color: colors.danger, fontWeight: '600' },
  amount: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    fontVariant: moneyFontVariant,
    flexShrink: 1,
    marginLeft: spacing.sm,
  },
  amountOverdue: { color: colors.danger },
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
