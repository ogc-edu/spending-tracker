/**
 * Budgets tab (Plan 005 — 2-Column Allocations Grid & Budgets Manager)
 *
 * Screen layout:
 * - Dynamic safe area insets and px-4 horizontal gutter.
 * - Month cycle stepper: < October 2026 > with tabular-nums typography.
 * - Overall Monthly Budget Bento Card with dynamic multi-tier BudgetMeter,
 *   remaining funds, and daily buffer calculation (S_safe / D_rem).
 * - Two-Column Category Allocations Grid covering all system categories with
 *   individual progress meters, 48px touch targets, and "Set limit" affordances.
 * - Native gesture-driven Budget Limit Sheet with quick allocation presets (+10%, +25%, Reset).
 *
 * Invariants:
 * - Pure integer sen.
 * - Zero arithmetic on screen (engine totals and metrics).
 * - Full test contract preservation across all testIDs.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Budget, Category } from '@/db/schema';
import { BudgetService } from '@/services/BudgetService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { expenseTotalsByCategory, monthlyTotals } from '@/engine/totals';
import { useUiStore, type MonthSelection } from '@/store/uiStore';
import { formatMonthLabel } from '@/utils/dates';
import { BudgetCard } from '@/components/BudgetCard';
import { BudgetForm } from '@/components/BudgetForm';
import { BudgetRow } from '@/components/BudgetRow';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { InlineError } from '@/components/ui/InlineError';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { TouchTarget } from '@/components/ui/TouchTarget';
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ToastProvider';
import { categoryColor } from '@/components/categoryMeta';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Shift a month selection by ±n months with proper year rollover. */
function shiftMonth(selection: MonthSelection, delta: number): MonthSelection {
  const total = selection.year * 12 + (selection.month - 1) + delta;
  return { month: (total % 12) + 1, year: Math.floor(total / 12) };
}

