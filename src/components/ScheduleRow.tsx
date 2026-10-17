import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CommitmentPayment } from '@/db/schema';
import type { ScheduledPayment } from '@/engine/commitments';
import { formatDayLabel } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

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
  const { colors } = useTheme();

  if (payment) {
    return (
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.separator,
          },
        ]}
        testID="schedule-row-paid"
      >
        <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text
              style={[
                styles.amount,
                { color: colors.text },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              accessibilityLabel={`Payment, ${spokenMoneyLabel(payment.amountSen)}`}
            >
              {formatSen(payment.amountSen)}
            </Text>
            <Text style={[styles.paidLabel, { color: colors.accent }]}>Paid</Text>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.meta, { color: colors.textTertiary }]}
          >
            {formatDayLabel(payment.dueDate)} · paid {formatDayLabel(payment.paidDate ?? payment.dueDate)}
            {accountName ? ` · ${accountName}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onUnPay(payment)}
          disabled={busy}
          activeOpacity={0.7}
          style={[
            styles.unpay,
            {
              borderColor: colors.danger,
              backgroundColor: colors.fillStrong,
            },
          ]}
          accessibilityRole="button"
          testID="schedule-row-unpay"
        >
          <Ionicons name="arrow-undo-outline" size={14} color={colors.danger} />
          <Text style={[styles.unpayLabel, { color: colors.danger }]}>Un-pay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.separator,
        },
      ]}
      testID="schedule-row-upcoming"
    >
      <Ionicons
        name="calendar-outline"
        size={18}
        color={overdue ? colors.danger : colors.textTertiary}
      />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text
            style={[
              styles.amount,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            accessibilityLabel={`Payment, ${spokenMoneyLabel(slot.amountSen)}`}
          >
            {formatSen(slot.amountSen)}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.dueLabel,
              { color: overdue ? colors.danger : colors.textSecondary },
              overdue && styles.overdueLabel,
            ]}
          >
            {formatDayLabel(slot.dueDate)}
          </Text>
        </View>
        {overdue ? (
          <Text
            style={[
              styles.overdueBadge,
              {
                color: colors.danger,
                backgroundColor: colors.fillStrong,
              },
            ]}
            testID="schedule-row-overdue"
          >
            Overdue
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onMarkPaid(slot)}
        disabled={busy || !canMarkPaid}
        activeOpacity={0.7}
        style={[
          styles.markPaid,
          {
            backgroundColor: colors.accent,
          },
          (!canMarkPaid || busy) && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        testID="mark-paid-button"
      >
        <View testID="schedule-row-mark-paid" style={styles.markPaidInner}>
          <Ionicons name="checkmark" size={14} color={colors.onAccent} />
          <Text
            style={[
              styles.markPaidLabel,
              { color: colors.onAccent },
            ]}
          >
            Mark paid
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    minHeight: 52,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amount: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    fontVariant: tabularNumsVariant,
  },
  paidLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  dueLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  overdueLabel: {
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '400',
  },
  overdueBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  markPaidInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markPaidLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  unpay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  unpayLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});