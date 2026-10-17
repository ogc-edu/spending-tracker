import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Glyph, type GlyphName } from './Glyph';

export type IconButtonTone = 'muted' | 'accent' | 'danger';

export interface IconButtonProps {
  /** Glyph name for design.jsonc glyphs */
  glyph?: GlyphName;
  name?: GlyphName;
  /** Backward-compatible Ionicons name */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel?: string;
  label?: string;
  tone?: IconButtonTone;
  filled?: boolean;
  disabled?: boolean;
  size?: number;
  glyphSize?: number;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  glyph,
  name,
  icon,
  onPress,
  accessibilityLabel,
  label,
  tone,
  filled,
  disabled = false,
  size = 44,
  glyphSize = 20,
  color,
  bg,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  const glyphName = glyph ?? name;
  const a11yLabel = accessibilityLabel ?? label ?? glyphName ?? (icon as string) ?? 'Button';

  let iconColor = color ?? colors.text;
  let bgColor = bg ?? colors.fill;

  if (tone === 'accent') {
    iconColor = colors.accent;
    if (filled) bgColor = colors.selectedBg;
  } else if (tone === 'danger') {
    iconColor = colors.danger;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {glyphName ? (
        <Glyph name={glyphName} size={glyphSize} color={iconColor} />
      ) : icon ? (
        <Ionicons name={icon} size={glyphSize} color={iconColor} />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
