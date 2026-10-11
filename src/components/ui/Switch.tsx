import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { onCard, useTheme } from '@/theme';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel = 'Toggle switch',
  style,
  testID,
}: SwitchProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.track,
        {
          backgroundColor: value ? colors.accent : colors.switchOff,
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.knob,
          {
            backgroundColor: onCard.text,
            transform: [{ translateX: value ? 20 : 0 }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  knob: {
    width: 27,
    height: 27,
    borderRadius: 13.5,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
});
