/**
 * Expense detail screen (plan 006 / EXP-4) — full view of one expense with
 * Edit (routes to 005's /expenses/[id]/edit form) and Delete (005 service +
 * confirm dialog; E7 preserved — linked expenses render read-only with no
 * edit/delete). Re-read on focus so edits made in the form appear here, and
 * the list behind refreshes on its own focus (SQLite is the source of
 * truth, A4). Deletion pops back to the list, whose totals refresh.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import type { Account, Category, Expense } from '@/db/schema';
import { AccountService } from '@/services/AccountService';
import { CategoryService } from '@/services/CategoryService';
import { ExpenseService } from '@/services/ExpenseService';
import { categoryColor } from '@/components/categoryMeta';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useToast } from '@/components/ToastProvider';
import { formatDayLabel } from '@/utils/dates';
import { formatSen, spokenMoneyLabel } from '@/utils/money';
import { colors, moneyFontVariant, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Card } from '@/components/ui/Card';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function ExpenseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authService } = useAuth();
  const toast = useToast();
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
  // Plan 016: destructive delete goes through ConfirmSheet; deleting guards
  // the sheet's confirm button against a double-tap firing two deletes.
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setConfirmDeleteVisible(true);
  };

  /** The actual destructive write — fired by ConfirmSheet's confirm button. */
  const doDelete = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await services.expenses.delete(expenseId);
      setConfirmDeleteVisible(false);
      router.back(); // the list refreshes on focus (totals included)
    } catch (error: unknown) {
      toast.show(`Could not delete expense: ${errMsg(error)}`);
      setConfirmDeleteVisible(false);
    } finally {
      setDeleting(false);
    }
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

      <Card>
        <View style={styles.amountRow}>
          <Text
            style={styles.amount}
            numberOfLines={1}
            accessibilityLabel={`Expense amount, ${spokenMoneyLabel(expense.amountSen)}`}
            testID="expense-detail-amount"
          >
            {formatSen(expense.amountSen)}
          </Text>
          {!linked ? (
            <>
              <Button
                label="Edit"
                variant="secondary"
                icon="create-outline"
                onPress={() => router.push(`/expenses/${expense.id}/edit` as never)}
                testID="expense-detail-edit"
              />
              <IconButton
                icon="trash-outline"
                tone="danger"
                filled
                label="Delete expense"
                onPress={handleDelete}
                testID="expense-detail-delete"
              />
            </>
          ) : null}
        </View>
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
      </Card>

      {linked ? (
        <Text style={styles.linkedHint}>
          This expense was created when you marked a commitment payment as paid. To change or remove it, un-pay the
          payment in Commitments.
        </Text>
      ) : null}

      <ConfirmSheet
        visible={confirmDeleteVisible}
        title="Delete expense"
        message="This reverses the balance change on its account."
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={() => void doDelete()}
        onCancel={() => setConfirmDeleteVisible(false)}
      />
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
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  amount: { fontSize: typography.display, fontWeight: '800', color: colors.text, flex: 1, fontVariant: moneyFontVariant, letterSpacing: -0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  rowValue: { fontSize: typography.body, color: colors.text, flex: 1 },
  description: {
    fontSize: typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  linkedHint: { fontSize: typography.caption, color: colors.muted, lineHeight: 18, marginBottom: spacing.lg },
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