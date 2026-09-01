/**
 * ScheduleRow (plan 008 UI) — one derived payment slot in the commitment
 * detail. Upcoming rows show the due date (overdue highlighted in danger,
 * never hidden) and a Mark paid action; paid rows show the linked expense
 * (paid date + paying account) and the Un-pay action (E7's counterpart).
 * Pure presentation — money is formatted via formatSen, never computed here.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CommitmentPayment } from '@/db/schema';
import type { ScheduledPayment } from '@/engine/commitments';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export interface ScheduleRowProps {
  slot: ScheduledPayment;
  /** Paid record when this slot has been paid (null = upcoming). */
  payment?: CommitmentPayment;
  /** Display name of the paying account (from the linked expense). */
  accountName?: string;
  /** dueDate is in the past (UI-side flag — the engine never knows "today"). */
  overdue: boolean;
  /** Mark-paid is enabled only for active, non-cancelled, non-archived commitments. */
  canMarkPaid: boolean;
  busy: boolean;
  onMarkPaid(slot: ScheduledPayment): void;
  onUnPay(payment: CommitmentPayment): void;
}

export function ScheduleRow({
  slot,
  payment,
  accountName,
  overdue,
  canMarkPaid,
  busy,
  onMarkPaid,
  onUnPay,
}: ScheduleRowProps) {
  if (payment) {
    return (
      <View style={[styles.row, styles.paidRow]} testID="schedule-row-paid">
        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={styles.amount}>{formatSen(payment.amountSen)}</Text>
            <Text style={styles.paidLabel}>Paid</Text>
          </View>
          <Text style={styles.meta}>
            {formatDayLabel(payment.dueDate)} · paid {formatDayLabel(payment.paidDate ?? payment.dueDate)}
            {accountName ? ` · ${accountName}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => onUnPay(payment)}
          disabled={busy}
          style={({ pressed }) => [styles.unpay, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="schedule-row-unpay"
        >
          <Ionicons name="arrow-undo-outline" size={14} color={colors.danger} />
          <Text style={styles.unpayLabel}>Un-pay</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row} testID="schedule-row-upcoming">
      <Ionicons name="calendar-outline" size={18} color={overdue ? colors.danger : colors.muted} />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={styles.amount}>{formatSen(slot.amountSen)}</Text>
          <Text style={[styles.dueLabel, overdue && styles.overdueLabel]}>
            {formatDayLabel(slot.dueDate)}
          </Text>
        </View>
        {overdue ? (
          <Text style={styles.overdueBadge} testID="schedule-row-overdue">
            Overdue
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onMarkPaid(slot)}
        disabled={busy || !canMarkPaid}
        style={({ pressed }) => [
          styles.markPaid,
          (!canMarkPaid || busy) && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        testID="schedule-row-mark-paid"
      >
        <Ionicons name="checkmark" size={14} color="#fff" />
        <Text style={styles.markPaidLabel}>Mark paid</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  paidRow: { backgroundColor: colors.surface },
  body: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  amount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  paidLabel: { fontSize: typography.caption, color: colors.accent, fontWeight: '700' },
  dueLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600' },
  overdueLabel: { color: colors.danger, fontWeight: '700' },
  meta: { fontSize: typography.caption, color: colors.muted, marginTop: spacing.xs },
  overdueBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.xs,
  },
  markPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  markPaidLabel: { color: '#fff', fontSize: typography.caption, fontWeight: '700' },
  unpay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.dangerSoft,
  },
  unpayLabel: { color: colors.danger, fontSize: typography.caption, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.7 },
});