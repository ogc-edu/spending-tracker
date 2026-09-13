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
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Account } from '@/db/schema';
import { formatSenInput, parseMoneyToSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';
import { MoneyInput } from './MoneyInput';
import { ACCOUNT_TYPE_ICONS } from './accountMeta';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

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
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={editing ? 'Edit allocation' : 'Add allocation'}
      titleTestID="payroll-allocation-title"
      closeLabel="Close"
      cardTestID="payroll-allocation-sheet"
    >
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
                    <Chip
                      key={account.id}
                      label={account.name}
                      icon={ACCOUNT_TYPE_ICONS[account.type as keyof typeof ACCOUNT_TYPE_ICONS] as never}
                      iconColor={colors.muted}
                      selected={selected}
                      disabled={saving || editing != null}
                      onPress={() => setAccountId(account.id)}
                      testID={`payroll-allocation-account-${account.id}`}
                    />
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
          <Button
            label="Save allocation"
            variant="primary"
            busy={saving}
            disabled={saving}
            onPress={() => void save()}
            testID="payroll-allocation-save"
          />
        ) : null}
        <Button
          label="Cancel"
          variant="secondary"
          disabled={saving}
          onPress={onCancel}
          testID="payroll-allocation-cancel"
        />
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  fieldError: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.caption },
});
