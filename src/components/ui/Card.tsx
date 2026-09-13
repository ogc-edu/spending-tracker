/**
 * Card (plan 017) — the ONE surface card every screen composes from. This
 * replaces the card style block that was copy-pasted across ~15 components
 * (including literal `#0F172A` shadow hexes — the token rule requires theme
 * values, which `shadows.card` now provides).
 *
 * Tones:
 *  - 'plain'   white surface (default) — neutral information
 *  - 'tint'    accentSoft — semantic "healthy/good" state (SafeToSpend)
 *  - 'danger'  dangerSoft — semantic "deficit/bad" state (SafeToSpend deficit)
 *  - 'accent'  filled accent — the single hero surface (dashboard headline)
 *
 * Layout: full-width inside the screen's horizontal padding via the shared
 * `spacing.xl` inset, `spacing.lg` below the previous card (both overridable
 * through `style`). Pressable cards keep their own Pressable wrappers — this
 * is a plain View; callers that need taps add android_ripple themselves.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, spacing, typography } from '@/theme';

export type CardTone = 'plain' | 'tint' | 'danger' | 'accent';

export function Card({
  tone = 'plain',
  style,
  children,
  testID,
}: {
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      style={[
        styles.card,
        tone === 'tint' && styles.tint,
        tone === 'danger' && styles.danger,
        tone === 'accent' && styles.accent,
        style,
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

/** Small uppercase micro-label used at the top of cards ("Available Balance"). */
export function CardLabel({ children, onAccent = false }: { children: React.ReactNode; onAccent?: boolean }) {
  return <Text style={[styles.cardLabel, onAccent && styles.cardLabelOnAccent]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  tint: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  accent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  cardLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardLabelOnAccent: { color: colors.surface },
});
