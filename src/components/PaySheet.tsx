import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Account } from '@/db/schema';
import { CreditBillService } from '@/services/CreditBillService';
import { OptionTile } from '@/components/ui/OptionTile';
import { type AccountCardType } from '@/components/ui/AccountSwatch';
import { Sheet } from '@/components/ui/Sheet';
import { MoneyInput } from '@/components/MoneyInput';
import { useToast } from '@/components/ToastProvider';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { formatSen, formatSenInput, parseMoneyToSen } from '@/utils/money';
import { todayLocal } from '@/utils/dates';
import { haptics } from '@/utils/haptics';

export interface PaySheetAccount {
  id: number;
  name: string;
  type: string;
}

export interface PaySheetBill {
  year: number;
  month: number;
  label: string;
  outstandingSen: number;
}

export interface PaySheetProps {
  visible: boolean;
  onClose: () => void;
  account: PaySheetAccount | null;
  bill: PaySheetBill | null;
  sourceAccounts: Account[];
  creditBillService?: CreditBillService;
  onPaySuccess?: () => void;
  testID?: string;
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PaySheet({
  visible,
  onClose,
  account,
  bill,
  sourceAccounts,
  creditBillService,
  onPaySuccess,
  testID,
}: PaySheetProps) {
  const { colors } = useTheme();
  const toast = useToast();

  const nonCreditSources = sourceAccounts.filter(
    (a) => a.type === 'bank' || a.type === 'cash' || a.type === 'ewallet',
  );

  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(
    () => nonCreditSources[0]?.id ?? null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [amountString, setAmountString] = useState(() =>
    bill ? formatSenInput(bill.outstandingSen) : '',
  );
  const [submitting, setSubmitting] = useState(false);

  // Sync state on open / bill change
  useEffect(() => {
    if (visible && bill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmountString(formatSenInput(bill.outstandingSen));
      setIsEditing(false);
      if (nonCreditSources.length > 0) {
        setSelectedSourceId(nonCreditSources[0]!.id);
      } else {
        setSelectedSourceId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, bill]);

  if (!account || !bill) return null;

  let amountSen = 0;
  try {
    amountSen = parseMoneyToSen(amountString || '0');
  } catch {
    amountSen = 0;
  }

  const exceedsOutstanding = amountSen > bill.outstandingSen;
  const canPay =
    !submitting &&
    selectedSourceId !== null &&
    amountSen > 0 &&
    !exceedsOutstanding &&
    creditBillService != null;

  const handlePay = async () => {
    if (!canPay || !selectedSourceId || !creditBillService) return;
    setSubmitting(true);
    try {
      await creditBillService.payBill({
        accountId: account.id,
        billYear: bill.year,
        billMonth: bill.month,
        amountSen,
        fromAccountId: selectedSourceId,
        paidDate: todayLocal(),
      });
      haptics.paymentSuccess();
      toast.show('Bill paid');
      onPaySuccess?.();
      onClose();
    } catch (error: unknown) {
      toast.show(`Could not pay bill: ${errMsg(error)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      cardTestID={testID ?? 'pay-sheet'}
    >
      <View style={styles.content}>
        {/* Caption */}
        <Text
          numberOfLines={1}
          style={[styles.caption, { color: colors.textSecondary }]}
          testID="pay-sheet-caption"
        >
          {account.name} · {bill.label}
        </Text>

        {/* Amount */}
        {isEditing ? (
          <View style={styles.moneyInputContainer}>
            <MoneyInput
              value={amountString}
              onChangeValue={(next) => setAmountString(next)}
              autoFocus
              testID="pay-sheet-money-input"
            />
            {exceedsOutstanding ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                Amount cannot exceed bill total ({formatSen(bill.outstandingSen)})
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setIsEditing(true)}
            accessibilityRole="button"
            accessibilityLabel={`Amount to pay: ${formatSen(amountSen)}. Tap to edit.`}
            testID="pay-sheet-amount-tap"
            style={styles.amountTouchable}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[styles.amountSheet, { color: colors.text }]}
              testID="pay-sheet-amount"
            >
              {formatSen(amountSen)}
            </Text>
          </Pressable>
        )}

        {/* Explanation */}
        <Text style={[styles.explanation, { color: colors.textTertiary }]}>
          Moves money from your account to {account.name}. No new expense — the purchases were already counted.
        </Text>

        {/* Pay From section */}
        <View style={styles.payFromSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Pay from
          </Text>

          <View style={styles.sourcesGrid}>
            {nonCreditSources.length === 0 ? (
              <Text style={[styles.noSourcesText, { color: colors.textTertiary }]}>
                No bank, cash, or e-wallet account available.
              </Text>
            ) : (
              nonCreditSources.map((src) => (
                <View key={src.id} style={styles.sourceCol}>
                  <OptionTile
                    name={src.name}
                    kind={formatSen(src.balanceSen)}
                    accountType={src.type as AccountCardType}
                    selected={selectedSourceId === src.id}
                    onPress={() => setSelectedSourceId(src.id)}
                    testID={`pay-from-account-${src.id}`}
                  />
                </View>
              ))
            )}
          </View>
        </View>

        {/* Buttons row */}
        <View style={styles.buttonsRow}>
          <Pressable
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="pay-sheet-cancel"
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: colors.fillStrong },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={handlePay}
            disabled={!canPay}
            accessibilityRole="button"
            accessibilityLabel={`Pay ${formatSen(amountSen)}`}
            testID="pay-sheet-confirm"
            style={({ pressed }) => [
              styles.payButton,
              { backgroundColor: colors.accent },
              !canPay && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.payButtonText, { color: colors.onAccent }]}
            >
              {submitting ? 'Paying...' : `Pay ${formatSen(amountSen)}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  amountTouchable: {
    alignSelf: 'flex-start',
    minHeight: 40,
    justifyContent: 'center',
  },
  amountSheet: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.68,
    fontVariant: tabularNumsVariant,
  },
  moneyInputContainer: {
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  explanation: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  payFromSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  sourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceCol: {
    flex: 1,
    minWidth: 140,
  },
  noSourcesText: {
    fontSize: 13,
    lineHeight: 18,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  payButton: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
