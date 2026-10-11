import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, useTheme } from '@/theme';

export interface FilterPillProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FilterPill({
  label,
  selected = false,
  onPress,
  disabled = false,
  style,
  testID,
}: FilterPillProps) {
  const { colors } = useTheme();

  const bgColor = selected ? colors.accent : colors.fill;
  const borderColor = selected ? colors.accent : colors.chipBorder;
  const textColor = selected ? colors.onAccent : colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      style={[
        styles.pill,
        {
          backgroundColor: bgColor,
          borderColor,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: textColor,
            fontFamily: selected ? geistWeights.semiBold : geistWeights.medium,
            fontWeight: selected ? '600' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