type BudgetEditing = { kind: 'overall' } | { kind: 'category'; category: Category };

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const { authService } = useAuth();
  const toast = useToast();
  const services = useMemo(() => {
    const repos = repositories();
    return {
      budgets: new BudgetService(repos.budgets, repos.categories, authService),
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const selectedMonth = useUiStore((s) => s.selectedMonth);
  const setSelectedMonth = useUiStore((s) => s.setSelectedMonth);

  const [overall, setOverall] = useState<Budget | null>(null);
  const [byCategory, setByCategory] = useState<Map<number, Budget>>(new Map());
  const [spentTotal, setSpentTotal] = useState(0);
  const [categorySpent, setCategorySpent] = useState<Map<number, number>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<BudgetEditing | null>(null);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clearing, setClearing] = useState<{ categoryId: number | null; categoryName?: string } | null>(null);

  const load = useCallback(async () => {
    const scope = { month: selectedMonth.month, year: selectedMonth.year };
    try {
      const [view, expenses, cats] = await Promise.all([
        services.budgets.forMonthWithCategories(scope.month, scope.year),
        services.expenses.listForMonth(scope.year, scope.month),
        services.categories.list(),
      ]);
      setOverall(view.overall);
      setByCategory(view.byCategory);
      setSpentTotal(monthlyTotals(expenses, scope));
      setCategorySpent(expenseTotalsByCategory(expenses, scope));
      setCategories(cats);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [services.budgets, services.expenses, services.categories, selectedMonth]);

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

  /** The current amountSen for an editing target (prefill), or null for a fresh form. */
  const editingInitial = useMemo<number | null>(() => {
    if (!editing) return null;
    if (editing.kind === 'overall') return overall?.amountSen ?? null;
    return byCategory.get(editing.category.id)?.amountSen ?? null;
  }, [editing, overall, byCategory]);

  const handleUpsert = useCallback(
    async (amountSen: number) => {
      if (!editing) return;
      setBusy(true);
      try {
        await services.budgets.upsert({
          categoryId: editing.kind === 'overall' ? null : editing.category.id,
          month: selectedMonth.month,
          year: selectedMonth.year,
          amountSen,
        });
        setEditing(null);
        toast.show('Budget saved');
        await load();
      } catch (submitError: unknown) {
        toast.show(`Could not save budget: ${errMsg(submitError)}`);
      } finally {
        setBusy(false);
      }
    },
    [editing, services.budgets, selectedMonth, load, toast],
  );

  const handleClear = useCallback(
    async (key: { categoryId: number | null; categoryName?: string }) => {
      setBusy(true);
      try {
        await services.budgets.clear({
          categoryId: key.categoryId,
          month: selectedMonth.month,
          year: selectedMonth.year,
        });
        setClearing(null);
        await load();
      } catch (clearError: unknown) {
        toast.show(`Could not clear budget: ${errMsg(clearError)}`);
        setClearing(null);
      } finally {
        setBusy(false);
      }
    },
    [services.budgets, selectedMonth, load, toast],
  );

  const requestClear = (key: { categoryId: number | null; categoryName?: string }) => setClearing(key);

  const submitLabel = editingInitial !== null ? 'Save budget' : 'Set budget';

  return (
    <View
      style={[styles.container, { paddingTop: insets.top }]}
      testID="budgets-screen"
      className="flex-1 bg-background"
    >
      {/* Month selector cycle stepper — shared uiStore month */}
      <View
        className="flex-row items-center justify-between px-4 py-3 bg-card border-b border-border/60"
        testID="budgets-month-bar"
      >
        <TouchTarget
          minHeight={44}
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="budgets-month-prev"
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </TouchTarget>
        <View className="bg-primary/10 rounded-full py-1.5 px-4 border border-primary/20">
          <Text
            className="text-base font-extrabold text-primary tracking-tight font-mono"
            style={{ fontVariant: ['tabular-nums'] }}
            testID="budgets-month-label"
          >
            {formatMonthLabel(selectedMonth.year, selectedMonth.month)}
          </Text>
        </View>
        <TouchTarget
          minHeight={44}
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="budgets-month-next"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </TouchTarget>
      </View>

      {error ? <InlineError message={error} testID="budgets-error" /> : null}

      {loading ? (
        <View style={styles.centerBox} testID="budgets-loading">
          <SkeletonCard />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
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
          {overall === null && byCategory.size === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="pie-chart-outline"
                title="No budgets set"
                body="Set a monthly budget to reserve spending in your cash flow — category budgets are optional extras."
                action={{ label: 'Set a monthly budget', onPress: () => setEditing({ kind: 'overall' }) }}
                testID="budgets-empty"
              />
            </View>
          ) : null}

          {/* Overall Monthly Budget Bento Card */}
          <BudgetCard
            spentSen={spentTotal}
            budget={overall}
            onPress={() => setEditing({ kind: 'overall' })}
            onClear={() => requestClear({ categoryId: null, categoryName: 'Monthly budget' })}
            busy={busy}
            year={selectedMonth.year}
            month={selectedMonth.month}
          />

          {/* Section header */}
          <SectionHeader
            title="Category allocations"
            note="Informational only — the overall monthly budget is what your cash flow reserves."
            style={{ marginHorizontal: 0 }}
          />

          {/* Two-Column Category Allocations Grid covering all system categories */}
          <View className="flex-row flex-wrap -mx-1.5" testID="category-allocations-grid">
            {categories.map((category) => (
              <View key={category.id} className="w-1/2 px-1.5">
                <BudgetRow
                  category={category}
                  spentSen={categorySpent.get(category.id) ?? 0}
                  budget={byCategory.get(category.id) ?? null}
                  onPress={() => setEditing({ kind: 'category', category })}
                  onClear={() => requestClear({ categoryId: category.id, categoryName: category.name })}
                  busy={busy}
                />
              </View>
            ))}
          </View>

          {/* Add Category Budget trigger for categories without a budget */}
          <Pressable
            onPress={() => setPickingCategory(true)}
            className="flex-row items-center justify-center gap-2 min-h-[48px] mt-2 mb-4 border border-dashed border-primary/40 rounded-xl bg-primary/5"
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
            testID="budgets-add-category"
          >
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text className="text-primary text-base font-bold">Add category budget</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Budget Limit Entry Sheet */}
      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        cardTestID="budget-form-modal"
      >
        <BudgetForm
          title={editing?.kind === 'category' ? `${editing.category.name} budget` : 'Monthly budget'}
          initialAmountSen={editingInitial}
          submitLabel={submitLabel}
          onSubmit={handleUpsert}
          submitting={busy}
          onCancel={() => setEditing(null)}
        />
      </Sheet>

      {/* Category picker Sheet */}
      <Sheet
        visible={pickingCategory}
        onClose={() => setPickingCategory(false)}
        title="Add a category budget"
        cardTestID="budgets-category-picker"
      >
        <Text style={styles.sheetNote}>
          Pick a category to set its monthly budget for {formatMonthLabel(selectedMonth.year, selectedMonth.month)}.
        </Text>
        <View style={styles.pickerChips}>
          {categories.filter((c) => !byCategory.has(c.id)).map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              icon={category.icon as never}
              iconColor={categoryColor(category.id)}
              onPress={() => {
                setPickingCategory(false);
                setEditing({ kind: 'category', category });
              }}
              testID={`budgets-pick-category-${category.id}`}
            />
          ))}
          {categories.every((c) => byCategory.has(c.id)) ? (
            <Text style={styles.sheetNote}>Every category already has a budget this month.</Text>
          ) : null}
        </View>
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => setPickingCategory(false)}
          testID="budgets-category-picker-cancel"
        />
      </Sheet>

      {/* Confirm clear dialog */}
      <ConfirmSheet
        visible={clearing !== null}
        title="Clear budget"
        message={
          clearing
            ? `Clear the ${clearing.categoryName ?? 'budget'} for ${formatMonthLabel(selectedMonth.year, selectedMonth.month)}? This only removes the budget — your expenses stay.`
            : ''
        }
        confirmLabel="Clear"
        busy={busy}
        onConfirm={() => clearing && void handleClear(clearing)}
        onCancel={() => setClearing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  sheetNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  emptyWrap: { marginBottom: spacing.lg },
  pressed: { opacity: 0.7 },
});