import React, { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';
import { WalletCard, type WalletCardLine } from './WalletCard';
import type { AccountCardType } from './AccountSwatch';

export interface WalletCardData {
  id: string;
  name: string;
  kind: string;
  amount: string;
  amountLabel: string;
  accountType: AccountCardType;
  lines?: readonly WalletCardLine[] | WalletCardLine[];
}

export interface WalletStackProps {
  cards: readonly WalletCardData[] | WalletCardData[];
  availableAmount?: string;
  headerTitle?: string;
  openCardId?: string | null;
  onOpenCardChange?: (id: string | null) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function WalletStack({
  cards,
  availableAmount,
  headerTitle = 'Accounts',
  openCardId: controlledOpenId,
  onOpenCardChange,
  style,
  testID,
}: WalletStackProps) {
  const { colors } = useTheme();
  const [internalOpenId, setInternalOpenId] = useState<string | null>(null);

  const isControlled = controlledOpenId !== undefined;
  const activeOpenId = isControlled ? controlledOpenId : internalOpenId;

  const handleToggle = (id: string) => {
    const next = activeOpenId === id ? null : id;
    if (!isControlled) {
      setInternalOpenId(next);
    }
    onOpenCardChange?.(next);
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      {/* Header row */}
      <View style={styles.header}>
        <Text
          style={[
            styles.headerTitle,
            {
              color: colors.text,
            },
          ]}
        >
          {headerTitle}
        </Text>
        {availableAmount ? (
          <Text
            style={[
              styles.availableLabel,
              {
                color: colors.textSecondary,
              },
            ]}
          >
            Available{' '}
            <Text
              style={[
                styles.availableAmount,
                {
                  color: colors.text,
                },
              ]}
            >
              {availableAmount}
            </Text>
          </Text>
        ) : null}
      </View>

      {/* Stacked cards */}
      <View style={styles.stackArea}>
        {cards.map((card, idx) => (
          <WalletCard
            key={card.id}
            id={card.id}
            name={card.name}
            kind={card.kind}
            amount={card.amount}
            amountLabel={card.amountLabel}
            accountType={card.accountType}
            lines={card.lines}
            isOpen={activeOpenId === card.id}
            onToggle={() => handleToggle(card.id)}
            index={idx}
            testID={testID ? `${testID}-card-${card.id}` : undefined}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headerTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  availableLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  availableAmount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  stackArea: {
    flexDirection: 'column',
  },
});
