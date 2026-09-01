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
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

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
      <Text style={[styles.label, deficit && styles.deficitText]}>
        {deficit ? 'No safe-to-spend' : 'Safe to spend'}
      </Text>
      <Text
        style={[styles.headline, deficit && styles.headlineDeficit]}
        testID="safe-headline"
      >
        {formatSen(safeSen)}
      </Text>
      <View
        style={[styles.chip, deficit && styles.chipDeficit]}
        testID="daily-allowance-chip"
      >
        <Text style={[styles.chipLabel, deficit && styles.deficitText]}>Daily allowance</Text>
        <Text style={[styles.chipValue, deficit && styles.deficitText]} testID="daily-allowance-value">
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
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardDeficit: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  label: { fontSize: typography.body, color: colors.muted, marginBottom: spacing.xs },
  headline: {
    fontSize: typography.money,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    fontVariant: ['tabular-nums'],
  },
  headlineDeficit: { color: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: colors.accentSoft,
    borderRadius: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipDeficit: { backgroundColor: colors.surface },
  chipLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '600' },
  chipValue: { fontSize: typography.emphasis, fontWeight: '700', color: colors.accent, fontVariant: ['tabular-nums'] },
  deficitText: { color: colors.danger },
  warning: {
    fontSize: typography.body,
    color: colors.danger,
    marginTop: spacing.md,
    lineHeight: 21,
  },
});
