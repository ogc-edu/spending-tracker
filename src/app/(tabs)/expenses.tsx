import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense, ExpenseInstallment } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import type { ExpenseFilter, ExpenseTotals } from '@/repositories/types';
import { useUiStore } from '@/store/uiStore';
import { periodRange } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { FilterBar } from '@/components/FilterBar';
import { ExpenseList } from '@/components/ExpenseList';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { geistWeights, tabularNumsVariant, useTheme } from '@/theme';

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
  const { colors } = useTheme();

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

  // Screen-local pagination state (NOT persisted in uiStore across visits)
  const [offset, setOffset] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Record<number, ExpenseInstallment>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totals, setTotals] = useState<ExpenseTotals>({ count: 0, totalSen: 0 });
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Stale request guard
  const requestRef = useRef(0);
  // Pagination lock
  const endReachedLockRef = useRef(false);

  /** Resolve the period to an inclusive { from, to }. */
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
      accountId: selectedAccountId ?? undefined,
      ...range,
    }),
    [filter.search, filter.categoryId, selectedAccountId, range],
  );

  const load = useCallback(
    async (targetOffset = 0, isAppend = false) => {
      const requestId = ++requestRef.current;
      if (!isAppend) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const [rows, accs, cats, sums] = await Promise.all([
          services.expenses.listFiltered({
            ...queryFilter,
            limit: EXPENSE_PAGE_SIZE,
            offset: targetOffset,
          }),
          services.accounts.list(),
          services.categories.list(),
          services.expenses.sumFiltered(queryFilter),
        ]);

        if (requestId !== requestRef.current) return;

        // Fetch installments for newly loaded expenses
        const instPairs = await Promise.all(
          rows.map(async (r) => {
            try {
              const inst = await services.expenses.getInstallment(r.id);
              return [r.id, inst] as const;
            } catch {
              return [r.id, null] as const;
            }
          }),
        );
        if (requestId !== requestRef.current) return;

        const newInstMap: Record<number, ExpenseInstallment> = {};
        for (const [id, inst] of instPairs) {
          if (inst) newInstMap[id] = inst;
        }

        if (isAppend) {
          setExpenses((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newRows = rows.filter((r) => !existingIds.has(r.id));
            return [...prev, ...newRows];
          });
          setInstallments((prev) => ({ ...prev, ...newInstMap }));
        } else {
          setExpenses(rows);
          setInstallments(newInstMap);
        }

        setAccounts(accs);
        setCategories(cats);
        setTotals(sums);
        setOffset(targetOffset);
        setError(null);
      } catch (loadError: unknown) {
        if (requestId === requestRef.current) setError(errMsg(loadError));
      } finally {
        if (requestId === requestRef.current) {
          endReachedLockRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [services, queryFilter],
  );


  // Re-read on screen focus (resets pagination to top)
  useFocusEffect(
    useCallback(() => {
      void load(0, false);
    }, [load]),
  );

  const hasMore = expenses.length < totals.count;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(0, false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || loading || loadingMore || endReachedLockRef.current) return;
    endReachedLockRef.current = true;
    void load(offset + EXPENSE_PAGE_SIZE, true);
  }, [hasMore, loading, loadingMore, offset, load]);

  const hasActiveFilters =
    filter.search.trim() !== '' ||
    filter.categoryId != null ||
    filter.period !== 'all' ||
    selectedAccountId != null;

  const monthLabel = useMemo(() => {
    if (filter.period === 'thisMonth') {
      return new Date().toLocaleDateString('en-US', { month: 'long' });
    }
    if (filter.period === 'lastMonth') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toLocaleDateString('en-US', { month: 'long' });
    }
    if (filter.period === 'thisWeek') return 'This week';
    if (filter.period === 'today') return 'Today';
    if (filter.period === 'all') return 'All time';
    return 'Custom';
  }, [filter.period]);

  const itemsLabel = `${monthLabel} · ${totals.count} ${totals.count === 1 ? 'item' : 'items'}`;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top,
        },
      ]}
      testID="expenses-screen"
    >
      {/* Sticky header block (bg, bottom hairline) */}
      <View
        style={[
          styles.stickyHeader,
          {
            backgroundColor: colors.bg,
            borderBottomColor: colors.separator,
          },
        ]}
        testID="period-summary-strip"
      >
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.screenTitle,
              {
                color: colors.text,
              },
            ]}
          >
            Expenses
          </Text>
          <View style={styles.summaryRight} testID="expenses-totals-bar">
            <Text
              numberOfLines={1}
              style={[
                styles.itemsCount,
                {
                  color: colors.textSecondary,
                },
              ]}
              testID="expenses-total-count"
            >
              {itemsLabel}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[
                styles.monthTotal,
                {
                  color: colors.text,
                },
              ]}
              testID="expenses-total"
              accessibilityLabel={`Total, ${spokenMoneyLabel(totals.totalSen)}`}
            >
              {formatSen(totals.totalSen)}
            </Text>
          </View>
        </View>

        {/* SearchField + FilterPills row */}
        <FilterBar
          search={filter.search}
          onSearchChange={setExpenseSearch}
          period={filter.period}
          customFrom={filter.customFrom}
          customTo={filter.customTo}
          onSelectPeriod={setExpensePeriod}
          onApplyCustom={setExpenseCustomRange}
          categories={categories}
          categoryId={filter.categoryId}
          onSelectCategory={setExpenseCategory}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />
      </View>

      {error ? <InlineError message={error} testID="expenses-error" /> : null}

      {!error && loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {!error && !loading && expenses.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            headline="No matching expenses"
            caption="Try a different search, category, or period."
            buttonLabel="Clear filters"
            onButtonPress={() => {
              setExpenseSearch('');
              setExpenseCategory(null);
              setExpensePeriod('all');
              setExpenseCustomRange('', '');
              setSelectedAccountId(null);
            }}
            testID="expenses-empty-filtered"
          />
        ) : (
          <EmptyState
            headline="No expenses yet"
            caption="Tap + to record lunch, a bill, a ride…"
            buttonLabel="Add expense"
            onButtonPress={() => router.push('/expenses/new' as never)}
            testID="expenses-empty"
          />
        )
      ) : null}

      {!error && !loading && expenses.length > 0 ? (
        <View style={styles.listContainer}>
          <ExpenseList
            expenses={expenses}
            categories={categories}
            accounts={accounts}
            installments={installments}
            hasMore={hasMore}
            onEndReached={handleEndReached}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing}
            onPressRow={(expense) => router.push(`/expenses/${expense.id}` as never)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  screenTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
    letterSpacing: -0.56,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  itemsCount: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: geistWeights.medium,
  },
  monthTotal: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    fontVariant: tabularNumsVariant,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});