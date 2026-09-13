/**
 * Badge (plan 017) — the ONE status pill every screen composes from. Soft
 * tinted background + strong tone text replaces the previous mix of loud
 * filled chips (MoM), tiny 10 px badges (BudgetRow "Over") and ad-hoc status
 * pills (commitments). White-on-accent stays available for on-hero badges.
 *
 * All text pairs are the theme's AA-asserted pairs (soft bg + tone text,
 * or surface on accent) — no new contrast pairs are introduced.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

export type BadgeTone = 'accent' | 'danger' | 'warning' | 'neutral' | 'onAccent';

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  accent: { bg: colors.accentSoft, fg: colors.accent },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  neutral: { bg: colors.background, fg: colors.muted },
  onAccent: { bg: 'rgba(15,23,42,0.14)', fg: colors.surface }, // over the accent hero
};

export function Badge({
  tone = 'neutral',
  label,
  icon,
  testID,
}: {
  tone?: BadgeTone;
  label: string;
  /** Optional leading Ionicon glyph (rendered in the tone color). */
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const toneStyle = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]} testID={testID}>
      {icon ? <Ionicons name={icon} size={11} color={toneStyle.fg} /> : null}
      <Text style={[styles.label, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  label: { fontSize: typography.caption, fontWeight: '700' },
});
