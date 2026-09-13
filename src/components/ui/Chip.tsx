/**
 * Chip (plan 017) — the ONE filter chip every picker row composes from
 * (category filters, period presets, budget picker, settings categories).
 *
 * Fixes the plan-017 audit finding that the old chips were ~26 px tall —
 * under the project's own 44-pt touch-target rule — by enforcing
 * `minHeight: MIN_TOUCH_TARGET` and a pill shape. Selected state is the
 * accent fill (white label, AA-asserted pair); idle state is a bordered
 * surface with tone-colored optional icon.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, spacing, typography } from '@/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  /** Optional leading Ionicon glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon color when idle (e.g. the category color); white when selected. */
  iconColor?: string;
  onPress(): void;
  /** Plan 018: the expense form's long-press-to-delete arming. */
  onLongPress?(): void;
  delayLongPress?: number;
  disabled?: boolean;
  testID?: string;
}

export function Chip({
  label,
  selected = false,
  icon,
  iconColor,
  onPress,
  onLongPress,
  delayLongPress,
  disabled = false,
  testID,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
      android_ripple={{ color: selected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)', borderless: false }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.surface : iconColor ?? colors.muted} />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  label: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  labelSelected: { color: colors.surface, fontWeight: '700' },
});
