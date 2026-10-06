/**
 * Analytics tab (Plan 007 / PRD §7.5 AN-1..4) — Executive Cash Flow Analytics Dashboard.
 * Pairs a Month-over-Month cycle stepper with a 2x2 Metrics Bento Matrix, ranked
 * Category Breakdown Proportional Bars, and a Bring-Your-Own-Key (BYOK) AI Monthly Review Container.
 *
 * Invariants:
 *  - Dynamic safe-area insets and px-4 horizontal gutter.
 *  - Preserved screen root: testID="analytics-screen".
 *  - Domain engine immutability (AnalyticsService only — no SQL or arithmetic on screen).
 *  - Pure integer sen throughout.
 *  - Monospace tabular numbers (tabular-nums).
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import { AnalyticsService, type SpendingSnapshot } from '@/services/AnalyticsService';
import { AiConfigService, aiServiceOptions } from '@/services/AiConfigService';
import { toSpendingSnapshot } from '@/services/toSpendingSnapshot';
import { createAIService } from '@/ai/AIService';
import { toAIError } from '@/ai/errors';
import type { AIUnavailableError } from '@/ai/errors';
import type { AIResult, SpendingSnapshot as AISpendingSnapshot } from '@/ai/types';
import { AIAnalysisCard, type AIAnalysisState } from '@/components/AIAnalysisCard';
import { useUiStore } from '@/store/uiStore';
import { MonthSelector } from '@/components/analytics/MonthSelector';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { StatGrid } from '@/components/analytics/StatGrid';
import { EmptyState } from '@/components/EmptyState';
import { BentoCard } from '@/components/ui/BentoCard';
import { InlineError } from '@/components/ui/InlineError';
import { List, ListRow } from '@/components/ui/List';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { SkeletonGrid, SkeletonHome } from '@/components/ui/Skeleton';
import { TouchTarget } from '@/components/ui/TouchTarget';
import { formatDayLabel } from '@/utils/dates';
import { spokenMoneyLabel } from '@/utils/money';
import { colors } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

/** A no-op retry while there is nothing to retry (idle/pending/result). */
const NOOP_RETRY = (): void => {};

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { authService } = useAuth();

  const { service, aiService } = useMemo(() => {
    const repos = repositories();
    const cfg = new AiConfigService(repos.settings, authService);
    return {
      service: new AnalyticsService(repos.expenses, repos.budgets, repos.categories, authService),
      aiService: createAIService('fake', {}, aiServiceOptions(cfg)),
    };
  }, [authService]);

  const selectedMonth = useUiStore((s) => s.selectedMonth);
  const setSelectedMonth = useUiStore((s) => s.setSelectedMonth);

  const [snapshot, setSnapshot] = useState<SpendingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- AI analysis drive state (tap-time capture) ----
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState<AIUnavailableError | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  /** The month label captured at tap time — never re-labelled mid-flight. */
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  /** The exact payload captured at tap time — used for Retry, no drift. */
  const [aiPayload, setAiPayload] = useState<AISpendingSnapshot | null>(null);

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

  // Re-read on focus AND on every month change.
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

  /** Run one analysis against the tap-time payload. */
  const runAnalysis = useCallback(
    async (label: string, payload: AISpendingSnapshot) => {
      setAiPending(true);
      setAiError(null);
      setAiResult(null);
      setAiLabel(label);
      setAiPayload(payload);
      try {
        const result = await aiService.analyze('spending', payload);
        setAiResult(result);
      } catch (runError: unknown) {
        setAiError(toAIError(runError));
      } finally {
        setAiPending(false);
      }
    },
    [aiService],
  );

  const onAnalyzePress = useCallback(() => {
    if (!snapshot || aiPending) return;
    void runAnalysis(snapshot.monthLabel, toSpendingSnapshot(snapshot));
  }, [snapshot, aiPending, runAnalysis]);

  const onRetry = useCallback(() => {
    if (aiPayload && aiLabel) void runAnalysis(aiLabel, aiPayload);
  }, [aiPayload, aiLabel, runAnalysis]);

  const aiState: AIAnalysisState = useMemo(
    () => ({
      pending: aiPending,
      error: aiError,
      result: aiResult,
      onRetry: aiError ? onRetry : NOOP_RETRY,
    }),
    [aiPending, aiError, aiResult, onRetry],
  );

  const isEmpty = snapshot !== null && snapshot.totalSen === 0;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
      testID="analytics-screen"
    >
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      {error ? <InlineError message={error} testID="analytics-error" /> : null}

      {loading ? (
        <View className="items-center pt-16 px-4" testID="analytics-loading">
          <SkeletonHome />
          <SkeletonGrid />
        </View>
      ) : snapshot === null ? null : isEmpty ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No expenses this month"
          body="Browse other months with the arrows above, or add expenses from the Expenses tab."
          action={{ label: 'Record an expense', onPress: () => router.push('/expenses/new' as never) }}
          testID="analytics-empty"
        />
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: insets.bottom + 80,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.muted}
            />
          }
        >
          {/* 1. 2x2 Metrics Bento Matrix */}
          <StatGrid snapshot={snapshot} />

          {/* 2. Ranked Category Breakdown Proportional Bars */}
          <CategoryBreakdown breakdown={snapshot.breakdown} totalSen={snapshot.totalSen} />

          {/* 3. AI Monthly Review Container */}
          <BentoCard elevated className="border-cyan-500/40 bg-card p-4 mb-4" testID="ai-analysis-card">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-8 h-8 rounded-full bg-cyan-500/10 items-center justify-center border border-cyan-500/25">
                  <Ionicons name="sparkles" size={15} color="#06b6d4" />
                </View>
                <View>
                  <Text className="text-base font-bold text-foreground">AI Monthly Review</Text>
                  <Text className="text-xs text-muted-foreground font-medium">
                    Executive cash flow analysis
                  </Text>
                </View>
              </View>

              <TouchTarget
                minHeight={44}
                onPress={onAnalyzePress}
                disabled={aiPending}
                accessibilityRole="button"
                accessibilityLabel="Analyze my spending"
                testID="analytics-analyze-button"
                className={`flex-row items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3.5 py-1.5 active:opacity-75 ${
                  aiPending ? 'opacity-50' : ''
                }`}
              >
                {aiPending ? (
                  <ActivityIndicator size="small" color="#06b6d4" />
                ) : (
                  <Ionicons name="sparkles-outline" size={14} color="#06b6d4" />
                )}
                <Text className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  {aiResult ? 'Re-analyze' : 'Analyze Month'}
                </Text>
              </TouchTarget>
            </View>

            {/* AI Result Card */}
            <AIAnalysisCard label={aiLabel ?? undefined} {...aiState} />
          </BentoCard>

          {/* 4. Top 5 Largest Expenses */}
          <BentoCard className="bg-card mb-6 p-4" testID="analytics-top-expenses">
            <Text className="text-base font-bold text-foreground mb-3 tracking-tight">
              Top Expenses
            </Text>
            <List testID="analytics-top-list" style={{ marginTop: 0, marginHorizontal: 0, borderWidth: 0, backgroundColor: 'transparent' }}>
              {snapshot.largest.map((row) => (
                <ListRow
                  key={row.id}
                  onPress={() => router.push(`/expenses/${row.id}` as never)}
                  testID={`analytics-top-expense-${row.id}`}
                >
                  <View className="w-7 h-7 rounded-full bg-muted/40 items-center justify-center mr-2 border border-border/40">
                    <Text className="text-xs font-bold text-muted-foreground">
                      {row.categoryName.charAt(0)}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground font-medium flex-shrink">
                    {formatDayLabel(row.date)} · {row.categoryName}
                  </Text>
                  <View className="ml-auto flex-shrink">
                    <MoneyDisplay
                      amountInSen={row.amountSen}
                      size="sm"
                      accessibilityLabel={`${row.categoryName}, ${spokenMoneyLabel(row.amountSen)}`}
                    />
                  </View>
                </ListRow>
              ))}
            </List>
          </BentoCard>
        </ScrollView>
      )}
    </View>
  );
}