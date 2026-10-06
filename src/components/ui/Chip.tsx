/**
 * Chip — filter chip with RNR aesthetic and NativeWind support.
 * Enforces minimum 44px touch target (MIN_TOUCH_TARGET) and subtle hairline borders.
 */
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, colors, typography } from '@/theme';
import { cn } from '@/lib/utils';

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
  className?: string;
  style?: StyleProp<ViewStyle>;
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
  className,
  style,
  testID,
}: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      className={cn(
        'min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full border px-4 py-1.5',
        selected
          ? 'border-primary bg-primary'
          : 'border-border bg-card active:bg-muted/40',
        className
      )}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
      android_ripple={{ color: selected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)', borderless: false }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      {icon ? (
        <Ionicons name={icon} size={14} color={selected ? colors.surface : iconColor ?? colors.muted} />
      ) : null}
      <Text
        className={cn(
          'text-xs font-semibold',
          selected ? 'text-primary-foreground font-bold' : 'text-foreground'
        )}
        style={[styles.label, selected && styles.labelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_TARGET,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  pressed: { opacity: 0.8 },
  label: { fontSize: typography.caption, color: colors.text, fontWeight: '600' },
  labelSelected: { color: colors.surface, fontWeight: '700' },
});
