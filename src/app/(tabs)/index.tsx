/**
 * Dashboard tab (Plan 003 — Asymmetrical Bento Grid cash flow intelligence hub)
 *
 * Structure:
 * 1. Hero Bento Tile: Daily allowance A_daily with MoneyDisplay hero size,
 *    total discretionary pool S_safe, status indicator (StatusPill),
 *    and tri-column liquid/budget metrics.
 * 2. Modular Split Row:
 *    - Left: Cash Flow Equation (Liquid − Bills − Reserve = S_safe) with bottom sheet breakdown.
 *    - Right: Upcoming Commitments countdown (next 2 maturing bills with countdown chips & quick-settle).
 * 3. Monthly Budget Snapshot: spent vs target progress with BudgetMeter.tsx.
 * 4. Contextual AI Daily Insight: on-device velocity analysis & free-form money inquiries.
 * 5. Floating Action Dock: one-tap triggers for + Add Expense, Transfer, and Scan Receipt.
 *
 * Invariants:
 * - Deterministic data flow: CashFlowService.snapshot(now) is the sole source of truth.
 * - Zero arithmetic on screen.
 * - Pure integer sen.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Category } from '@/db/schema';
import { CashFlowService, type CashFlowSnapshot } from '@/services/CashFlowService';
import { CategoryService } from '@/services/CategoryService';
import { AiConfigService, aiServiceOptions } from '@/services/AiConfigService';
import { toAskSnapshot } from '@/services/toAskSnapshot';
import { createAIService } from '@/ai/AIService';
import { AIUnavailableError, toAIError } from '@/ai/errors';
import type { AIResult, AskSnapshot } from '@/ai/types';
import { formatDayLabel, nextMonthStartDate } from '@/utils/dates';
import { colors, spacing } from '@/theme';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { SkeletonHome } from '@/components/ui/Skeleton';
import { useUiStore } from '@/store/uiStore';
import { HeroCard } from '@/components/dashboard/HeroCard';
import { FormulaCard } from '@/components/dashboard/FormulaCard';
import { UpcomingList } from '@/components/dashboard/UpcomingList';
import { CategorySummary } from '@/components/dashboard/CategorySummary';
import { BudgetBar } from '@/components/dashboard/BudgetBar';
import { AskAiCard } from '@/components/dashboard/AskAiCard';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Retry is a no-op while there is nothing to retry (idle/pending/result). */
const NOOP_RETRY = (): void => {};

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export default function DashboardScreen() {
  const { authService } = useAuth();
  const router = useRouter();
  const insets = useSafeInsets();
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

  const aiService = useMemo(
    () => createAIService('fake', {}, aiServiceOptions(services.aiConfig)),
    [services.aiConfig],
  );

  const [snapshot, setSnapshot] = useState<CashFlowSnapshot | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<Date | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<AIUnavailableError | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiPayload, setAiPayload] = useState<AskSnapshot | null>(null);
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

  const runAsk = useCallback(
    async (question: string, payload: AskSnapshot) => {
      if (aiBusyRef.current) return;
      aiBusyRef.current = true;
      setAiPending(true);
      setAiError(null);
      setAiResult(null);
      setAiQuestion(question);
      setAiPayload(payload);
      try {
        const result = await aiService.analyze('ask', payload, { question });
        setAiResult(result);
      } catch (err: unknown) {
        setAiError(toAIError(err));
      } finally {
        aiBusyRef.current = false;
        setAiPending(false);
      }
    },
    [aiService],
  );

  const onAsk = useCallback(
    (question: string) => {
      if (!snapshot || !snapshotAt) return;
      void runAsk(question, toAskSnapshot(snapshot, snapshotAt, categories));
    },
    [snapshot, snapshotAt, categories, runAsk],
  );

  const onAskRetry = useCallback(() => {
    if (aiQuestion && aiPayload) void runAsk(aiQuestion, aiPayload);
  }, [aiQuestion, aiPayload, runAsk]);

  const aiState = useMemo(
    () => ({
      pending: aiPending,
      error: aiError,
      result: aiResult,
      onRetry: aiError ? onAskRetry : NOOP_RETRY,
    }),
    [aiPending, aiError, aiResult, onAskRetry],
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.muted} />
  );

  if (loading && !snapshot) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={styles.centerBox} testID="dashboard-loading">
        <SkeletonHome />
      </View>
    );
  }

  if (error && !snapshot) {
    return (
      <View className="flex-1 items-center justify-center bg-background" style={styles.centerBox}>
        <InlineError message={error} testID="dashboard-error" />
      </View>
    );
  }

  if (!snapshot) return null;

  if (snapshot.accountCount === 0) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={styles.emptyWrap} refreshControl={refreshControl} testID="dashboard-empty-accounts">
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

  const noData = snapshot.spentSen === 0 && snapshot.upcomingItems.length === 0 && !snapshot.hasBudget;
  const dueBeforeLabel = formatDayLabel(nextMonthStartDate(snapshot.month.year, snapshot.month.month));
  const topCategories = snapshot.categorySummary.slice(0, 5);
  const goToBudgets = () => router.navigate('/budgets' as never);
  const goToAnalytics = () => router.navigate('/analytics' as never);

  return (
    <View className="flex-1 bg-background" testID="dashboard-screen">
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, spacing.lg),
            paddingBottom: Math.max(insets.bottom, 24) + 80,
          },
        ]}
        refreshControl={refreshControl}
      >
        <View className="px-4">
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

          {/* 1. Hero Bento Tile: Daily allowance, safe-to-spend pool, and available/spent/remaining */}
          <HeroCard
            availableSen={snapshot.availableSen}
            spentSen={snapshot.spentSen}
            remainingSen={snapshot.hasBudget ? snapshot.remainingSen : null}
            onSetBudget={goToBudgets}
            safeSen={snapshot.safeSen}
            dailyAllowanceSen={snapshot.dailyAllowanceSen}
            deficit={snapshot.deficit}
            bufferSen={snapshot.bufferSen}
            pctUsed={snapshot.budgetMetrics.pctUsed}
          />

          {/* 2. Modular Bento Split Row: Cash Flow Equation (Left) & Upcoming Commitments (Right) */}
          <View className="flex-row gap-3 mb-4">
            <FormulaCard
              breakdown={snapshot.breakdown}
              safeSen={snapshot.safeSen}
            />
            <UpcomingList
              items={snapshot.upcomingItems}
              totalSen={snapshot.upcomingSen}
              dueBeforeLabel={dueBeforeLabel}
              onOpenCommitment={(commitmentId) => router.push(`/commitments/${commitmentId}` as never)}
            />
          </View>

          {/* Category Summary (if spending recorded in categories) */}
          {topCategories.length > 0 ? (
            <CategorySummary
              summary={topCategories}
              categories={categories}
              onShowAll={goToAnalytics}
              onOpenCategory={(categoryId) => {
                setExpenseCategory(categoryId);
                router.navigate('/expenses' as never);
              }}
            />
          ) : null}

          {/* 3. Monthly Budget Snapshot */}
          <BudgetBar
            budget={snapshot.budget}
            spentSen={snapshot.spentSen}
            remainingSen={snapshot.remainingSen}
            pctUsed={snapshot.budgetMetrics.pctUsed}
            overBudget={snapshot.budgetMetrics.overBudget}
            onSetBudget={goToBudgets}
          />

          {/* 4. Contextual AI Daily Insight */}
          <AskAiCard
            ai={aiState}
            label={aiQuestion ? `You asked: ${aiQuestion}` : null}
            onSubmit={onAsk}
            disabled={snapshot === null}
          />

          <View style={styles.spacer} />
        </View>
      </KeyboardAwareScrollView>

      {/* 5. Floating Action Dock */}
      <View
        className="absolute left-4 right-4 flex-row items-center justify-between bg-card/95 border border-border/80 rounded-2xl p-2 shadow-lg"
        style={{ bottom: Math.max(insets.bottom, 16) }}
        testID="dashboard-floating-dock"
      >
        <Pressable
          onPress={() => router.push('/expenses/new' as never)}
          className="flex-1 flex-row items-center justify-center bg-primary rounded-xl py-3 px-3 gap-1.5"
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          testID="dashboard-add-expense-fab"
        >
          <Ionicons name="add" size={20} color="#090B10" />
          <Text className="text-sm font-bold text-primary-foreground">Add Expense</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/expenses/new' as never)}
          className="flex-row items-center justify-center py-3 px-3 ml-2 rounded-xl border border-border/60 bg-muted/30"
          accessibilityRole="button"
          accessibilityLabel="Transfer funds"
          testID="dashboard-action-transfer"
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.text} />
          <Text className="text-xs font-semibold text-foreground ml-1.5">Transfer</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/expenses/new' as never)}
          className="flex-row items-center justify-center py-3 px-3 ml-2 rounded-xl border border-border/60 bg-muted/30"
          accessibilityRole="button"
          accessibilityLabel="Scan receipt"
          testID="dashboard-action-scan"
        >
          <Ionicons name="camera-outline" size={18} color={colors.text} />
          <Text className="text-xs font-semibold text-foreground ml-1.5">Scan</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { flexGrow: 1 },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  spacer: { height: spacing.lg },
});
