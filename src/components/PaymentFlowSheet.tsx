/**
 * PaymentFlowSheet (plan 008 UI) — the "Mark paid" flow: a bottom sheet that
 * confirms the slot (amount + due date) with an account picker. The account
 * is OPTIONAL (A15): picking one adjusts that account's balance (assets −,
 * credit +); "No account" records the payment without touching balances.
 * The parent prefills the selection (last-used account from uiStore, else the
 * first account) so marking paid costs one tap.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/db/schema';
import type { ScheduledPayment } from '@/engine/commitments';
import type { AccountType } from '@/repositories/types';
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS } from './accountMeta';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

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
  const [selectedId, setSelectedId] = useState<number | null>(initialAccountId);
  const [prevVisible, setPrevVisible] = useState(visible);

  // Re-seed the selection when the sheet opens for a slot (defaults may
  // change between openings). Adjusting state during render is the React
  // sanctioned pattern for "state derived from a prop transition" — the
  // effect-based alternative is flagged by react-hooks.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSelectedId(initialAccountId);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet} testID="payment-flow-sheet">
          <Text style={styles.title}>Mark payment paid</Text>
          <Text style={styles.amount}>{formatSen(slot.amountSen)}</Text>
          <Text style={styles.due}>Due {formatDayLabel(slot.dueDate)}</Text>
          <Text style={styles.label}>Pay from account (optional)</Text>
          <Text style={styles.hint}>No account = no balance change. Credit cards count as owed.</Text>
          <View style={styles.chipWrap}>
            {accounts.map((account) => {
              const selected = selectedId === account.id;
              return (
                <Pressable
                  key={account.id}
                  onPress={() => setSelectedId(account.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`payment-flow-account-${account.id}`}
                >
                  <Ionicons
                    name={ACCOUNT_TYPE_ICONS[account.type as AccountType] as never}
                    size={15}
                    color={selected ? colors.surface : colors.muted}
                  />
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{account.name}</Text>
                  <Text style={[styles.chipType, selected && styles.chipTypeSelected]}>
                    {ACCOUNT_TYPE_LABELS[account.type as AccountType]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setSelectedId(null)}
              style={[styles.chip, selectedId === null && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedId === null }}
              testID="payment-flow-account-none"
            >
              <Ionicons
                name="close-circle-outline"
                size={15}
                color={selectedId === null ? colors.surface : colors.muted}
              />
              <Text style={[styles.chipLabel, selectedId === null && styles.chipLabelSelected]}>No account</Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => onConfirm(selectedId)}
              disabled={busy}
              style={[styles.confirm, busy && styles.buttonDisabled]}
              accessibilityRole="button"
              testID="payment-flow-confirm"
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.confirmLabel}>Mark paid</Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={styles.cancel}
              accessibilityRole="button"
              testID="payment-flow-cancel"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  amount: { fontSize: typography.money, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant },
  due: { fontSize: typography.body, color: colors.muted, marginBottom: spacing.lg },
  label: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  hint: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '700' },
  chipLabelSelected: { color: colors.surface },
  chipType: { fontSize: typography.caption, color: colors.muted },
  chipTypeSelected: { color: colors.surface },
  actions: { flexDirection: 'row', gap: spacing.md },
  confirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
  },
  confirmLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '700' },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelLabel: { color: colors.muted, fontSize: typography.emphasis, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
});