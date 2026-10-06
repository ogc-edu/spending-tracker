/**
 * Expenses tab (Plan 004 — Audit Ledger)
 *
 * Browsable history:
 * - Safe-area insets, sticky top filter dock with horizontal carousels.
 * - Period summary strip (`testID="period-summary-strip"` and `testID="expenses-totals-bar"`):
 *   aggregates total expenditure rendered with `MoneyDisplay` (`testID="expenses-total"`)
 *   and active transaction count badge (`testID="expenses-total-count"`).
 * - Daily grouped modular BentoCard containers with tabular typography.
 * - Swipe-to-action interactions for edit and delete (with linked commitment delete lock).
 * - Preserved root testID="expenses-screen", add-expense-fab, empty states, and error handling.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import type { ExpenseFilter, ExpenseTotals } from '@/repositories/types';
import { useUiStore } from '@/store/uiStore';
import { periodRange } from '@/utils/dates';
import { spokenMoneyLabel } from '@/utils/money';
import { FilterBar } from '@/components/FilterBar';
import { ExpenseList } from '@/components/ExpenseList';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { Fab } from '@/components/ui/Fab';
import { Badge } from '@/components/ui/Badge';
import { MoneyDisplay } from '@/components/ui/MoneyDisplay';
import { colors, spacing } from '@/theme';

/** Batch size for "load more" pagination (plan §UI — 50/batch). */
const EXPENSE_PAGE_SIZE = 50;

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

