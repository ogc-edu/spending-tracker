/**
 * HeroCard (plan 010 DASH-1, restyled by plan 017) — the top line of the
 * dashboard: available money (the headline, money font), spent this month,
 * and remaining monthly budget.
 *
 * Plan 017 design: the ONE hero surface on the screen — accent-filled card,
 * white text (white on `#15803D` is the theme's AA-asserted 5.0:1 pair) — so
 * the headline reads as the product's answer at a glance; every other card
 * stays white. Stat rows are separated by translucent hairlines instead of
 * filled panels (filled panels would drop white-text contrast below AA).
 *
 * The eye button beside the label hides the headline behind asterisks — for
 * checking the app in public. It is a local view preference: nothing is stored
 * and the other figures (spent, remaining) are untouched.
 *
 * `remainingSen === null` means NO overall budget is set → the row shows "—"
 * and a "Set a budget" link (PRD §8.4: budget term 0 in the math; the prompt
 * per PRD). Pure presentation — all numbers are already engine-computed by
 * CashFlowService, no arithmetic here.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { MIN_TOUCH_TARGET, colors, moneyFontVariant, shadows, spacing, typography } from '@/theme';

/** What the headline shows while hidden (never derived from the amount — its
 *  length would leak the magnitude). */
const MASK = '********';

export function HeroCard({
  availableSen,
  spentSen,
  remainingSen,
  onSetBudget,
}: {
  availableSen: number;
  spentSen: number;
  /** null = no overall budget (UI: "—" + prompt). */
  remainingSen: number | null;
  /** "Set a budget" → Budgets tab (only rendered when remainingSen is null). */
  onSetBudget(): void;
}) {
  const [hidden, setHidden] = useState(false);

  return (
    <View style={styles.card} testID="hero-card">
      <View style={styles.header}>
        <View style={styles.labelBadge}>
          <Text style={styles.label}>Available Balance</Text>
        </View>
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
            size={20}
            color={colors.surface}
          />
        </Pressable>
      </View>
      <Text
        style={[styles.available, hidden && styles.availableHidden]}
        numberOfLines={1}
        accessibilityLabel={hidden ? 'Available balance hidden' : `Available, ${spokenMoneyLabel(availableSen)}`}
        testID="hero-available"
      >
        {hidden ? MASK : formatSen(availableSen)}
      </Text>

      <View style={styles.row}>
        <View style={[styles.statPanel, styles.statPanelStart]}>
          <Text style={styles.rowLabel}>Spent this month</Text>
          <Text
            style={styles.rowValue}
            numberOfLines={1}
            accessibilityLabel={`Spent this month, ${spokenMoneyLabel(spentSen)}`}
            testID="hero-spent"
          >
            {formatSen(spentSen)}
          </Text>
        </View>
        <View style={styles.statPanel}>
          <Text style={styles.rowLabel}>Remaining budget</Text>
          {remainingSen === null ? (
            <Pressable
              onPress={onSetBudget}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Set a monthly budget"
              testID="hero-set-budget"
            >
              <Text style={styles.rowValue}>—</Text>
              <Text style={styles.setBudgetLink}>Set a budget</Text>
            </Pressable>
          ) : (
            <Text
              style={styles.rowValue}
              numberOfLines={1}
              accessibilityLabel={`Remaining budget, ${spokenMoneyLabel(remainingSen)}`}
              testID="hero-remaining"
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
    backgroundColor: colors.accent,
    borderRadius: 20,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.hero,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  labelBadge: {
    backgroundColor: 'rgba(15,23,42,0.14)', // dark-translucent: white text ≥ AA on the blend
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  label: { fontSize: typography.caption, fontWeight: '700', color: colors.surface, letterSpacing: 0.4 },
  eyeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: -spacing.xs,
    marginVertical: -spacing.sm, // keeps the header its original height
  },
  available: {
    fontSize: typography.display,
    fontWeight: '800',
    color: colors.surface,
    marginVertical: spacing.sm,
    letterSpacing: -0.5,
    fontVariant: moneyFontVariant,
  },
  /** Masked: letter-spaced so the asterisks read as a deliberate cover. */
  availableHidden: { letterSpacing: 2 },
  row: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  statPanel: {
    flex: 1,
    paddingLeft: spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.28)',
  },
  statPanelStart: { paddingLeft: 0, borderLeftWidth: 0, marginRight: spacing.lg },
  rowLabel: { fontSize: typography.caption, color: colors.surface, marginBottom: spacing.xs, fontWeight: '600', opacity: 1 },
  rowValue: { fontSize: typography.moneySmall, fontWeight: '800', color: colors.surface, fontVariant: moneyFontVariant, flexShrink: 1 },
  setBudgetLink: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.surface,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});
