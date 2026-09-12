/**
 * PayrollAllocationSheet — set how much of a payroll goes into one account.
 * Pick the account (chips), then the amount through the same POS MoneyInput
 * as everywhere else. Used for both adding a slice and editing one: pass the
 * existing line and the account is fixed and the amount prefilled.
 *
 * The sheet lifts itself above the soft keyboard (useKeyboardInset), so the
 * amount stays visible while it is being typed.
 *
 * Credit cards are not offered — their balance is money OWED, so a payroll
 * "deposit" into one would mean taking on debt. The service refuses them too;
 * this just keeps the impossible choice off the screen.
 */
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Account } from '@/db/schema';
import { formatSenInput, parseMoneyToSen } from '@/utils/money';
import { colors, radius, spacing, typography } from '@/theme';
import { useKeyboardInset } from './keyboardInset';
import { MoneyInput } from './MoneyInput';
import { ACCOUNT_TYPE_ICONS } from './accountMeta';

export interface PayrollAllocationSheetProps {
  visible: boolean;
  /** Accounts that may receive payroll (credit cards already filtered out). */
  accounts: Account[];
  /** Editing an existing slice: the account is fixed and the amount prefilled. */
  editing?: { accountId: number; amountSen: number } | null;
  onSave(accountId: number, amountSen: number): Promise<void> | void;
  onCancel(): void;
}

export function PayrollAllocationSheet({
  visible,
  accounts,
  editing,
  onSave,
  onCancel,
}: PayrollAllocationSheetProps) {
  const [accountId, setAccountId] = useState<number | null>(editing?.accountId ?? accounts[0]?.id ?? null);
  const [amount, setAmount] = useState(() => formatSenInput(editing?.amountSen ?? 0));
  const [error, setError] = useState<string | null>(null);
  // The sheet is bottom-anchored, so the keyboard's covered strip becomes the
  // overlay's bottom padding: the card rides up by exactly the keyboard height.
  const overlayRef = useRef<View>(null);
  const keyboardInset = useKeyboardInset(overlayRef);
  const [saving, setSaving] = useState(false);

  if (!visible) return null;

  const save = async (): Promise<void> => {
    if (accountId === null) {
      setError('Choose an account');
      return;
    }
    let amountSen: number;
    try {
      amountSen = parseMoneyToSen(amount);
    } catch {
      setError('Enter a valid amount');
      return;
    }
    if (amountSen <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(accountId, amountSen);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel} accessibilityViewIsModal>
      <View ref={overlayRef} style={[styles.overlay, { paddingBottom: keyboardInset }]} collapsable={false}>
        <Pressable style={styles.scrim} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.card} testID="payroll-allocation-sheet">
          <Text style={styles.title} testID="payroll-allocation-title">
            {editing ? 'Edit allocation' : 'Add allocation'}
          </Text>
          <Text style={styles.subtitle}>Part of each payroll that lands in this account.</Text>

          {accounts.length === 0 ? (
            <Text style={styles.empty} testID="payroll-allocation-no-accounts">
              Add a cash, bank or e-wallet account first — payroll cannot go into a credit card.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Account</Text>
              <View style={styles.chipWrap}>
                {accounts.map((account) => {
                  const selected = accountId === account.id;
                  const fixed = editing != null && editing.accountId !== account.id;
                  if (fixed) return null; // editing a slice never re-targets it
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => setAccountId(account.id)}
                      disabled={saving || editing != null}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      testID={`payroll-allocation-account-${account.id}`}
                    >
                      <Ionicons
                        name={ACCOUNT_TYPE_ICONS[account.type as keyof typeof ACCOUNT_TYPE_ICONS] as never}
                        size={15}
                        color={selected ? colors.surface : colors.muted}
                      />
                      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                        {account.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label} nativeID="payroll-allocation-label-amount">
                Amount per payroll
              </Text>
              <MoneyInput
                value={amount}
                onChangeValue={(next) => {
                  setAmount(next);
                  setError(null);
                }}
                hasError={error !== null}
                editable={!saving}
                autoFocus
                accessibilityLabel="Payroll amount in ringgit"
                accessibilityLabelledBy="payroll-allocation-label-amount"
                testID="payroll-allocation-amount"
              />
            </>
          )}

          {error ? (
            <Text style={styles.fieldError} testID="payroll-allocation-error">
              {error}
            </Text>
          ) : null}

          {accounts.length > 0 ? (
            <Pressable
              onPress={() => void save()}
              style={[styles.save, saving && styles.buttonDisabled]}
              disabled={saving}
              accessibilityRole="button"
              testID="payroll-allocation-save"
            >
              <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save allocation'}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onCancel}
            style={styles.cancel}
            disabled={saving}
            accessibilityRole="button"
            testID="payroll-allocation-cancel"
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
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.caption, color: colors.muted, marginTop: 2 },
  empty: { fontSize: typography.body, color: colors.muted, marginTop: spacing.lg, lineHeight: 20 },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.lg,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  chipLabelSelected: { color: colors.surface },
  fieldError: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.caption },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  saveLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  cancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.background,
  },
  cancelLabel: { color: colors.muted, fontSize: typography.emphasis, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});
