import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, useTheme } from '@/theme';
import { AccountSwatch, type AccountCardType } from './AccountSwatch';

export interface OptionTileProps {
  name: string;
  kind: string;
  selected?: boolean;
  onPress?: () => void;
  accountType?: AccountCardType;
  swatchColor?: string;
  shade?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function OptionTile({
  name,
  kind,
  selected = false,
  onPress,
  accountType,
  swatchColor,
  shade,
  disabled = false,
  style,
  testID,
}: OptionTileProps) {
  const { colors } = useTheme();

  const bgColor = selected ? colors.selectedBg : colors.fill;
  const borderColor = selected ? colors.accent : colors.fill;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={[
        styles.tile,
        {
          backgroundColor: bgColor,
          borderColor,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <AccountSwatch accountType={accountType} shade={shade} color={swatchColor} />
      <View style={styles.textContainer}>
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            {
              color: colors.text,
            },
          ]}
        >
          {name}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.kind,
            {
              color: colors.textSecondary,
            },
          ]}
        >
          {kind}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 48,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  kind: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.4,
  },
});
