/**
 * Dashboard tab (plan 010 / PRD DASH-1..5) — the product's heart: one
 * deterministic view of available money, spent, remaining budget, upcoming
 * commitments, safe-to-spend, daily allowance, the budget bar, and the
 * category summary (ARCH §8 pipeline).
 *
 * Card order: what is COMMITTED or already spent comes first (hero → upcoming
 * → by category), then the derived guidance (safe-to-spend → its formula →
 * the budget bar).
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
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Category } from '@/db/schema';
import { CashFlowService, type CashFlowSnapshot } from '@/services/CashFlowService';
import { CategoryService } from '@/services/CategoryService';
import { AiConfigService, aiServiceOptions } from '@/services/AiConfigService';
import { toAllowanceSnapshot } from '@/services/toAllowanceSnapshot';
import { createAIService } from '@/ai/AIService';
import { AIUnavailableError, toAIError } from '@/ai/errors';
import type { AIResult } from '@/ai/types';
import { formatDayLabel, nextMonthStartDate } from '@/utils/dates';
import { colors, spacing } from '@/theme';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/ui/Fab';
import { InlineError } from '@/components/ui/InlineError';
import { SkeletonHome } from '@/components/ui/Skeleton';
import { useUiStore } from '@/store/uiStore';
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
  const setExpenseCategory = useUiStore((s) => s.setExpenseCategory);
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
      aiConfig: new AiConfigService(repos.settings, authService),
    };
  }, [authService]);

  // The ACTIVE provider (013): persisted choice + key + model via the config
  // layer; with nothing configured, analyze() throws a typed error and the
  // card shows "No AI provider configured" — the app works fully (DoD 16).
  const aiService = useMemo(
    () => createAIService('fake', {}, aiServiceOptions(services.aiConfig)),
    [services.aiConfig],
  );

  const [snapshot, setSnapshot] = useState<CashFlowSnapshot | null>(null);
  // The reference date the current snapshot was built with — the AI payload's
  // daysRemaining must agree with the snapshot's dailyAllowanceSen (015).
  const [snapshotAt, setSnapshotAt] = useState<Date | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Explain my allowance" UI state (015) — pending / typed error / result.
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<AIUnavailableError | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  // Pending guard for rapid taps: one request in flight per snapshot (013/015
  // behaviour — a double-tap must never fire a second analyze).
  const aiBusyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const [snap, cats] = await Promise.all([
        services.cashflow.snapshot(now),
        services.categories.list(),
      ]);
      setSnapshot(snap);
      setSnapshotAt(now);
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

  /**
   * "Explain my allowance" (015 / DASH-4): map the CURRENT snapshot (010) to
   * the allowance payload — no recomputation — and dispatch to the active
   * provider via AIService (012/013). The pending guard drops rapid
   * double-taps: only one request may be in flight at a time.
   */
  const explainAllowance = useCallback(async () => {
    if (aiBusyRef.current) return;
    if (!snapshot || !snapshotAt) return;
    aiBusyRef.current = true;
    setAiPending(true);
    setAiError(null);
    setAiResult(null);
    try {
      const allowance = toAllowanceSnapshot(snapshot, snapshotAt);
      const result = await aiService.analyze('allowance', allowance);
      setAiResult(result);
    } catch (err: unknown) {
      // analyze() already throws typed AIUnavailableError; toAIError keeps it
      // typed if anything unexpected slips through (012 contract).
      setAiError(toAIError(err));
    } finally {
      aiBusyRef.current = false;
      setAiPending(false);
    }
  }, [aiService, snapshot, snapshotAt]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.muted} />
  );

  if (loading && !snapshot) {
    return (
      <View style={styles.centerBox} testID="dashboard-loading">
        <SkeletonHome />
      </View>
    );
  }

  if (error && !snapshot) {
    return (
      <View style={styles.centerBox}>
        <InlineError message={error} testID="dashboard-error" />
      </View>
    );
  }

  if (!snapshot) return null;

  // No accounts: a first-class CTA, not a crash (plan §Edge cases) — the
  // CTA links to Settings → Accounts (016: EmptyState with action links).
  if (snapshot.accountCount === 0) {
    return (
      <ScrollView contentContainerStyle={styles.emptyWrap} refreshControl={refreshControl} testID="dashboard-empty-accounts">
        <EmptyState
          icon="wallet-outline"
          title="No accounts yet"
          body="Add an account to start tracking your available money, safe-to-spend and commitments."
          action={{ label: 'Create an account', onPress: () => router.navigate('/settings' as never) }}
          testID="dashboard-empty-accounts"
        />
      </ScrollView>
    );
  }

  // Accounts exist but nothing has happened yet (016 "no data"): a quiet
  // prompt to record the first expense — the zeroed cards below still show
  // the available balance, so this is guidance, not a replacement.
  const noData = snapshot.spentSen === 0 && snapshot.upcomingItems.length === 0 && !snapshot.hasBudget;

  const dueBeforeLabel = formatDayLabel(nextMonthStartDate(snapshot.month.year, snapshot.month.month));
  const topCategories = snapshot.categorySummary.slice(0, 5);
  const goToBudgets = () => router.navigate('/budgets' as never);
  const goToAnalytics = () => router.navigate('/analytics' as never);

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={refreshControl} testID="dashboard-screen">
      {error ? <InlineError message={error} testID="dashboard-error" /> : null}

      {noData ? (
        <EmptyState
          icon="receipt-outline"
          title="No data yet"
          body="Record an expense, set a budget, or add a commitment to bring your cash flow to life."
          action={{ label: 'Record an expense', onPress: () => router.push('/expenses/new' as never) }}
          testID="dashboard-empty-data"
        />
      ) : null}

      <HeroCard
        availableSen={snapshot.availableSen}
        spentSen={snapshot.spentSen}
        remainingSen={snapshot.hasBudget ? snapshot.remainingSen : null}
        onSetBudget={goToBudgets}
      />

      <UpcomingList
        items={snapshot.upcomingItems}
        totalSen={snapshot.upcomingSen}
        dueBeforeLabel={dueBeforeLabel}
        onOpenCommitment={(commitmentId) => router.push(`/commitments/${commitmentId}` as never)}
      />

      {topCategories.length > 0 ? (
        <CategorySummary
          summary={topCategories}
          categories={categories}
          onShowAll={goToAnalytics}
          onOpenCategory={(categoryId) => {
            // Plan 018: a category row IS the filter — open Expenses on it.
            setExpenseCategory(categoryId);
            router.navigate('/expenses' as never);
          }}
        />
      ) : null}

      <SafeToSpendCard
        safeSen={snapshot.safeSen}
        deficit={snapshot.deficit}
        dailyAllowanceSen={snapshot.dailyAllowanceSen}
      />

      <FormulaCard
        breakdown={snapshot.breakdown}
        safeSen={snapshot.safeSen}
        onExplain={() => void explainAllowance()}
        ai={{ pending: aiPending, error: aiError, result: aiResult, onRetry: () => void explainAllowance() }}
      />

      <BudgetBar
        budget={snapshot.budget}
        spentSen={snapshot.spentSen}
        remainingSen={snapshot.remainingSen}
        pctUsed={snapshot.budgetMetrics.pctUsed}
        overBudget={snapshot.budgetMetrics.overBudget}
        onSetBudget={goToBudgets}
      />

      <View style={styles.spacer} />

      {/* Plan 018: the dashboard's most common write — record an expense. */}
      <Fab onPress={() => router.push('/expenses/new' as never)} label="Add expense" testID="dashboard-add-expense-fab" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { paddingTop: spacing.lg, paddingBottom: 96 },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  spacer: { height: spacing.lg },
});
