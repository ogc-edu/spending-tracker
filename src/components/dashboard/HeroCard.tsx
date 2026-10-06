/**
 * HeroCard (plan 010 DASH-1, redesigned Plan 003) — The Hero Bento Tile:
 * Cash flow intelligence hub displaying daily discretionary allowance (A_daily),
 * total discretionary pool (S_safe), status indicator (StatusPill),
 * available liquid money with privacy mask toggle, spent this month,
 * and remaining monthly budget.
 *
 * Plan 003 design: Obsidian luxe surface with hairline borders:
 * - Healthy Surplus: Electric Mint border (border-primary/40)
 * - Constrained Margin: Warm Amber border (border-warning/40)
 * - Deficit Warning: Vivid Rose border (border-destructive/40)
 *
 * All financial values remain pure integer sen from CashFlowService.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { MIN_TOUCH_TARGET, colors, moneyFontVariant, spacing } from '@/theme';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { StatusPill, type StatusVariant } from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';

/** What the headline shows while hidden (never derived from the amount). */
const MASK = '********';

export interface HeroCardProps {
  availableSen: number;
  spentSen: number;
  /** null = no overall budget (UI: "—" + prompt). */
  remainingSen: number | null;
  /** "Set a budget" → Budgets tab (only rendered when remainingSen is null). */
  onSetBudget(): void;
  /** Safe-to-spend discretionary pool (S_safe). */
  safeSen?: number;
  /** Daily discretionary allowance (A_daily). */
  dailyAllowanceSen?: number;
  /** Deficit flag (safeSen < 0). */
  deficit?: boolean;
  /** Formula safety buffer (bufferSen). */
  bufferSen?: number;
  /** Monthly budget utilization percentage (0..100+). */
  pctUsed?: number | null;
}

