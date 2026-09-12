/**
 * AccountBalanceSheet — the "adjust balance" bottom sheet opened by tapping an
 * account row in Settings. One field: the new balance, entered through the same
 * POS-style MoneyInput as the expense amount (sen digits fill in from the
 * right), prefilled with the account's current figure.
 *
 * The sheet lifts itself above the soft keyboard (useKeyboardInset), so the
 * amount stays visible while it is being typed.
 *
 * This RESTATES the recorded balance; it is not a transaction. No expense is
 * written and no other row moves, so the account's history is untouched — the
 * copy says so, because "adjust" could reasonably be read either way. For a
 * credit card the figure is the amount OWED (higher = more debt), which is how
 * the row and the cash-flow engine already read it.
 */
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Account } from '@/db/schema';
import { formatSen, formatSenInput, parseMoneyToSen } from '@/utils/money';
import { colors, radius, spacing, typography } from '@/theme';
import { useKeyboardInset } from './keyboardInset';
import { MoneyInput } from './MoneyInput';

export interface AccountBalanceSheetProps {
  /** The account being edited; null closes the sheet. */
  account: Account | null;
  /** Called with the new balance in sen — the owner persists and closes. */
  onSave(balanceSen: number): Promise<void> | void;
  onCancel(): void;
}

export function AccountBalanceSheet({ account, onSave, onCancel }: AccountBalanceSheetProps) {
  // Prefilled with the current figure; the owner remounts the sheet per
  // account (`key`), so this initializer re-reads on every open.
  const [amount, setAmount] = useState(() =>
    account ? formatSenInput(account.balanceSen) : '0.00',
  );
  const [error, setError] = useState<string | null>(null);
  // The sheet is bottom-anchored, so the keyboard's covered strip becomes the
  // overlay's bottom padding: the card rides up by exactly the keyboard height.
  const overlayRef = useRef<View>(null);
  const keyboardInset = useKeyboardInset(overlayRef);
  const [saving, setSaving] = useState(false);

  if (!account) return null;

  const owed = account.type === 'credit_card';

  const close = (): void => {
    setError(null);
    setSaving(false);
    onCancel();
  };

  const save = async (): Promise<void> => {
    let balanceSen: number;
    try {
      balanceSen = parseMoneyToSen(amount);
    } catch {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(balanceSen);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close} accessibilityViewIsModal>
      <View ref={overlayRef} style={[styles.overlay, { paddingBottom: keyboardInset }]} collapsable={false}>
        <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
        {/* Remounted per account by the owner's `key`, so the prefill re-reads. */}
        <View style={styles.card} testID="account-balance-sheet">
          <Text style={styles.title} testID="account-balance-title">
            {owed ? 'Adjust amount owed' : 'Adjust balance'}
          </Text>
          <Text style={styles.subtitle} testID="account-balance-subtitle">
            {account.name} · now {formatSen(account.balanceSen)}
          </Text>

          <Text style={styles.label} nativeID="account-balance-label">
            {owed ? 'New amount owed' : 'New balance'}
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
            accessibilityLabel={owed ? 'New amount owed in ringgit' : 'New balance in ringgit'}
            accessibilityLabelledBy="account-balance-label"
            testID="account-balance-input"
          />
          {error ? (
            <Text style={styles.fieldError} testID="account-balance-error">
              {error}
            </Text>
          ) : null}

          <Text style={styles.note}>
            This corrects the recorded figure only — your expenses and their history stay as they are.
          </Text>

          <Pressable
            onPress={() => void save()}
            style={[styles.save, saving && styles.buttonDisabled]}
            disabled={saving}
            accessibilityRole="button"
            testID="account-balance-save"
          >
            <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
          <Pressable
            onPress={close}
            style={styles.cancel}
            disabled={saving}
            accessibilityRole="button"
            testID="account-balance-cancel"
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
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  note: { fontSize: typography.caption, color: colors.muted, marginTop: spacing.md, lineHeight: 18 },
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
