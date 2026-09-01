/**
 * StatGrid (plan 011, AN-2/AN-3) — the 2×2 analytics stat cells: average
 * daily spend, largest expense (with its day + category), overall-budget
 * utilization ("No budget" when unset), and the end-of-month projection.
 * Pure presentation over the typed snapshot — every figure is the engine's.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { SpendingSnapshot } from '@/services/AnalyticsService';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

function StatCell({
  label,
  value,
  sub,
  subTone,
  testID,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: string;
  testID?: string;
}) {
  return (
    <View style={styles.cell} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? (
        <Text style={[styles.sub, subTone ? { color: subTone } : null]}>{sub}</Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ snapshot }: { snapshot: SpendingSnapshot }) {
  const largest = snapshot.largest[0] ?? null;
  const utilization = snapshot.utilization;
  const utilValue = utilization === null ? 'No budget' : utilization.pct !== null ? `${utilization.pct.toFixed(1)}%` : '—';

  return (
    <View style={styles.grid} testID="analytics-stats">
      <StatCell
        label="Average daily"
        value={formatSen(snapshot.avgDailySen)}
        sub="to date"
        testID="analytics-stat-avg"
      />
      <StatCell
        label="Largest expense"
        value={largest ? formatSen(largest.amountSen) : '—'}
        sub={largest ? `${formatDayLabel(largest.date)} · ${largest.categoryName}` : undefined}
        testID="analytics-stat-largest"
      />
      <StatCell
        label="Budget used"
        value={utilValue}
        sub={
          utilization === null
            ? undefined
            : utilization.overBudget
              ? 'Over budget'
              : 'of monthly budget'
        }
        subTone={utilization?.overBudget ? colors.danger : undefined}
        testID="analytics-stat-utilization"
      />
      <StatCell
        label="Projected end-of-month"
        value={formatSen(snapshot.projectionSen)}
        sub="at current pace"
        testID="analytics-stat-projection"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  cell: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  label: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xs },
  value: { fontSize: typography.moneySmall, fontWeight: '700', color: colors.text },
  sub: { fontSize: typography.caption, color: colors.muted, marginTop: spacing.xs },
});
