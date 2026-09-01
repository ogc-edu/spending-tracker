/**
 * HeroCard (plan 010 DASH-1) — the top line of the dashboard: available money
 * (the headline, money font), spent this month, and remaining monthly budget.
 *
 * `remainingSen === null` means NO overall budget is set → the row shows "—"
 * and a "Set a budget" link (PRD §8.4: budget term 0 in the math; the prompt
 * per PRD). Pure presentation — all numbers are already engine-computed by
 * CashFlowService, no arithmetic here.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

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
  return (
    <View style={styles.card} testID="hero-card">
      <Text style={styles.label}>Available</Text>
      <Text style={styles.available} testID="hero-available">
        {formatSen(availableSen)}
      </Text>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>Spent this month</Text>
          <Text style={styles.rowValue} testID="hero-spent">
            {formatSen(spentSen)}
          </Text>
        </View>
        <View style={styles.rowItem}>
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
            <Text style={styles.rowValue} testID="hero-remaining">
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
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  label: { fontSize: typography.body, color: colors.muted, marginBottom: spacing.xs },
  available: {
    fontSize: typography.money,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.lg,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  rowItem: { flex: 1 },
  rowLabel: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs },
  rowValue: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  setBudgetLink: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.accent,
    textDecorationLine: 'underline',
    marginTop: spacing.xs,
  },
});
