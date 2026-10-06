/**
 * SafeToSpendCard (plan 010 DASH-1/12, redesigned Plan 003) — the headline
 * safe-to-spend number with its daily-allowance chip.
 *
 * Plan 003 Bento redesign: Obsidian surface with subtle hairline borders.
 * Healthy months display Electric Mint / neutral tones, deficit switches
 * to Vivid Rose border and text styling with explicit warning copy.
 */
import { StyleSheet, Text, View } from 'react-native';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { BentoCard } from '@/components/ui/BentoCard';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';

export interface SafeToSpendCardProps {
  safeSen: number;
  deficit: boolean;
  dailyAllowanceSen: number;
}

export function SafeToSpendCard({
  safeSen,
  deficit,
  dailyAllowanceSen,
}: SafeToSpendCardProps) {
  const dailyText = deficit ? '—' : `${formatSen(dailyAllowanceSen)} / day`;

  return (
    <BentoCard
      testID={deficit ? 'safe-to-spend-deficit' : 'safe-to-spend'}
      className={cn(
        'mb-4 p-5 border',
        deficit
          ? 'border-destructive/40 bg-card'
          : 'border-border/60 bg-card'
      )}
    >
      <View className="flex-row items-center justify-between mb-3" style={styles.header}>
        <StatusPill
          variant={deficit ? 'danger' : 'healthy'}
          label={deficit ? 'DEFICIT WARNING' : 'HEALTHY SURPLUS'}
          dot
          testID="safe-badge"
        />
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Safe to Spend
        </Text>
      </View>

      <Text
        testID="safe-headline"
        numberOfLines={1}
        accessibilityLabel={`${deficit ? 'No safe to spend' : 'Safe to spend'}, ${spokenMoneyLabel(safeSen)}`}
        style={[{ fontVariant: moneyFontVariant }, styles.headline, deficit && styles.headlineDeficit]}
        className={cn(
          'text-3xl sm:text-4xl font-black font-mono tracking-tight my-1',
          deficit ? 'text-destructive' : 'text-foreground'
        )}
      >
        {formatSen(safeSen)}
      </Text>

      <View
        testID="daily-allowance-chip"
        className={cn(
          'flex-row items-center justify-between rounded-xl py-2.5 px-3.5 mt-3 border',
          deficit
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-muted/30 border-border/40'
        )}
        style={[styles.chip, deficit && styles.chipDeficit]}
      >
        <Text
          className={cn(
            'text-xs font-semibold',
            deficit ? 'text-destructive' : 'text-muted-foreground'
          )}
          style={[styles.chipLabel, deficit && styles.deficitText]}
        >
          Daily allowance
        </Text>
        <Text
          testID="daily-allowance-value"
          numberOfLines={1}
          accessibilityLabel={
            deficit
              ? 'Daily allowance, no safe to spend'
              : `Daily allowance, ${spokenMoneyLabel(dailyAllowanceSen)} per day`
          }
          style={[{ fontVariant: moneyFontVariant }, styles.chipValue, deficit && styles.deficitText]}
          className={cn(
            'text-sm font-bold font-mono',
            deficit ? 'text-destructive' : 'text-foreground'
          )}
        >
          {dailyText}
        </Text>
      </View>

      {deficit ? (
        <Text
          testID="deficit-copy"
          className="text-xs text-destructive mt-2.5 font-medium leading-relaxed"
          style={styles.warning}
        >
          Cover your commitments and safety buffer before discretionary spending
        </Text>
      ) : null}
    </BentoCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  chipDeficit: {},
  chipLabel: { fontSize: typography.body, color: colors.muted, fontWeight: '500' },
  chipValue: { fontSize: typography.emphasis, fontWeight: '700', fontVariant: moneyFontVariant, flexShrink: 1 },
  deficitText: { color: colors.danger },
  warning: {
    fontSize: typography.body,
    color: colors.danger,
    marginTop: spacing.md,
    lineHeight: 21,
    fontWeight: '500',
  },
});
