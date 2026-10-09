/**
 * Dashboard tab. Plan 020 cut it down to what the user reads:
 * 1. Month summary: spent this month + due by end of month.
 * 2. Commitments due by end of month.
 * 3. Category summary.
 * 4. "Ask about your money" AI box.
 * Plus the Add-expense FAB.
 *
 * Invariants:
 * - Deterministic data flow: CashFlowService.snapshot(now) is the sole source of truth.
 * - Zero arithmetic on screen.
 * - Pure integer sen.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
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
import { formatDayLabel, formatMonthLabel, nextMonthStartDate } from '@/utils/dates';
import { colors, spacing } from '@/theme';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { SkeletonHome } from '@/components/ui/Skeleton';
import { useUiStore } from '@/store/uiStore';
import { MonthSummaryCard } from '@/components/dashboard/MonthSummaryCard';
import { UpcomingList } from '@/components/dashboard/UpcomingList';
import { CategorySummary } from '@/components/dashboard/CategorySummary';
import { AskAiCard } from '@/components/dashboard/AskAiCard';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Fab } from '@/components/ui/Fab';

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
        repos.commitments,
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
      if (!snapshot) return;
      void runAsk(question, toAskSnapshot(snapshot, categories));
    },
    [snapshot, categories, runAsk],
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
          body="Add an account to start tracking your spending and commitments."
          action={{ label: 'Create an account', onPress: () => router.navigate('/settings' as never) }}
          testID="dashboard-empty-accounts"
        />
      </ScrollView>
    );
  }

  const noData = snapshot.spentSen === 0 && snapshot.upcomingItems.length === 0;
  const dueBeforeLabel = formatDayLabel(nextMonthStartDate(snapshot.month.year, snapshot.month.month));
  const topCategories = snapshot.categorySummary.slice(0, 5);
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
              body="Record an expense or add a commitment to get started."
              action={{ label: 'Record an expense', onPress: () => router.push('/expenses/new' as never) }}
              testID="dashboard-empty-data"
            />
          ) : null}

          <MonthSummaryCard
            spentSen={snapshot.spentSen}
            dueSen={snapshot.upcomingSen}
            monthLabel={formatMonthLabel(snapshot.month.year, snapshot.month.month)}
          />

          <View className="mb-4">
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

          {/* Ask about your money (plan 019) */}
          <AskAiCard
            ai={aiState}
            label={aiQuestion ? `You asked: ${aiQuestion}` : null}
            onSubmit={onAsk}
            disabled={snapshot === null}
          />

          <View style={styles.spacer} />
        </View>
      </KeyboardAwareScrollView>

      <Fab onPress={() => router.push('/expenses/new' as never)} label="Add expense" testID="add-expense-fab" />
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
