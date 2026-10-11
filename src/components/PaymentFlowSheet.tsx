import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/db/schema';
import type { ScheduledPayment } from '@/engine/commitments';
import type { AccountType } from '@/repositories/types';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { Sheet } from '@/components/ui/Sheet';
import { haptics } from '@/utils/haptics';

export interface PaymentFlowSheetProps {
  visible: boolean;
  slot: ScheduledPayment;
  accounts: Account[];
  /** Prefill: last-used account id from uiStore when present in `accounts`. */
  initialAccountId: number | null;
  busy: boolean;
  onConfirm(accountId: number | null): void;
  onCancel(): void;
}

export function PaymentFlowSheet({
  visible,
  slot,
  accounts,
  initialAccountId,
  busy,
  onConfirm,
  onCancel,
}: PaymentFlowSheetProps) {
  const { colors } = useTheme();
  const [selectedId, setSelectedId] = useState<number | null>(initialAccountId);
  const [prevVisible, setPrevVisible] = useState(visible);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSelectedId(initialAccountId);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Mark payment paid"
      cardTestID="payment-flow-sheet"
    >
      <View style={styles.content}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[styles.amount, { color: colors.text }]}
        >
          {formatSen(slot.amountSen)}
        </Text>
        <Text style={[styles.due, { color: colors.textSecondary }]}>
          Due {formatDayLabel(slot.dueDate)}
        </Text>

        <Text style={[styles.label, { color: colors.text }]}>
          Pay from account (optional)
        </Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          No account = no balance change. Credit cards count as owed.
        </Text>

        <View style={styles.chipWrap}>
          {accounts.map((account) => {
            const selected = selectedId === account.id;
            return (
              <Pressable
                key={account.id}
                onPress={() => setSelectedId(account.id)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.selectedBg : colors.fillStrong,
                    borderColor: selected ? colors.accent : colors.fillStrong,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`payment-flow-account-${account.id}`}
              >
                <Ionicons
                  name={ACCOUNT_TYPE_ICONS[account.type as AccountType] as never}
                  size={15}
                  color={selected ? colors.accent : colors.textSecondary}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipLabel,
                    { color: colors.text },
                  ]}
                >
                  {account.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipType,
                    { color: colors.textSecondary },
                  ]}
                >
                  {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setSelectedId(null)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selectedId === null ? colors.selectedBg : colors.fillStrong,
                borderColor: selectedId === null ? colors.accent : colors.fillStrong,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === null }}
            testID="payment-flow-account-none"
          >
            <Ionicons
              name="close-circle-outline"
              size={15}
              color={selectedId === null ? colors.accent : colors.textSecondary}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.chipLabel,
                { color: colors.text },
              ]}
            >
              No account
            </Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={busy}
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: colors.fillStrong },
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="payment-flow-cancel"
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptics.paymentSuccess();
              onConfirm(selectedId);
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: colors.accent },
              busy && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mark paid"
            testID="payment-flow-confirm"
          >
            <View style={styles.confirmInner}>
              <Ionicons name="checkmark" size={16} color={colors.onAccent} />
              <Text style={[styles.confirmBtnText, { color: colors.onAccent }]}>
                Mark paid
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  amount: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    fontVariant: tabularNumsVariant,
  },
  due: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginBottom: 6,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  chipLabel: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  chipType: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.75,
  },
});