/**
 * Expense detail screen (plan 006 / EXP-4) — full view of one expense with
 * Edit (routes to 005's /expenses/[id]/edit form) and Delete (005 service +
 * confirm dialog; E7 preserved — linked expenses render read-only with no
 * edit/delete). Re-read on focus so edits made in the form appear here, and
 * the list behind refreshes on its own focus (SQLite is the source of
 * truth, A4). Deletion pops back to the list, whose totals refresh.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { categoryColor } from '@/components/categoryMeta';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const expenseId = Number(id);

  const services = useMemo(() => {
    const repos = repositories();
    return {
      expenses: new ExpenseService(repos.expenses, repos.categories, authService),
      accounts: new AccountService(repos.accounts, authService),
      categories: new CategoryService(repos.categories),
    };
  }, [authService]);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isInteger(expenseId) || expenseId <= 0) {
      setLoadError('Invalid expense');
      setLoading(false);
      return;
    }
    try {
      const [row, accs, cats] = await Promise.all([
        services.expenses.byId(expenseId),
        services.accounts.list(),
        services.categories.list(),
      ]);
      setExpense(row);
      setAccounts(accs);
      setCategories(cats);
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(errMsg(error));
    } finally {
      setLoading(false);
    }
  }, [expenseId, services.expenses, services.accounts, services.categories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert('Delete expense', 'This reverses the balance change on its account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await services.expenses.delete(expenseId);
            router.back(); // the list refreshes on focus (totals included)
          } catch (error: unknown) {
            Alert.alert('Delete expense', errMsg(error));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (loadError || !expense) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{loadError ?? 'Expense not found'}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => (pressed ? [styles.button, styles.pressed] : styles.button)}
          accessibilityRole="button"
        >
          <Text style={styles.buttonLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const category = categories.find((c) => c.id === expense.categoryId);
  const account = accounts.find((a) => a.id === expense.accountId);
  const linked = expense.commitmentPaymentId !== null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="expense-detail-screen">
      {linked ? (
        <View style={styles.linkedBadge}>
          <Ionicons name="link-outline" size={16} color={colors.warning} />
          <Text style={styles.linkedBadgeLabel}>Auto-created from commitment</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.amount} testID="expense-detail-amount">
          {formatSen(expense.amountSen)}
        </Text>
        <View style={styles.row}>
          <Ionicons name={category?.icon as never} size={18} color={categoryColor(expense.categoryId)} />
          <Text style={styles.rowValue}>{category?.name ?? `Category ${expense.categoryId}`}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={18} color={colors.muted} />
          <Text style={styles.rowValue}>
            {formatDayLabel(expense.date)} · {expense.date}
          </Text>
        </View>
        {account ? (
          <View style={styles.row}>
            <Ionicons name="wallet-outline" size={18} color={colors.muted} />
            <Text style={styles.rowValue}>{account.name}</Text>
          </View>
        ) : null}
        {expense.description ? <Text style={styles.description}>{expense.description}</Text> : null}
      </View>

      {linked ? (
        <Text style={styles.linkedHint}>
          This expense was created when you marked a commitment payment as paid. To change or remove it, un-pay the
          payment in Commitments.
        </Text>
      ) : (
        <>
          <Pressable
            onPress={() => router.push(`/expenses/${expense.id}/edit` as never)}
            style={({ pressed }) => (pressed ? [styles.editButton, styles.pressed] : styles.editButton)}
            accessibilityRole="button"
            testID="expense-detail-edit"
          >
            <Ionicons name="create-outline" size={18} color={colors.surface} />
            <Text style={styles.editLabel}>Edit expense</Text>
          </Pressable>
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => (pressed ? [styles.deleteButton, styles.pressed] : styles.deleteButton)}
            accessibilityRole="button"
            testID="expense-detail-delete"
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <Text style={styles.deleteLabel}>Delete expense</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  linkedBadgeLabel: { color: colors.warning, fontSize: typography.caption, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  amount: { fontSize: typography.money, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowValue: { fontSize: typography.body, color: colors.text, flex: 1 },
  description: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  linkedHint: { fontSize: typography.caption, color: colors.muted, lineHeight: 18, marginBottom: spacing.lg },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  editLabel: { color: colors.surface, fontSize: typography.emphasis, fontWeight: '700' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.dangerSoft,
  },
  deleteLabel: { color: colors.danger, fontSize: typography.emphasis, fontWeight: '700' },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  buttonLabel: { color: colors.text, fontSize: typography.emphasis, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});