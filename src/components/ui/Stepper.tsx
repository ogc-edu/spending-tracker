import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 5.0,
  step = 0.5,
  formatValue = (v) => `${v.toFixed(2)}%`,
  style,
  testID,
}: StepperProps) {
  const { colors } = useTheme();

  const canDecrease = value > min;
  const canIncrease = value < max;

  const handleDecrease = () => {
    if (canDecrease) {
      const next = Math.max(min, Math.round((value - step) * 1000) / 1000);
      onChange(next);
    }
  };

  const handleIncrease = () => {
    if (canIncrease) {
      const next = Math.min(max, Math.round((value + step) * 1000) / 1000);
      onChange(next);
    }
  };

  return (
    <View style={[styles.container, style]} testID={testID}>
      <TouchableOpacity
        onPress={handleDecrease}
        disabled={!canDecrease}
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel="Decrease value"
        accessibilityState={{ disabled: !canDecrease }}
        testID={testID ? `${testID}-decrease` : undefined}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.fillStrong,
          },
          !canDecrease && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: colors.text,
            },
          ]}
        >
          −
        </Text>
      </TouchableOpacity>

      <View style={styles.valueContainer}>
        <Text
          numberOfLines={1}
          style={[
            styles.valueText,
            {
              color: colors.text,
            },
          ]}
        >
          {formatValue(value)}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleIncrease}
        disabled={!canIncrease}
        hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
        accessibilityRole="button"
        accessibilityLabel="Increase value"
        accessibilityState={{ disabled: !canIncrease }}
        testID={testID ? `${testID}-increase` : undefined}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            backgroundColor: colors.fillStrong,
          },
          !canIncrease && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: colors.text,
            },
          ]}
        >
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    width: 44,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  valueContainer: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  valueText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
});
