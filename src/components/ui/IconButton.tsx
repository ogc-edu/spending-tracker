/**
 * IconButton — a ≥44 pt square/circular pressable carrying one icon.
 * Follows RNR aesthetic with NativeWind support and hairline borders.
 */
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, spacing } from '@/theme';
import { cn } from '@/lib/utils';

export type IconButtonTone = 'muted' | 'accent' | 'danger';

const TONE_COLOR = { muted: colors.muted, accent: colors.accent, danger: colors.danger } as const;

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'muted',
  filled = false,
  disabled = false,
  size = 20,
  className,
  style,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress(): void;
  /** Accessibility label — required: icon-only buttons must be labelled. */
  label: string;
  tone?: IconButtonTone;
  /** Soft tinted circle behind the glyph (the tone's soft background). */
  filled?: boolean;
  disabled?: boolean;
  size?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const color = TONE_COLOR[tone];
  const bg =
    tone === 'danger' ? colors.dangerSoft : tone === 'accent' ? colors.accentSoft : colors.background;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.xs}
      className={cn(
        'w-11 h-11 rounded-full items-center justify-center min-h-[44px] min-w-[44px]',
        filled && 'border border-border/40',
        disabled && 'opacity-50',
        className
      )}
      style={({ pressed }) => [
        styles.button,
        filled && { backgroundColor: bg },
        pressed && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: MIN_TOUCH_TARGET / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
