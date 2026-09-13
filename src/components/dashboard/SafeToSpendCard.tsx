/**
 * SafeToSpendCard (plan 010 DASH-1/12; restyled by plan 017) — the headline
 * safe-to-spend number with its daily-allowance chip.
 *
 * Plan 017 design: the card is SEMANTICALLY tinted — healthy months get the
 * soft accent tint (the "you're OK" color), deficit keeps the danger tint —
 * so the state is legible from across the room without reading a word. All
 * text pairs stay on the theme's AA-asserted soft backgrounds.
 *
 * Deficit state (PRD §8.4 property 3, plan §Decisions): the card flips to
 * danger styling, shows the explicit warning copy ("cover commitments +
 * buffer before discretionary spending"), and the daily chip renders "—" —
 * never a misleading negative allowance as advice. The headline still shows
 * the (negative) safe number so the deficit is real and visible, never
 * styled as success.
 */
import { StyleSheet, Text, View } from 'react-native';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

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
    <Card tone={deficit ? 'danger' : 'tint'} testID={deficit ? 'safe-to-spend-deficit' : 'safe-to-spend'}>
      <View style={styles.header}>
        <Badge
          tone={deficit ? 'danger' : 'accent'}
          label={deficit ? 'No safe-to-spend' : 'Safe to spend'}
          testID="safe-badge"
        />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: typography.money,
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
    backgroundColor: colors.surface,
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