export function HeroCard({
  availableSen,
  spentSen,
  remainingSen,
  onSetBudget,
  safeSen,
  dailyAllowanceSen,
  deficit,
  bufferSen,
  pctUsed,
}: HeroCardProps) {
  const [hidden, setHidden] = useState(false);

  const effectiveSafeSen = safeSen ?? (availableSen - spentSen);
  const effectiveDailySen = dailyAllowanceSen ?? 0;
  const isDeficit = deficit ?? (effectiveSafeSen <= 0);

  let statusVariant: StatusVariant = 'healthy';
  let statusLabel = 'HEALTHY SURPLUS';

  if (isDeficit || effectiveSafeSen <= 0) {
    statusVariant = 'danger';
    statusLabel = 'DEFICIT WARNING';
  } else if (
    effectiveDailySen < 2000 ||
    (bufferSen !== undefined && effectiveSafeSen <= bufferSen) ||
    (pctUsed !== null && pctUsed !== undefined && pctUsed >= 80)
  ) {
    statusVariant = 'warning';
    statusLabel = 'TIGHT MARGIN';
  }

  const borderClass =
    statusVariant === 'danger'
      ? 'border-destructive/40'
      : statusVariant === 'warning'
      ? 'border-warning/40'
      : 'border-primary/40';

  const dailyText = isDeficit ? '—' : `${formatSen(effectiveDailySen)} / day`;

  return (
    <View
      testID="hero-card"
      className={cn(
        'rounded-3xl border p-5 mb-4 bg-card overflow-hidden',
        borderClass
      )}
      style={styles.card}
    >
      {/* Top Header / Status Row */}
      <View className="flex-row items-center justify-between mb-3" style={styles.header}>
        <View style={styles.labelBadge}>
          <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={styles.label}>
            Daily Allowance
          </Text>
        </View>
        <StatusPill
          variant={statusVariant}
          label={statusLabel}
          dot
          testID="hero-status-pill"
        />
      </View>

      {/* Primary Hero Metric: Daily Discretionary Allowance (A_daily) */}
      <View className="my-1">
        {isDeficit ? (
          <Text
            testID="daily-allowance-value"
            numberOfLines={1}
            accessibilityLabel="Daily allowance, no safe to spend"
            style={[{ fontVariant: moneyFontVariant }]}
            className="text-4xl sm:text-5xl font-black font-mono text-destructive tracking-tighter"
          >
            —
          </Text>
        ) : (
          <View className="flex-row items-baseline gap-2">
            <MoneyDisplay
              amountInSen={effectiveDailySen}
              size="hero"
              className="text-foreground tracking-tighter font-mono"
            />
            <Text
              testID="daily-allowance-value"
              numberOfLines={1}
              accessibilityLabel={`Daily allowance, ${spokenMoneyLabel(effectiveDailySen)} per day`}
              style={[{ fontVariant: moneyFontVariant }]}
              className="text-sm font-bold text-muted-foreground font-mono"
            >
              {dailyText}
            </Text>
          </View>
        )}
      </View>

      {/* Total Discretionary Pool (S_safe) */}
      <View testID="safe-to-spend" className="mt-2 mb-2">
        <Text className="text-xs font-semibold text-muted-foreground">
          {isDeficit ? 'Discretionary Shortfall' : 'Safe to Spend Pool'}
        </Text>
        <Text
          testID="safe-headline"
          numberOfLines={1}
          accessibilityLabel={`${isDeficit ? 'No safe to spend' : 'Safe to spend'}, ${spokenMoneyLabel(effectiveSafeSen)}`}
          style={[{ fontVariant: moneyFontVariant }, styles.safeHeadline, isDeficit && styles.headlineDeficit]}
          className={cn(
            'text-2xl font-black font-mono tracking-tight my-0.5',
            isDeficit ? 'text-destructive' : 'text-foreground'
          )}
        >
          {formatSen(effectiveSafeSen)}
        </Text>
        {isDeficit ? (
          <Text
            testID="deficit-copy"
            className="text-xs text-destructive mt-1 font-medium leading-relaxed"
            style={styles.warning}
          >
            Cover your commitments and safety buffer before discretionary spending
          </Text>
        ) : null}
      </View>

      {/* Tri-Column Liquid & Budget Stat Strip */}
      <View className="flex-row items-center border-t border-border/40 pt-3 mt-2" style={styles.row}>
        {/* Available Balance with Privacy Mask Toggle */}
        <View className="flex-1 pr-2" style={[styles.statPanel, styles.statPanelStart]}>
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-semibold text-muted-foreground" style={styles.rowLabel}>
              Available
            </Text>
            <Pressable
              onPress={() => setHidden((current) => !current)}
              hitSlop={8}
              style={styles.eyeButton}
              accessibilityRole="button"
              accessibilityState={{ selected: hidden }}
              accessibilityLabel={hidden ? 'Show available balance' : 'Hide available balance'}
              testID="hero-available-toggle"
            >
              <Ionicons
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.muted}
              />
            </Pressable>
          </View>
          <Text
            testID="hero-available"
            numberOfLines={1}
            accessibilityLabel={hidden ? 'Available balance hidden' : `Available, ${spokenMoneyLabel(availableSen)}`}
            style={[{ fontVariant: moneyFontVariant }, styles.rowValue, hidden && styles.availableHidden]}
            className="text-sm font-bold text-foreground font-mono"
          >
            {hidden ? MASK : formatSen(availableSen)}
          </Text>
        </View>

        {/* Spent this month */}
        <View className="flex-1 px-2 border-l border-border/40" style={styles.statPanel}>
          <Text className="text-xs font-semibold text-muted-foreground mb-1" style={styles.rowLabel}>
            Spent
          </Text>
          <Text
            testID="hero-spent"
            numberOfLines={1}
            accessibilityLabel={`Spent this month, ${spokenMoneyLabel(spentSen)}`}
            style={[{ fontVariant: moneyFontVariant }, styles.rowValue]}
            className="text-sm font-bold text-foreground font-mono"
          >
            {formatSen(spentSen)}
          </Text>
        </View>

        {/* Remaining budget */}
        <View className="flex-1 pl-2 border-l border-border/40" style={styles.statPanel}>
          <Text className="text-xs font-semibold text-muted-foreground mb-1" style={styles.rowLabel}>
            Budget Left
          </Text>
          {remainingSen === null ? (
            <Pressable
              onPress={onSetBudget}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Set a monthly budget"
              testID="hero-set-budget"
            >
              <Text style={[{ fontVariant: moneyFontVariant }, styles.rowValue]} className="text-sm font-bold text-muted-foreground font-mono">—</Text>
              <Text className="text-xs text-primary font-semibold underline" style={styles.setBudgetLink}>Set a budget</Text>
            </Pressable>
          ) : (
            <Text
              testID="hero-remaining"
              numberOfLines={1}
              accessibilityLabel={`Remaining budget, ${spokenMoneyLabel(remainingSen)}`}
              style={[{ fontVariant: moneyFontVariant }, styles.rowValue]}
              className="text-sm font-bold text-foreground font-mono"
            >
              {formatSen(remainingSen)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  labelBadge: {},
  label: {},
  eyeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: -spacing.xs,
    marginVertical: -spacing.sm,
  },
  safeHeadline: {
    fontVariant: moneyFontVariant,
  },
  headlineDeficit: {
    color: colors.danger,
  },
  availableHidden: {
    letterSpacing: 2,
  },
  row: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  statPanel: {
    flex: 1,
  },
  statPanelStart: {},
  rowLabel: {},
  rowValue: {
    fontVariant: moneyFontVariant,
  },
  setBudgetLink: {
    marginTop: 2,
  },
  warning: {
    color: colors.danger,
  },
});
