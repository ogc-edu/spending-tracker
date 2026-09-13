/**
 * Expenses tab (plan 006 / EXP-4..6) — browsable history: search, category
 * single-select (F1), period presets + custom range, batch pagination
 * (50/batch), and a pinned totals bar for the WHOLE filtered set (EXP-6).
 *
 * Data flow: uiStore holds the filter (search/category/period/offset) so
 * returning from detail or edit keeps context; every filter change resets
 * offset to 0. `load` re-runs on focus AND on every filter change (the
 * useFocusEffect callback depends on the resolved filter — expo-router's
 * implementation re-runs it while focused), always re-reading SQLite (A4:
 * source of truth, no cache). No SQL or money math here — filters and
 * totals come from ExpenseService.listFiltered/sumFiltered, which share the
 * repository's one predicate builder, so the totals bar can never disagree
 * with the list (tested).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { FilterBar } from '@/components/FilterBar';
import { ExpenseList } from '@/components/ExpenseList';
import { EmptyState } from '@/components/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { Fab } from '@/components/ui/Fab';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';

/** Batch size for "load more" pagination (plan §UI — 50/batch). */
const EXPENSE_PAGE_SIZE = 50;

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ExpensesScreen() {
  const router = useRouter();
  const { authService } = useAuth();

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  // Filter state from uiStore — the load below depends on these, so a change
  // re-fires the focus effect while this screen is focused.
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stale-request guard: a rapid filter change discards the earlier load's
  // result (out-of-order responses must never clobber the newest filter).
  const requestRef = useRef(0);
  // Pagination lock: onEndReached can fire repeatedly while a page loads;
  // the lock prevents double offset bumps (skipped rows).
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
      if (requestId !== requestRef.current) return; // superseded by a newer load
      setExpenses(rows);
      setAccounts(accs);
      setCategories(cats);
      setTotals(sums);
      setError(null);
    } catch (loadError: unknown) {
      if (requestId === requestRef.current) setError(errMsg(loadError));
    } finally {
      if (requestId === requestRef.current) {
        endReachedLockRef.current = false; // a fresh page is now loaded
        setLoading(false);
      }
    }
  }, [services.expenses, services.accounts, services.categories, queryFilter]);

  // Re-read on focus AND on every filter change (SQLite is the source of
  // truth; edits/deletes elsewhere appear on return).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  const hasActiveFilters = filter.search.trim() !== '' || filter.categoryId != null || filter.period !== 'all';

  return (
    <View style={styles.container} testID="expenses-screen">
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
      />

      <View style={styles.totalsBar} testID="expenses-totals-bar">
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue} testID="expenses-total" accessibilityLabel={`Total, ${spokenMoneyLabel(totals.totalSen)}`}>
          {formatSen(totals.totalSen)}
        </Text>
        <Text style={styles.totalCount} testID="expenses-total-count">
          {totals.count} {totals.count === 1 ? 'expense' : 'expenses'}
        </Text>
      </View>

      {error ? <InlineError message={error} testID="expenses-error" /> : null}

      {!error && loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
        </View>
      ) : null}

      {!error && !loading && expenses.length === 0
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

      {!error && !loading && expenses.length > 0 ? (
        <ExpenseList
          expenses={expenses}
          categories={categories}
          accounts={accounts}
          hasMore={hasMore}
          onEndReached={handleEndReached}
          onRefresh={() => void handleRefresh()}
          refreshing={refreshing}
          onPressRow={(expense) => router.push(`/expenses/${expense.id}` as never)}
        />
      ) : null}

      <Fab onPress={() => router.push('/expenses/new' as never)} label="Add expense" testID="add-expense-fab" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  totalsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  totalLabel: { fontSize: typography.caption, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { fontSize: typography.title, fontWeight: '800', color: colors.text, fontVariant: moneyFontVariant, letterSpacing: -0.4 },
  totalCount: {
    fontSize: typography.caption,
    color: colors.accent,
    fontWeight: '700',
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2 },
});