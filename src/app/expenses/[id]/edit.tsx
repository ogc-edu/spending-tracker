/**
 * Edit expense screen (plan 005 / EXP-2, EXP-3) — push screen at
 * /expenses/[id]/edit. Loads the row, renders the form prefilled from the row
 * (amount as an input string), save edits in place (same row, balance deltas
 * computed by the service), delete asks for confirmation before reversing the
 * balance effect.
 *
 * E7 linked expenses (auto-created from a commitment payment) render as a
 * READ-ONLY view: badge + values + hint, no save, no delete — the service
 * blocks too (defense in depth).
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
import { ExpenseForm, expenseToFormValues } from '@/components/ExpenseForm';
import { categoryColor } from '@/components/categoryMeta';
import { useUiStore } from '@/store/uiStore';
import { formatDayLabel } from '@/utils/dates';
import { formatSen } from '@/utils/money';
import type { ExpenseInput } from '@/repositories/types';
import { colors, spacing, typography } from '@/theme';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function EditExpenseScreen() {
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
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (input: ExpenseInput) => {
    setSubmitting(true);
    try {
      await services.expenses.edit(expenseId, input);
      useUiStore.getState().setLastUsed(input.categoryId, input.accountId);
      router.back();
    } catch (error: unknown) {
      Alert.alert('Edit expense', errMsg(error));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = () => {
    if (!expense) return;
    Alert.alert('Delete expense', 'This reverses the balance change on its account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await services.expenses.delete(expenseId);
            router.back();
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
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const mapped = expenseToFormValues(expense);

  if (mapped.readOnly) {
    // E7: auto-created from a commitment payment — read-only, no edit/delete.
    const category = categories.find((c) => c.id === expense.categoryId);
    const account = accounts.find((a) => a.id === expense.accountId);
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="linked-expense-view">
        <View style={styles.linkedBadge}>
          <Ionicons name="link-outline" size={16} color={colors.warning} />
          <Text style={styles.linkedBadgeLabel}>Auto-created from commitment</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.amount}>{formatSen(expense.amountSen)}</Text>
          <View style={styles.row}>
            <Ionicons name={category?.icon as never} size={18} color={categoryColor(expense.categoryId)} />
            <Text style={styles.rowValue}>{category?.name ?? `Category ${expense.categoryId}`}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            <Text style={styles.rowValue}>{formatDayLabel(expense.date)} · {expense.date}</Text>
          </View>
          {account ? (
            <View style={styles.row}>
              <Ionicons name="wallet-outline" size={18} color={colors.muted} />
              <Text style={styles.rowValue}>{account.name}</Text>
            </View>
          ) : null}
          {expense.description ? <Text style={styles.description}>{expense.description}</Text> : null}
        </View>
        <Text style={styles.linkedHint}>
          This expense was created when you marked a commitment payment as paid. To change or remove it, un-pay the
          payment in Commitments.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="linked-expense-back"
        >
          <Text style={styles.backButtonLabel}>Back</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="edit-expense-screen">
      <ExpenseForm
        categories={categories}
        accounts={accounts}
        defaults={mapped.values}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        submitting={submitting}
        onCancel={() => router.back()}
      />
      <Pressable
        onPress={confirmDelete}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
        accessibilityRole="button"
        disabled={submitting}
        testID="expense-delete-button"
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={styles.deleteLabel}>Delete expense</Text>
      </Pressable>
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
  description: { fontSize: typography.body, color: colors.muted, marginTop: spacing.xs, fontStyle: 'italic' },
  linkedHint: { fontSize: typography.caption, color: colors.muted, lineHeight: 18, marginBottom: spacing.lg },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  backButtonLabel: { color: colors.text, fontSize: typography.emphasis, fontWeight: '600' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
  },
  deleteLabel: { color: colors.danger, fontSize: typography.emphasis, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});