/**
 * HeroCard (plan 010 DASH-1) — the top line of the dashboard: available money
 * (the headline, money font), spent this month, and remaining monthly budget.
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
import { MIN_TOUCH_TARGET, colors, moneyFontVariant, spacing, typography } from '@/theme';

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
            color={colors.muted}
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
        <View style={styles.statPanel}>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  labelBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  label: { fontSize: typography.caption, fontWeight: '600', color: colors.muted },
  eyeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: -spacing.xs,
    marginVertical: -spacing.sm, // keeps the header its original height
  },
  available: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.accent,
    marginVertical: spacing.sm,
    letterSpacing: -0.5,
    fontVariant: moneyFontVariant,
  },
  /** Masked: muted and letter-spaced so the asterisks read as a deliberate cover. */
  availableHidden: { color: colors.muted, letterSpacing: 2 },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statPanel: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md,
  },
  rowLabel: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs, fontWeight: '500' },
  rowValue: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, fontVariant: moneyFontVariant, flexShrink: 1 },
  setBudgetLink: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.accent,
    textDecorationLine: 'underline',
    marginTop: 2,
  },
});
