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
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<BudgetEditing | null>(null);
  const [busy, setBusy] = useState(false);

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
        await load();
      } catch (submitError: unknown) {
        Alert.alert('Budget', errMsg(submitError));
      } finally {
        setBusy(false);
      }
    },
    [editing, services.budgets, selectedMonth, load],
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
        await load();
      } catch (clearError: unknown) {
        Alert.alert('Budget', errMsg(clearError));
      } finally {
        setBusy(false);
      }
    },
    [services.budgets, selectedMonth, load],
  );

  const submitLabel = editingInitial !== null ? 'Save budget' : 'Set budget';

  return (
    <View style={styles.container} testID="budgets-screen">
      {/* Month selector — shared uiStore month (Analytics 011 reuses it). */}
      <View style={styles.monthBar} testID="budgets-month-bar">
        <Pressable
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          testID="budgets-month-prev"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel} testID="budgets-month-label">
          {formatMonthLabel(selectedMonth.year, selectedMonth.month)}
        </Text>
        <Pressable
          onPress={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          testID="budgets-month-next"
        >
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <BudgetCard
            spentSen={spentTotal}
            budget={overall}
            onPress={() => setEditing({ kind: 'overall' })}
            onClear={() => void handleClear({ categoryId: null })}
            busy={busy}
          />

          <Text style={styles.sectionTitle}>Category budgets</Text>
          <Text style={styles.sectionNote}>
            Informational only — the overall monthly budget is what your cash flow reserves.
          </Text>
          {categories.map((category) => (
            <BudgetRow
              key={category.id}
              category={category}
              spentSen={categorySpent.get(category.id) ?? 0}
              budget={byCategory.get(category.id) ?? null}
              onPress={() => setEditing({ kind: 'category', category })}
              onClear={() => void handleClear({ categoryId: category.id })}
              busy={busy}
            />
          ))}
          <View style={styles.spacer} />
        </ScrollView>
      )}

      <Modal
        visible={editing !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} testID="budget-form-modal">
            <BudgetForm
              title={editing?.kind === 'category' ? `${editing.category.name} budget` : 'Monthly budget'}
              initialAmountSen={editingInitial}
              submitLabel={submitLabel}
              onSubmit={handleUpsert}
              submitting={busy}
              onCancel={() => setEditing(null)}
            />
          </View>
        </View>
      </Modal>
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
  monthLabel: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  sectionNote: {
    fontSize: typography.caption,
    color: colors.muted,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  spacer: { height: spacing.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
});