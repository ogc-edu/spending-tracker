/**
 * SafeToSpendCard (plan 010 DASH-1/12) — the headline safe-to-spend number
 * with its daily-allowance chip.
 *
 * Deficit state (PRD §8.4 property 3, plan §Decisions): when `deficit` the
 * card flips to danger styling, shows the explicit warning copy ("cover
 * commitments + buffer before discretionary spending"), and the daily chip
 * renders "—" — never a misleading negative allowance as advice. The headline
 * still shows the (negative) safe number so the deficit is real and visible,
 * never styled as success.
 */
import { StyleSheet, Text, View } from 'react-native';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

export function SafeToSpendCard({
  safeSen,
  deficit,
  dailyAllowanceSen,
}: {
  safeSen: number;
  deficit: boolean;
  dailyAllowanceSen: number;
}) {
  const dailyText = deficit ? '—' : `${formatSen(dailyAllowanceSen)} / day`;

  return (
    <View
      style={[styles.card, deficit && styles.cardDeficit]}
      testID={deficit ? 'safe-to-spend-deficit' : 'safe-to-spend'}
    >
      <View style={styles.header}>
        <View style={[styles.badge, deficit ? styles.badgeDeficit : styles.badgeNormal]}>
          <Text style={[styles.label, deficit && styles.deficitText]}>
            {deficit ? 'No safe-to-spend' : 'Safe to spend'}
          </Text>
        </View>
      </View>
      <Text
        style={[styles.headline, deficit && styles.headlineDeficit]}
        numberOfLines={1}
        accessibilityLabel={`${deficit ? 'No safe to spend' : 'Safe to spend'}, ${spokenMoneyLabel(safeSen)}`}
        testID="safe-headline"
      >
        {formatSen(safeSen)}
      </Text>
      <View
        style={[styles.chip, deficit && styles.chipDeficit]}
        testID="daily-allowance-chip"
      >
        <Text style={[styles.chipLabel, deficit && styles.deficitText]}>Daily allowance</Text>
        <Text
          style={[styles.chipValue, deficit && styles.deficitText]}
          numberOfLines={1}
          accessibilityLabel={
            deficit ? 'Daily allowance, no safe to spend' : `Daily allowance, ${spokenMoneyLabel(dailyAllowanceSen)} per day`
          }
          testID="daily-allowance-value"
        >
          {dailyText}
        </Text>
      </View>
      {deficit ? (
        <Text style={styles.warning} testID="deficit-copy">
          Cover your commitments and safety buffer before discretionary spending
        </Text>
      ) : null}
    </View>
  );
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDeficit: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNormal: { backgroundColor: colors.accentSoft },
  badgeDeficit: { backgroundColor: colors.surface },
  label: { fontSize: typography.caption, color: colors.accent, fontWeight: '700' },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginVertical: spacing.sm,
    letterSpacing: -0.4,
    fontVariant: moneyFontVariant,
  },
  headlineDeficit: { color: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  chipDeficit: { backgroundColor: colors.surface },
  chipLabel: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  chipValue: { fontSize: typography.emphasis, fontWeight: '700', color: colors.accent, fontVariant: moneyFontVariant, flexShrink: 1 },
  deficitText: { color: colors.danger },
  warning: {
    fontSize: typography.body,
    color: colors.danger,
    marginTop: spacing.md,
    lineHeight: 21,
    fontWeight: '500',
  },
});
