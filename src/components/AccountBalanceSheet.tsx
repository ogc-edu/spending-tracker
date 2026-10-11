import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Account } from '@/db/schema';
import { formatSen, formatSenInput, parseMoneyToSen } from '@/utils/money';
import { geistWeights, useTheme } from '@/theme';
import { MoneyInput } from './MoneyInput';
import { Sheet } from '@/components/ui/Sheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextLinkButton } from '@/components/ui/TextLinkButton';

export interface AccountBalanceSheetProps {
  /** The account being edited; null closes the sheet. */
  account: Account | null;
  /** Called with the new balance in sen — the owner persists and closes. */
  onSave: (balanceSen: number) => Promise<void> | void;
  onCancel: () => void;
}

export function AccountBalanceSheet({
  account,
  onSave,
  onCancel,
}: AccountBalanceSheetProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState(() =>
    account ? formatSenInput(account.balanceSen) : '0.00',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!account) return null;

  const isOwed = account.type === 'credit_card' || account.type === 'paylater';

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
    <Sheet
      visible={account !== null}
      onClose={close}
      title={isOwed ? 'Adjust amount owed' : 'Adjust balance'}
      titleTestID="account-balance-title"
      cardTestID="account-balance-sheet"
    >
      <View style={styles.container}>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: colors.textSecondary }]}
          testID="account-balance-subtitle"
        >
          {account.name} · now {formatSen(account.balanceSen)}
        </Text>

        <Text
          style={[styles.label, { color: colors.text }]}
          nativeID="account-balance-label"
        >
          {isOwed ? 'New amount owed' : 'New balance'}
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
          accessibilityLabel={isOwed ? 'New amount owed in ringgit' : 'New balance in ringgit'}
          accessibilityLabelledBy="account-balance-label"
          testID="account-balance-input"
        />

        {error ? (
          <Text
            style={[styles.fieldError, { color: colors.danger }]}
            testID="account-balance-error"
          >
            {error}
          </Text>
        ) : null}

        <Text style={[styles.note, { color: colors.textTertiary }]}>
          This corrects the recorded figure only — your expenses and their history stay as they are.
        </Text>

        <View style={styles.actions}>
          <PrimaryButton
            label="Save"
            loading={saving}
            disabled={saving}
            onPress={() => void save()}
            testID="account-balance-save"
          />
          <TextLinkButton
            label="Cancel"
            disabled={saving}
            onPress={close}
            testID="account-balance-cancel"
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.medium,
  },
  label: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    marginTop: 8,
  },
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.medium,
    marginTop: 4,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
    marginTop: 4,
    marginBottom: 8,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
});
