import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { accountCardColor, useTheme, type AccountCardType } from '@/theme';

export type { AccountCardType };

export interface AccountSwatchProps {
  accountType?: AccountCardType;
  /** Shade within the type's family — from `accountShades()`. */
  shade?: number;
  color?: string;
  variant?: 'default' | 'settings';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AccountSwatch({
  accountType,
  shade = 0,
  color,
  variant = 'default',
  style,
  testID,
}: AccountSwatchProps) {
  const { scheme } = useTheme();

  const swatchColor = color ?? accountCardColor(accountType ?? 'bank', scheme, shade);

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
