/**
 * Fab (plan 017) — the ONE floating action button (Dashboard + Expenses + Commitments).
 * Replaces the two duplicated FAB style blocks (with literal `#fff` hexes)
 * with a single themed component: accent fill, shadow token, native Android
 * ripple, press scale feedback, ≥48 pt size with the add glyph.
 *
 * The ripple is MASKED (`borderless: false`), like every other ripple in the
 * design system: on the New Architecture a `borderless` ripple makes the
 * Pressable drop its `backgroundColor`, so the FAB rendered as a bare white
 * "+" with no green circle (facebook/react-native#48552). Masked ripples also
 * clip to the rounded outline, so no `overflow: 'hidden'` (which would clip
 * the elevation shadow) is needed.
 */
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadows, spacing } from '@/theme';

export function Fab({ onPress, label, testID }: { onPress(): void; label?: string; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(255,255,255,0.3)', borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Ionicons name="add" size={30} color={colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
});
