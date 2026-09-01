/**
 * Expenses tab (plan 005) — month-scoped list for the CURRENT local calendar
 * month + add/edit/delete entry points. Re-read on focus (ARCHITECTURE §5:
 * SQLite is the source of truth, no cache), monthly total via the pure engine,
 * rows show date, category, description, amount, account, and the E7 linked
 * badge. No filters/search (plan 006). Month navigation is analytics (011).
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { categoryColor } from '@/components/categoryMeta';
import { monthlyTotals } from '@/engine/totals';
import { formatDayLabel, formatMonthLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ExpensesScreen() {
  const router = useRouter();
  const { authService } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [rows, accs, cats] = await Promise.all([
        services.expenses.listForMonth(year, month),
        services.accounts.list(),
        services.categories.list(),
      ]);
      setExpenses(rows);
      setAccounts(accs);
      setCategories(cats);
      setError(null);
    } catch (loadError: unknown) {
      setError(errMsg(loadError));
    } finally {
      setLoading(false);
    }
  }, [services.expenses, services.accounts, services.categories, year, month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const accountName = (id: number | null): string | null =>
    id == null ? null : (accounts.find((a) => a.id === id)?.name ?? null);

  const total = monthlyTotals(expenses, { month, year });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} testID="expenses-screen">
        <View style={styles.header}>
          <Text style={styles.monthLabel}>{formatMonthLabel(year, month)}</Text>
          <Text style={styles.total} testID="expenses-month-total">
            Total {formatSen(total)}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!error && loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator />
          </View>
        ) : null}

        {!error && !loading && expenses.length === 0 ? (
          <View style={styles.centerBox} testID="expenses-empty">
            <Ionicons name="receipt-outline" size={44} color={colors.muted} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No expenses this month</Text>
            <Text style={styles.emptyBody}>Tap + to record lunch, a bill, a ride…</Text>
          </View>
        ) : null}

        {!error && !loading && expenses.length > 0
          ? expenses.map((expense) => {
              const category = categories.find((c) => c.id === expense.categoryId);
              const account = accountName(expense.accountId);
              const linked = expense.commitmentPaymentId !== null;
              return (
                <Pressable
                  key={expense.id}
                  onPress={() => router.push(`/expenses/${expense.id}/edit` as never)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  accessibilityRole="button"
                  testID={`expense-row-${expense.id}`}
                >
                  <View style={[styles.categoryDot, { backgroundColor: categoryColor(expense.categoryId) }]} />
                  <View style={styles.rowInfo}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {category?.name ?? 'Category'}
                      </Text>
                      <Text style={styles.rowAmount}>{formatSen(expense.amountSen)}</Text>
                    </View>
                    <View style={styles.rowBottom}>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {formatDayLabel(expense.date)}
                        {expense.description ? ` · ${expense.description}` : ''}
                        {account ? ` · ${account}` : ''}
                      </Text>
                      {linked ? (
                        <View style={styles.linkedChip}>
                          <Ionicons name="link-outline" size={11} color={colors.warning} />
                          <Text style={styles.linkedChipLabel}>commitment</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })
          : null}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/expenses/new' as never)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        testID="add-expense-fab"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.lg },
  monthLabel: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  total: { fontSize: typography.body, color: colors.muted, fontWeight: '600' },
  errorText: { fontSize: typography.body, color: colors.danger, marginBottom: spacing.lg },
  centerBox: { alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  emptyIcon: { marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  emptyBody: { fontSize: typography.body, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },
  rowInfo: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontSize: typography.body, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  rowAmount: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text },
  rowBottom: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  rowMeta: { fontSize: typography.caption, color: colors.muted, flex: 1 },
  linkedChip: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: spacing.sm },
  linkedChipLabel: { fontSize: 10, color: colors.warning, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },
});