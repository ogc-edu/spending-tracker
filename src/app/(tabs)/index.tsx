/**
 * Dashboard tab (plan 010 / PRD DASH-1..5) — the product's heart: one
 * deterministic view of available money, spent, remaining budget, upcoming
 * commitments, safe-to-spend, daily allowance, the budget bar, and the
 * category summary (ARCH §8 pipeline).
 *
 * Data flow: `CashFlowService.snapshot(now)` reads the same rows the other
 * tabs show and runs them through the pure engine — this screen contains NO
 * SQL and NO financial arithmetic (NFR-7). It re-reads on focus and supports
 * pull-to-refresh; `now` is derived at call time so the calendar rolls over
 * without restart (A4: no cache).
 *
 * First-class states (never crashes): no accounts → CTA to create one
 * (Settings/004); no overall budget → "—" + "Set a budget" prompt; deficit
 * (safe < 0) → the SafeToSpendCard's danger state + warning copy.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Category } from '@/db/schema';
import { CashFlowService, type CashFlowSnapshot } from '@/services/CashFlowService';
import { CategoryService } from '@/services/CategoryService';
import { formatDayLabel, nextMonthStartDate } from '@/utils/dates';
import { colors, spacing, typography } from '@/theme';
import { HeroCard } from '@/components/dashboard/HeroCard';
import { SafeToSpendCard } from '@/components/dashboard/SafeToSpendCard';
import { FormulaCard } from '@/components/dashboard/FormulaCard';
import { UpcomingList } from '@/components/dashboard/UpcomingList';
import { BudgetBar } from '@/components/dashboard/BudgetBar';
import { CategorySummary } from '@/components/dashboard/CategorySummary';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function DashboardScreen() {
  const { authService } = useAuth();
  const router = useRouter();
  const services = useMemo(() => {
    const repos = repositories();
    return {
      cashflow: new CashFlowService(
        repos.accounts,
        repos.expenses,
        repos.budgets,
        repos.commitments,
        repos.settings,
        authService,
      ),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [snapshot, setSnapshot] = useState<CashFlowSnapshot | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [snap, cats] = await Promise.all([
        services.cashflow.snapshot(new Date()),
        services.categories.list(),
      ]);
      setSnapshot(snap);
      setCategories(cats);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [services.cashflow, services.categories]);

  // Re-read SQLite every time the tab gains focus (ARCH §5) — no cache (A4).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const explainStub = useCallback(() => {
    // Plan 015 wires "Explain my allowance" to the AI provider; this plan
    // renders the entry point only.
    Alert.alert('Explain my allowance', 'AI explanation lands in a later update.');
  }, []);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.muted} />
  );

  if (loading && !snapshot) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && !snapshot) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!snapshot) return null;

  // No accounts: a first-class CTA, not a crash (plan §Edge cases).
  if (snapshot.accountCount === 0) {
    return (
      <ScrollView contentContainerStyle={styles.emptyWrap} refreshControl={refreshControl} testID="dashboard-empty-accounts">
        <Ionicons name="wallet-outline" size={44} color={colors.muted} />
        <Text style={styles.emptyTitle}>No accounts yet</Text>
        <Text style={styles.emptyBody}>
          Add an account to start tracking your available money, safe-to-spend and commitments.
        </Text>
        <Pressable
          onPress={() => router.navigate('/settings' as never)}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="dashboard-create-account"
        >
          <Text style={styles.ctaLabel}>Create an account</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const dueBeforeLabel = formatDayLabel(nextMonthStartDate(snapshot.month.year, snapshot.month.month));
  const topCategories = snapshot.categorySummary.slice(0, 5);
  const goToBudgets = () => router.navigate('/budgets' as never);
  const goToAnalytics = () => router.navigate('/analytics' as never);

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl} testID="dashboard-screen">
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <HeroCard
        availableSen={snapshot.availableSen}
        spentSen={snapshot.spentSen}
        remainingSen={snapshot.hasBudget ? snapshot.remainingSen : null}
        onSetBudget={goToBudgets}
      />

      <SafeToSpendCard
        safeSen={snapshot.safeSen}
        deficit={snapshot.deficit}
        dailyAllowanceSen={snapshot.dailyAllowanceSen}
      />

      <FormulaCard
        breakdown={snapshot.breakdown}
        safeSen={snapshot.safeSen}
        onExplain={explainStub}
      />

      <BudgetBar
        budget={snapshot.budget}
        spentSen={snapshot.spentSen}
        remainingSen={snapshot.remainingSen}
        pctUsed={snapshot.budgetMetrics.pctUsed}
        overBudget={snapshot.budgetMetrics.overBudget}
        onSetBudget={goToBudgets}
      />

      <UpcomingList
        items={snapshot.upcomingItems}
        totalSen={snapshot.upcomingSen}
        dueBeforeLabel={dueBeforeLabel}
      />

      {topCategories.length > 0 ? (
        <CategorySummary
          summary={topCategories}
          categories={categories}
          onShowAll={goToAnalytics}
        />
      ) : null}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  emptyTitle: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  emptyBody: { fontSize: typography.body, color: colors.muted, textAlign: 'center', lineHeight: 21, marginBottom: spacing.lg },
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.8 },
  ctaLabel: { color: '#fff', fontSize: typography.body, fontWeight: '700' },
  spacer: { height: spacing.lg },
});
