import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  accountCardColor,
  geistWeights,
  onCard,
  tabularNumsVariant,
  useTheme,
} from '@/theme';
import type { AccountCardType } from './AccountSwatch';

export interface CreditBillItem {
  id: string;
  title: string;
  meta: string;
  amountText: string;
  status: 'unpaid' | 'paid' | 'open';
}

export interface CreditAccountCardProps {
  account: {
    name: string;
    type: AccountCardType;
    /** Shade within the type's family — from `accountShades()`. */
    shade?: number;
    cycleText?: string;
    owedText: string;
  };
  bills: readonly CreditBillItem[] | CreditBillItem[];
  onPay?: (billId: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function CreditAccountCard({
  account,
  bills,
  onPay,
  style,
  testID,
}: CreditAccountCardProps) {
  const { scheme } = useTheme();

  const cardBg = accountCardColor(account.type, scheme, account.shade ?? 0);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
        },
        style,
      ]}
      testID={testID}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            numberOfLines={1}
            style={[styles.accountName, { color: onCard.text }]}
          >
            {account.name}
          </Text>
          {account.cycleText ? (
            <Text
              numberOfLines={1}
              style={[
                styles.cycleText,
                { color: onCard.text, opacity: onCard.textSoftOpacity },
              ]}
            >
              {account.cycleText}
            </Text>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={[styles.owedAmount, { color: onCard.text }]}
          >
            {account.owedText}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.owedLabel,
              { color: onCard.text, opacity: onCard.textSoftOpacity },
            ]}
          >
            Owed
          </Text>
        </View>
      </View>

      {/* Bill Rows */}
      <View style={styles.billsList}>
        {bills.map((bill) => (
          <View
            key={bill.id}
            style={[
              styles.billRow,
              { borderTopColor: onCard.hairline },
            ]}
          >
            <View style={styles.billLeft}>
              <Text
                numberOfLines={1}
                style={[styles.billTitle, { color: onCard.text }]}
              >
                {bill.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.billMeta,
                  { color: onCard.text, opacity: onCard.textSoftOpacity },
                ]}
              >
                {bill.meta}
              </Text>
            </View>

            <View style={styles.billRight}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={[styles.billAmount, { color: onCard.text }]}
              >
                {bill.amountText}
              </Text>

              {bill.status === 'unpaid' ? (
                <Pressable
                  onPress={() => onPay?.(bill.id)}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Pay ${bill.title}`}
                  testID={testID ? `${testID}-pay-${bill.id}` : undefined}
                  style={({ pressed }) => [
                    styles.payPill,
                    {
                      backgroundColor: onCard.payButton.bg,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.payText,
                      {
                        color: cardBg,
                      },
                    ]}
                  >
                    Pay
                  </Text>
                </Pressable>
              ) : bill.status === 'paid' ? (
                <View
                  style={[
                    styles.paidPill,
                    {
                      backgroundColor: onCard.paidPill.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.paidText,
                      {
                        color: onCard.paidPill.text,
                      },
                    ]}
                  >
                    Paid
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  accountName: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  cycleText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  owedAmount: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  owedLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  billsList: {
    marginTop: 12,
  },
  billRow: {
    minHeight: 56,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  billLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  billRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  billMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    marginTop: 1,
  },
  billAmount: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  payPill: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  paidPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  pressed: {
    opacity: 0.8,
  },
});
