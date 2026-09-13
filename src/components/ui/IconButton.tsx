/**
 * IconButton (plan 018) — a ≥44 pt square/circular pressable carrying one
 * icon. Replaces the ad-hoc 40×40 trash buttons, header gears and eye
 * toggles that each hand-roll their own hit area.
 *
 * `tone` picks the icon color; `filled` adds a soft circular background
 * (danger-soft trash buttons, etc.). Header gear uses transparent + muted.
 */
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, spacing } from '@/theme';

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
      style={({ pressed }) => [styles.button, filled && { backgroundColor: bg }, pressed && styles.pressed]}
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
