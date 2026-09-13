/**
 * Budgets tab (plan 007 / BUD-1..4) — monthly overall + per-category budgets.
 *
 * Data flow: the shared uiStore month selection (default = current calendar
 * month; Analytics will reuse the same object in 011) drives a load that
 * re-reads SQLite on focus AND on month change (A4: no cache). Spent comes
 * from the PLAN 005 engine — monthlyTotals / expenseTotalsByCategory over the
 * month's expense rows — and every budget's metrics come from the pure
 * engine's budgetMetrics; this screen contains no SQL and no money math
 * (ARCH §1, plan 007 §Constraints).
 *
 * Interactions: tap the overall card / any category row to open the RHF + Zod
 * BudgetForm (sen via parseMoneyToSen); "Clear" removes a row. Editing and
 * clearing past months is allowed (no retroactive restrictions). Over-budget
 * is an in-app flag — danger color + label, no notifications anywhere. The
 * overall budget is the only one that will ever feed cash flow (PRD §8.4,
 * built by plan 009/010) — category budgets are informational rows (BUD-3).
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  // Plan 016: clearing a budget is destructive → ConfirmSheet (with the
  // month/category context), never a silent row removal.
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

  /** The budget rows' clear affordance now opens the ConfirmSheet (016). */
  const requestClear = (key: { categoryId: number | null; categoryName?: string }) => setClearing(key);

  const submitLabel = editingInitial !== null ? 'Save budget' : 'Set budget';

  return (
    <View style={styles.container} testID="budgets-screen">
      {/* Month selector — shared uiStore month (Analytics 011 reuses it). */}
      <View style={styles.monthBar} testID="budgets-month-bar">
        <Pressable
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          hitSlop={11}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="budgets-month-prev"
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <View style={styles.monthLabelPill}>
          <Text style={styles.monthLabel} testID="budgets-month-label">
            {formatMonthLabel(selectedMonth.year, selectedMonth.month)}
          </Text>
        </View>
        <Pressable
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          hitSlop={11}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="budgets-month-next"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.accent} />
        </Pressable>
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
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={colors.muted} />}
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

          <BudgetCard
            spentSen={spentTotal}
            budget={overall}
            onPress={() => setEditing({ kind: 'overall' })}
            onClear={() => requestClear({ categoryId: null, categoryName: 'Monthly budget' })}
            busy={busy}
          />

          <SectionHeader
            title="Category budgets"
            note="Informational only — the overall monthly budget is what your cash flow reserves."
          />
          {/* Only categories WITH a budget get a row — no more walls of unset "—" rows. */}
          {categories
            .filter((category) => byCategory.has(category.id))
            .map((category) => (
              <BudgetRow
                key={category.id}
                category={category}
                spentSen={categorySpent.get(category.id) ?? 0}
                budget={byCategory.get(category.id) ?? null}
                onPress={() => setEditing({ kind: 'category', category })}
                onClear={() => requestClear({ categoryId: category.id, categoryName: category.name })}
                busy={busy}
              />
            ))}
          <Pressable
            onPress={() => setPickingCategory(true)}
            style={({ pressed }) => [styles.addCategoryRow, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="budgets-add-category"
          >
            <Ionicons name="add" size={18} color={colors.accent} />
            <Text style={styles.addCategoryLabel}>Add category budget</Text>
          </Pressable>
          <View style={styles.spacer} />
        </ScrollView>
      )}

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

      {/* Category picker for NEW category budgets (only categories without one). */}
      <Sheet
        visible={pickingCategory}
        onClose={() => setPickingCategory(false)}
        title="Add a category budget"
        cardTestID="budgets-category-picker"
      >
        <Text style={styles.sheetNote}>Pick a category to set its monthly budget for {formatMonthLabel(selectedMonth.year, selectedMonth.month)}.</Text>
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
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  monthLabelPill: {
    backgroundColor: colors.accentSoft,
    borderRadius: 999,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
  },
  monthLabel: { fontSize: typography.emphasis, fontWeight: '800', color: colors.accent, letterSpacing: -0.2 },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '800',
    color: colors.text,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
    letterSpacing: -0.2,
  },
  sectionNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  pickerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  sheetNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  spacer: { height: spacing.lg },
  // Gap under the empty-state CTA so it never sticks to the "Monthly budget" card below (plan 016 follow-up).
  emptyWrap: { marginBottom: spacing.lg },
  addCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    borderRadius: spacing.md,
    backgroundColor: colors.accentSoft,
  },
  addCategoryLabel: { color: colors.accent, fontSize: typography.body, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});