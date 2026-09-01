/**
 * Analytics tab (plan 011 / PRD §7.5 AN-1..4) — deterministic month analytics
 * from the typed SpendingSnapshot (the exact 014 AI payload). Every number
 * comes from AnalyticsService.analyzePeriod (engine 009 only — this screen
 * has no SQL and no money math, ARCH §1). The SHARED uiStore month selection
 * (007) drives a re-read on focus AND on month change (ARCH §5, A4 no cache).
 * Decision A3: category proportions are plain View bars (zero chart deps).
 * The "Analyze my spending" action is rendered but stubbed — wired in 014.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import { AnalyticsService, type SpendingSnapshot } from '@/services/AnalyticsService';
import { useUiStore } from '@/store/uiStore';
import { MonthSelector } from '@/components/analytics/MonthSelector';
import { MoMChip } from '@/components/analytics/MoMChip';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { StatGrid } from '@/components/analytics/StatGrid';
import { EmptyState } from '@/components/EmptyState';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function AnalyticsScreen() {
  const { authService } = useAuth();
  const service = useMemo(() => {
    const repos = repositories();
    return new AnalyticsService(repos.expenses, repos.budgets, repos.categories, authService);
  }, [authService]);

  const selectedMonth = useUiStore((s) => s.selectedMonth);
  const setSelectedMonth = useUiStore((s) => s.setSelectedMonth);

  const [snapshot, setSnapshot] = useState<SpendingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const snap = await service.analyzePeriod(selectedMonth);
      setSnapshot(snap);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [service, selectedMonth]);

  // Re-read on focus AND on every month change (selectedMonth is a dep).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isEmpty = snapshot !== null && snapshot.totalSen === 0;

  return (
    <View style={styles.container} testID="analytics-screen">
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
        </View>
      ) : snapshot === null ? null : isEmpty ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No expenses this month"
          body="Browse other months with the arrows above, or add expenses from the Expenses tab."
          testID="analytics-empty"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header card: month total + MoM change. */}
          <View style={styles.totalCard} testID="analytics-total-card">
            <Text style={styles.totalLabel}>Total spent</Text>
            <Text style={styles.totalAmount} testID="analytics-total">
              {formatSen(snapshot.totalSen)}
            </Text>
            <MoMChip changeSen={snapshot.changeSen} changePct={snapshot.changePct} />
          </View>

          <CategoryBreakdown breakdown={snapshot.breakdown} totalSen={snapshot.totalSen} />

          <StatGrid snapshot={snapshot} />

          {/* Top 5 largest expenses (amounts/date/category — no descriptions, A6). */}
          <View style={styles.section} testID="analytics-top-expenses">
            <Text style={styles.sectionTitle}>Top expenses</Text>
            {snapshot.largest.map((row) => (
              <View key={row.id} style={styles.expenseRow}>
                <Text style={styles.expenseAmount}>{formatSen(row.amountSen)}</Text>
                <Text style={styles.expenseMeta}>
                  {formatDayLabel(row.date)} · {row.categoryName}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => Alert.alert('Analyze my spending', 'Coming in 014')}
            accessibilityRole="button"
            testID="analytics-analyze-button"
            style={({ pressed }) => [styles.analyzeButton, pressed && styles.analyzeButtonPressed]}
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            <Text style={styles.analyzeLabel}>Analyze my spending</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
          <Text style={styles.analyzeNote}>AI analysis of your trends, pace and budget pressure — coming in 014.</Text>
          <View style={styles.spacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  content: { paddingBottom: spacing.xxl },
  totalCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  totalLabel: { fontSize: typography.caption, color: colors.muted },
  totalAmount: { fontSize: typography.money, fontWeight: '700', color: colors.text, marginVertical: spacing.xs },
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  expenseAmount: { fontSize: typography.body, color: colors.text, fontWeight: '600' },
  expenseMeta: { fontSize: typography.caption, color: colors.muted },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
  },
  analyzeButtonPressed: { opacity: 0.7 },
  analyzeLabel: { fontSize: typography.body, fontWeight: '700', color: colors.accent },
  analyzeNote: {
    fontSize: typography.caption,
    color: colors.muted,
    textAlign: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  spacer: { height: spacing.lg },
});
