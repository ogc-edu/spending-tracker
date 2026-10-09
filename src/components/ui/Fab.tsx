/**
 * Fab — floating action button composed with NativeWind and RNR aesthetic.
 * Uses hairline border instead of aggressive drop shadow, keeps touch target ≥48pt.
 */
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme';
import { cn } from '@/lib/utils';

export function Fab({
  onPress,
  label,
  className,
  testID,
}: {
  onPress(): void;
  label?: string;
  className?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'absolute right-6 bottom-6 w-14 h-14 rounded-full bg-primary items-center justify-center border border-primary-foreground/20 active:opacity-90',
        className
      )}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
});
