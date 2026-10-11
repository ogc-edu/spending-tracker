import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { geistWeights, useTheme } from '@/theme';

export interface TextLinkButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function TextLinkButton({
  label,
  children,
  onPress,
  disabled = false,
  style,
  textStyle,
  testID,
}: TextLinkButtonProps) {
  const { scheme, colors } = useTheme();

  const isLight = scheme === 'light';
  const fontWeight: TextStyle['fontWeight'] = isLight ? '600' : '500';
  const fontFamily = isLight ? geistWeights.semiBold : geistWeights.medium;

  const content = label ?? children;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {typeof content === 'string' ? (
        <Text
          numberOfLines={1}
          style={[
            styles.text,
            {
              color: colors.link,
              fontWeight,
              fontFamily,
            },
            textStyle,
          ]}
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
