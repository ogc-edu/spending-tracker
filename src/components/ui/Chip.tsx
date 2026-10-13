import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geistWeights, useTheme } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  dashed?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  icon,
  iconColor,
  dashed = false,
  onPress,
  onLongPress,
  delayLongPress,
  disabled = false,
  style,
  testID,
}: ChipProps) {
  const { colors } = useTheme();

  const bgColor = selected ? colors.accent : dashed ? 'transparent' : colors.fill;
  const borderColor = selected ? colors.accent : colors.chipBorder;
  const textColor = selected
    ? colors.onAccent
    : dashed
      ? colors.textSecondary
      : colors.text;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: bgColor,
          borderColor,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.onAccent : iconColor ?? colors.textSecondary}
          style={styles.icon}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          {
            color: textColor,
            fontFamily: selected || dashed ? geistWeights.semiBold : geistWeights.medium,
            fontWeight: selected || dashed ? '600' : '500',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    minWidth: 44,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
