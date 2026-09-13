/**
 * Analytics tab (plan 011 / PRD §7.5 AN-1..4) — deterministic month analytics
 * from the typed SpendingSnapshot (the exact 014 AI payload). Every number
 * comes from AnalyticsService.analyzePeriod (engine 009 only — this screen
 * has no SQL and no money math, ARCH §1). The SHARED uiStore month selection
 * (007) drives a re-read on focus AND on month change (ARCH §5, A4 no cache).
 * Decision A3: category proportions are plain View bars (zero chart deps).
 *
 * Plan 014 (AN-5) — "Analyze my spending": the action button sits next to the
 * MoM chip and sends the RENDERED month's snapshot (tap-time mapping, no
 * drift mid-flight) through AIService.analyze('spending', …) — no provider
 * logic here (BYOK/config lives in AiConfigService, 013). The shared
 * AIAnalysisCard renders under the chip: pending / typed error + Retry /
 * Zod-validated result, labelled with the analyzed month (a month change
 * mid-flight never re-labels a stale result). Previous-month-zero baseline →
 * changePct null → the prompt covers "no comparison available" (no invented
 * trends, AI-3). Empty month → button hidden, not an error.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import {
  AIAnalysisCard,
  type AIAnalysisState,
} from '@/components/AIAnalysisCard';
import { useUiStore } from '@/store/uiStore';
import { MonthSelector } from '@/components/analytics/MonthSelector';
import { MoMChip } from '@/components/analytics/MoMChip';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { StatGrid } from '@/components/analytics/StatGrid';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { List, ListRow } from '@/components/ui/List';
import { SkeletonGrid, SkeletonHome } from '@/components/ui/Skeleton';
import { formatDayLabel } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography, shadows } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A no-op retry while there is nothing to retry (idle/pending/result). */
const NOOP_RETRY = (): void => {};

export default function AnalyticsScreen() {
  const router = useRouter();
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

  // ---- Plan 014 — the AI analysis drive state (tap-time capture). ----
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

  // Re-read on focus AND on every month change (selectedMonth is a dep).
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
   * Run one analysis against the TAP-TIME payload. Both `label` and `payload`
   * are captured by the caller (the state the screen renders at tap time), so
   * a month change mid-flight only affects the next tap, never this request.
   */
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

  /** The card's state bundle — the shared contract (015 uses the same shape). */
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
    <View style={styles.container} testID="analytics-screen">
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      {error ? <InlineError message={error} testID="analytics-error" /> : null}

      {loading ? (
        <View style={styles.centerBox} testID="analytics-loading">
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
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.muted} />}
        >
          {/* Header card: month total + MoM change + the 014 action. */}
          <View style={styles.totalCard} testID="analytics-total-card">
            <Text style={styles.totalLabel}>Total spent</Text>
            <Text
              style={styles.totalAmount}
              numberOfLines={1}
              accessibilityLabel={`Total spent, ${spokenMoneyLabel(snapshot.totalSen)}`}
              testID="analytics-total"
            >
              {formatSen(snapshot.totalSen)}
            </Text>
            <View style={styles.momRow}>
              <MoMChip changeSen={snapshot.changeSen} changePct={snapshot.changePct} />
              <Pressable
                onPress={onAnalyzePress}
                disabled={aiPending}
                accessibilityRole="button"
                accessibilityLabel="Analyze my spending"
                testID="analytics-analyze-button"
                style={({ pressed }) => [
                  styles.analyzeButton,
                  pressed && styles.analyzeButtonPressed,
                  aiPending && styles.analyzeButtonDisabled,
                ]}
              >
                {aiPending ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
                )}
                <Text style={styles.analyzeLabel}>Analyze my spending</Text>
              </Pressable>
            </View>

            {/* Shared AI card — renders nothing until an analysis starts. */}
            <AIAnalysisCard label={aiLabel ?? undefined} {...aiState} />
          </View>

          <CategoryBreakdown breakdown={snapshot.breakdown} totalSen={snapshot.totalSen} />

          <StatGrid snapshot={snapshot} />

          {/* Top 5 largest expenses (amounts/date/category — no descriptions, A6). */}
          <View style={styles.section} testID="analytics-top-expenses">
            <Text style={styles.sectionTitle}>Top expenses</Text>
            <List style={styles.expenseList} testID="analytics-top-list">
              {snapshot.largest.map((row) => (
                <ListRow
                  key={row.id}
                  onPress={() => router.push(`/expenses/${row.id}` as never)}
                  testID={`analytics-top-expense-${row.id}`}
                >
                  <View style={styles.rankDot}>
                    <Text style={styles.rankText}>{row.categoryName.charAt(0)}</Text>
                  </View>
                  <Text style={styles.expenseMeta}>
                    {formatDayLabel(row.date)} · {row.categoryName}
                  </Text>
                  <Text style={styles.expenseAmount} numberOfLines={1} accessibilityLabel={`${row.categoryName}, ${spokenMoneyLabel(row.amountSen)}`}>
                    {formatSen(row.amountSen)}
                  </Text>
                </ListRow>
              ))}
            </List>
          </View>

          <View style={styles.spacer} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  content: { paddingBottom: spacing.xxl },
  totalCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  totalLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalAmount: { fontSize: typography.display, fontWeight: '800', color: colors.text, marginVertical: spacing.xs, fontVariant: moneyFontVariant, letterSpacing: -0.5 },
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  analyzeButtonPressed: { opacity: 0.75 },
  analyzeButtonDisabled: { opacity: 0.5 },
  analyzeLabel: { fontSize: typography.caption, fontWeight: '700', color: colors.accent },
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: -0.2,
  },
  expenseList: { marginTop: 0, marginHorizontal: 0, borderWidth: 0, shadowOpacity: 0 },
  rankDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: typography.caption, fontWeight: '800', color: colors.muted },
  expenseAmount: { fontSize: typography.body, color: colors.text, fontWeight: '700', fontVariant: moneyFontVariant, marginLeft: 'auto', flexShrink: 1 },
  expenseMeta: { fontSize: typography.caption, color: colors.muted, fontWeight: '500', flexShrink: 1 },
  spacer: { height: spacing.lg },
});