export default function ExpensesScreen() {
  const router = useRouter();
  const insets = useSafeInsets();
  const { authService } = useAuth();

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  // Filter state from uiStore
  const filter = useUiStore((s) => s.expenseFilter);
  const setExpenseSearch = useUiStore((s) => s.setExpenseSearch);
  const setExpenseCategory = useUiStore((s) => s.setExpenseCategory);
  const setExpensePeriod = useUiStore((s) => s.setExpensePeriod);
  const setExpenseCustomRange = useUiStore((s) => s.setExpenseCustomRange);
  const setExpenseOffset = useUiStore((s) => s.setExpenseOffset);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<ExpenseTotals>({ count: 0, totalSen: 0 });
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stale-request guard
  const requestRef = useRef(0);
  // Pagination lock
  const endReachedLockRef = useRef(false);

  /** Resolve the store period to an inclusive { from, to } (custom unapplied → no bounds). */
  const range = useMemo(() => {
    if (filter.period === 'custom') {
      return filter.customFrom && filter.customTo ? { from: filter.customFrom, to: filter.customTo } : {};
    }
    return periodRange(filter.period);
  }, [filter.period, filter.customFrom, filter.customTo]);

  const queryFilter = useMemo<ExpenseFilter>(
    () => ({
      search: filter.search || undefined,
      categoryId: filter.categoryId ?? undefined,
      ...range,
      limit: EXPENSE_PAGE_SIZE,
      offset: filter.offset,
    }),
    [filter.search, filter.categoryId, filter.offset, range],
  );

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    try {
      const [rows, accs, cats, sums] = await Promise.all([
        services.expenses.listFiltered(queryFilter),
        services.accounts.list(),
        services.categories.list(),
        services.expenses.sumFiltered(queryFilter),
      ]);
      if (requestId !== requestRef.current) return;
      setExpenses(rows);
      setAccounts(accs);
      setCategories(cats);
      setTotals(sums);
      setError(null);
    } catch (loadError: unknown) {
      if (requestId === requestRef.current) setError(errMsg(loadError));
    } finally {
      if (requestId === requestRef.current) {
        endReachedLockRef.current = false;
        setLoading(false);
      }
    }
  }, [services.expenses, services.accounts, services.categories, queryFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Account-filtered views (if an account is selected in the dock) */
  const displayedExpenses = useMemo(() => {
    if (selectedAccountId == null) return expenses;
    return expenses.filter((e) => e.accountId === selectedAccountId);
  }, [expenses, selectedAccountId]);

  const displayedTotals = useMemo(() => {
    if (selectedAccountId == null) return totals;
    return {
      count: displayedExpenses.length,
      totalSen: displayedExpenses.reduce((sum, e) => sum + e.amountSen, 0),
    };
  }, [selectedAccountId, displayedExpenses, totals]);

  /** True while more batches exist: loaded rows so far < filtered count (EXP-6). */
  const hasMore = filter.offset + expenses.length < totals.count;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || endReachedLockRef.current) return;
    endReachedLockRef.current = true;
    setExpenseOffset(filter.offset + EXPENSE_PAGE_SIZE);
  }, [hasMore, filter.offset, setExpenseOffset]);

  const handleEdit = useCallback(
    (expense: Expense) => {
      router.push(`/expenses/${expense.id}/edit` as never);
    },
    [router],
  );

  const handleDelete = useCallback(
    async (expense: Expense) => {
      if (expense.commitmentPaymentId !== null) return;
      try {
        await services.expenses.delete(expense.id);
        await load();
      } catch (deleteError: unknown) {
        setError(errMsg(deleteError));
      }
    },
    [services.expenses, load],
  );

  const hasActiveFilters =
    filter.search.trim() !== '' ||
    filter.categoryId != null ||
    filter.period !== 'all' ||
    selectedAccountId != null;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
      testID="expenses-screen"
    >
      {/* Sticky top filter dock */}
      <FilterBar
        search={filter.search}
        onSearchChange={setExpenseSearch}
        categories={categories}
        categoryId={filter.categoryId}
        onSelectCategory={setExpenseCategory}
        period={filter.period}
        customFrom={filter.customFrom}
        customTo={filter.customTo}
        onSelectPeriod={setExpensePeriod}
        onApplyCustom={setExpenseCustomRange}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
      />

      {/* Period summary strip framed with hairline border */}
      <View
        className="border-b border-border/60 bg-card/60"
        testID="period-summary-strip"
      >
        <View
          className="flex-row items-center justify-between px-4 py-3"
          testID="expenses-totals-bar"
        >
          <View className="flex-row items-baseline gap-2">
            <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Spent
            </Text>
            <MoneyDisplay
              amountInSen={displayedTotals.totalSen}
              size="lg"
              testID="expenses-total"
              accessibilityLabel={`Total, ${spokenMoneyLabel(displayedTotals.totalSen)}`}
            />
          </View>
          <Badge
            tone="accent"
            label={`${displayedTotals.count} ${displayedTotals.count === 1 ? 'expense' : 'expenses'}`}
            testID="expenses-total-count"
          />
        </View>
      </View>

      {error ? <InlineError message={error} testID="expenses-error" /> : null}

      {!error && loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {!error && !loading && displayedExpenses.length === 0
        ? hasActiveFilters
          ? (
              <EmptyState
                icon="search-outline"
                title="No matching expenses"
                body="Try a different search, category, or period."
                action={{
                  label: 'Clear filters',
                  onPress: () => {
                    setExpenseSearch('');
                    setExpenseCategory(null);
                    setExpensePeriod('all');
                    setExpenseCustomRange('', '');
                    setExpenseOffset(0);
                    setSelectedAccountId(null);
                  },
                }}
                testID="expenses-empty-filtered"
              />
            )
          : (
              <EmptyState
                icon="receipt-outline"
                title="No expenses yet"
                body="Tap + to record lunch, a bill, a ride…"
                action={{ label: 'Add expense', onPress: () => router.push('/expenses/new' as never) }}
                testID="expenses-empty"
              />
            )
        : null}

      {!error && !loading && displayedExpenses.length > 0 ? (
        <ExpenseList
          expenses={displayedExpenses}
          categories={categories}
          accounts={accounts}
          hasMore={hasMore}
          onEndReached={handleEndReached}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
          onPressRow={(expense) => router.push(`/expenses/${expense.id}` as never)}
          onEditRow={handleEdit}
          onDeleteRow={handleDelete}
        />
      ) : null}

      <Fab onPress={() => router.push('/expenses/new' as never)} label="Add expense" testID="add-expense-fab" />
    </View>
  );
}

const styles = StyleSheet.create({
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
});