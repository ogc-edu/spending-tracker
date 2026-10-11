import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { accountCards, useTheme } from '@/theme';

export type AccountCardType = keyof typeof accountCards;

export interface AccountSwatchProps {
  accountType?: AccountCardType;
  color?: string;
  variant?: 'default' | 'settings';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AccountSwatch({
  accountType,
  color,
  variant = 'default',
  style,
  testID,
}: AccountSwatchProps) {
  const { scheme } = useTheme();

  const swatchColor =
    color ??
    (accountType ? accountCards[accountType]?.[scheme] : undefined) ??
    accountCards.bank[scheme];

  const isSettings = variant === 'settings';

  return (
    <View
      testID={testID}
      style={[
        isSettings ? styles.settings : styles.default,
        { backgroundColor: swatchColor },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    width: 22,
    height: 15,
    borderRadius: 3,
    flexShrink: 0,
  },
  settings: {
    width: 30,
    height: 20,
    borderRadius: 4,
    flexShrink: 0,
  },
});
