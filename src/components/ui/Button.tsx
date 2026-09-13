/**
 * Button (plan 018) — the ONE button every screen and sheet composes from.
 * Replaces the filled/outline/danger Pressable blocks that each rolled their
 * own radius, `#fff` labels and pressed states (forms, sheets, settings).
 *
 * Variants (all ≥48 pt tall):
 *  - primary    accent fill, white label — the main action of a surface
 *  - secondary  bordered surface — cancel / alternative actions
 *  - danger     danger fill, white label — destructive confirms, log out
 *  - ghost      no fill, accent text — low-emphasis actions ("Add category budget")
 *
 * White-on-accent and white-on-danger are the tokens test's AA pairs, now
 * referenced as colors.onAccent. `busy` swaps the label for a spinner and
 * disables the press (callers keep their own double-tap guards).
 */
import { Pressable, StyleSheet, Text, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress(): void;
  variant?: ButtonVariant;
  /** Optional leading Ionicon glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** While true: spinner instead of the label, press disabled. */
  busy?: boolean;
  disabled?: boolean;
  /** Stretch to the row (form action rows use flex: 1 pairs). */
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const VARIANT_STYLES = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
});

const VARIANT_LABELS = {
  primary: colors.onAccent,
  secondary: colors.muted,
  danger: colors.onAccent,
  ghost: colors.accent,
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy = false,
  disabled = false,
  flex = false,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        VARIANT_STYLES[variant],
        inactive && styles.disabled,
        pressed && styles.pressed,
        flex && styles.flex,
        style,
      ]}
      android_ripple={{ color: variant === 'primary' || variant === 'danger' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)', borderless: false }}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={VARIANT_LABELS[variant]} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={VARIANT_LABELS[variant]} /> : null}
          <Text style={[styles.label, { color: VARIANT_LABELS[variant] }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
  },
  flex: { flex: 1 },
  label: { fontSize: typography.emphasis, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});
