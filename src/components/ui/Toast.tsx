import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

export interface ToastProps {
  message: string;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Toast({
  message,
  visible = true,
  style,
  testID,
}: ToastProps) {
  const { scheme, colors } = useTheme();

  if (!visible) return null;

  const isDark = scheme === 'dark';
  const bgColor = colors.text;
  const textColor = isDark ? colors.onAccent : colors.onAccent; // #000 in dark, #FFF in light

  return (
    <View
      style={[
        styles.toast,
        {
          backgroundColor: bgColor,
        },
        style,
      ]}
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Text
        numberOfLines={2}
        style={[
          styles.text,
          {
            color: textColor,
          },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    alignSelf: 'center',
    maxWidth: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
    textAlign: 'center',
  },
});
